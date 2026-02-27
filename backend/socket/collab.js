const mongoose = require('mongoose');
const Membership = require('../models/Membership');
const CollabFile = require('../models/CollabFile');
const CollabVersion = require('../models/CollabVersion');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { syncToDisk } = require('../utils/fileSync');

const fileCursorState = new Map(); // fileId -> Map<userId, cursor>
const sheetLocks = new Map(); // fileId -> Map<cellId, { userId, until }>

function ensureMap(map, key, fallback) {
  if (!map.has(key)) map.set(key, fallback());
  return map.get(key);
}

function isValidObjectId(value) {
  return Boolean(value) && mongoose.isValidObjectId(value);
}

function applyTextDelta(text, delta = {}) {
  const from = Math.max(0, Number(delta.from || 0));
  const to = Math.max(from, Number(delta.to || from));
  const inserted = String(delta.text || '');
  return `${text.slice(0, from)}${inserted}${text.slice(to)}`;
}

module.exports = function registerCollabSocket(io, socket) {
  function onSafe(event, handler) {
    socket.on(event, async (payload = {}) => {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`collab socket error (${event}):`, error.message);
        socket.emit('error', { message: 'Collaboration action failed. Please retry.' });
      }
    });
  }

  onSafe('collab:file:join', async ({ fileId }) => {
    if (!isValidObjectId(fileId)) return;

    const file = await CollabFile.findById(fileId).populate('comments.author', 'name email');
    if (!file) return socket.emit('error', { message: 'File not found.' });

    const membership = await Membership.findOne({ group: file.group, user: socket.user.id });
    if (!membership) return socket.emit('error', { message: 'Unauthorized file access.' });

    // Sync file to disk when joining
    await syncToDisk(file.group, file.name, file.content);

    socket.join(`file:${fileId}`);

    const cursorMap = ensureMap(fileCursorState, String(fileId), () => new Map());
    const cursors = Array.from(cursorMap.entries()).map(([userId, cursor]) => ({ userId, ...cursor }));

    socket.emit('collab:file:snapshot', {
      fileId,
      type: file.type,
      content: file.content,
      version: file.latestVersion,
      comments: file.comments,
      cursors,
    });

    socket.to(`file:${fileId}`).emit('collab:file:presence', {
      fileId,
      user: { id: socket.user.id, name: socket.user.name },
      status: 'online',
    });
  });

  onSafe('collab:file:leave', async ({ fileId }) => {
    if (!fileId) return;
    socket.leave(`file:${fileId}`);
    const cursorMap = fileCursorState.get(String(fileId));
    if (cursorMap) {
      cursorMap.delete(socket.user.id.toString());
    }
  });

  onSafe('collab:file:cursor', async ({ fileId, position, selection }) => {
    if (!isValidObjectId(fileId)) return;

    const cursorMap = ensureMap(fileCursorState, String(fileId), () => new Map());
    cursorMap.set(socket.user.id.toString(), {
      position: Number(position || 0),
      selection: selection || null,
      userName: socket.user.name,
    });

    socket.to(`file:${fileId}`).emit('collab:file:cursor', {
      fileId,
      userId: socket.user.id,
      userName: socket.user.name,
      position,
      selection,
    });
  });

  onSafe('collab:file:patch', async ({ fileId, delta, patchSummary = 'Live patch' }) => {
    if (!isValidObjectId(fileId)) return;

    const file = await CollabFile.findById(fileId);
    if (!file) return;

    const membership = await Membership.findOne({ group: file.group, user: socket.user.id });
    if (!membership) return;

    if (file.type === 'spreadsheet') {
      const { cellId, value, formula, lock = true } = delta || {};
      if (!cellId) return;

      const lockMap = ensureMap(sheetLocks, String(fileId), () => new Map());
      const currentLock = lockMap.get(cellId);
      const now = Date.now();

      if (currentLock && currentLock.userId !== socket.user.id.toString() && currentLock.until > now) {
        return socket.emit('collab:file:lock-denied', { fileId, cellId, lockedBy: currentLock.userId });
      }

      if (lock) {
        lockMap.set(cellId, { userId: socket.user.id.toString(), until: now + 15000 });
      }

      const nextCells = { ...(file.content?.cells || {}) };
      const previous = nextCells[cellId] || {};
      const nextVersion = (previous.version || 0) + 1;

      nextCells[cellId] = {
        value: value ?? previous.value ?? '',
        formula: formula ?? previous.formula ?? '',
        version: nextVersion,
        updatedBy: socket.user.id,
        updatedAt: new Date().toISOString(),
      };

      file.content = { cells: nextCells };
    } else {
      const currentText = String(file.content?.text || '');
      const nextText = applyTextDelta(currentText, delta);
      file.content = { text: nextText };
    }

    file.latestVersion += 1;
    await file.save();

    // Sync to disk
    await syncToDisk(file.group, file.name, file.content);

    await CollabVersion.create({
      file: file._id,
      group: file.group,
      version: file.latestVersion,
      parentVersion: file.latestVersion - 1,
      snapshot: file.content,
      patchSummary,
      author: socket.user.id,
      branch: 'main',
    });

    await ActivityLog.create({
      group: file.group,
      file: file._id,
      user: socket.user.id,
      action: 'file_patched',
      metadata: { type: file.type, patchSummary },
    });

    io.to(`file:${fileId}`).emit('collab:file:patched', {
      fileId,
      version: file.latestVersion,
      content: file.content,
      updatedBy: { id: socket.user.id, name: socket.user.name },
      patchSummary,
    });
  });

  onSafe('collab:file:comment', async ({ fileId, text, line = null, mentions = [] }) => {
    if (!isValidObjectId(fileId)) return;
    if (!text || !String(text).trim()) return;

    const file = await CollabFile.findById(fileId);
    if (!file) return;

    const membership = await Membership.findOne({ group: file.group, user: socket.user.id });
    if (!membership) return;

    const mentionIds = mentions.filter(isValidObjectId).map((id) => String(id));
    file.comments.unshift({
      author: socket.user.id,
      text: String(text).trim(),
      line,
      mentions: mentionIds,
      resolved: false,
    });
    await file.save();

    await file.populate('comments.author', 'name email');
    const comment = file.comments[0];
    
    await ActivityLog.create({
      group: file.group,
      file: file._id,
      user: socket.user.id,
      action: 'file_commented',
      metadata: { text: comment.text, fileName: file.name },
    });

    io.to(`file:${fileId}`).emit('collab:file:commented', { fileId, comment });
  });

  onSafe('notification:mark-read', async ({ notificationId }) => {
    if (!isValidObjectId(notificationId)) return;
    await Notification.updateOne({ _id: notificationId, user: socket.user.id }, { $set: { readAt: new Date() } });
  });

  socket.on('disconnect', async () => {
    for (const [fileId, cursorMap] of fileCursorState.entries()) {
      if (!cursorMap.has(socket.user.id.toString())) continue;
      cursorMap.delete(socket.user.id.toString());
      socket.to(`file:${fileId}`).emit('collab:file:presence', {
        fileId,
        user: { id: socket.user.id, name: socket.user.name },
        status: 'offline',
      });
    }
  });
};
