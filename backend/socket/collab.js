const Membership = require('../models/Membership');
const CollabFile = require('../models/CollabFile');
const CollabVersion = require('../models/CollabVersion');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');

const fileCursorState = new Map(); // fileId -> Map<userId, cursor>
const sheetLocks = new Map(); // fileId -> Map<cellId, { userId, until }>

function ensureMap(map, key, fallback) {
  if (!map.has(key)) map.set(key, fallback());
  return map.get(key);
}

function applyTextDelta(text, delta = {}) {
  const from = Math.max(0, Number(delta.from || 0));
  const to = Math.max(from, Number(delta.to || from));
  const inserted = String(delta.text || '');
  return `${text.slice(0, from)}${inserted}${text.slice(to)}`;
}

module.exports = function registerCollabSocket(io, socket) {
  socket.on('collab:file:join', async ({ fileId }) => {
    const file = await CollabFile.findById(fileId);
    if (!file) return socket.emit('error', { message: 'File not found.' });

    const membership = await Membership.findOne({ group: file.group, user: socket.user.id });
    if (!membership) return socket.emit('error', { message: 'Unauthorized file access.' });

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

    io.to(`file:${fileId}`).emit('collab:file:presence', {
      fileId,
      user: { id: socket.user.id, name: socket.user.name },
      status: 'online',
    });
  });

  socket.on('collab:file:leave', ({ fileId }) => {
    socket.leave(`file:${fileId}`);
    const cursorMap = fileCursorState.get(String(fileId));
    if (cursorMap) {
      cursorMap.delete(socket.user.id.toString());
    }
  });

  socket.on('collab:file:cursor', ({ fileId, position, selection }) => {
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

  socket.on('collab:file:patch', async ({ fileId, delta, patchSummary = 'Live patch' }) => {
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

  socket.on('collab:file:comment', async ({ fileId, text, line = null, mentions = [] }) => {
    if (!text || !String(text).trim()) return;

    const file = await CollabFile.findById(fileId);
    if (!file) return;

    const membership = await Membership.findOne({ group: file.group, user: socket.user.id });
    if (!membership) return;

    const mentionIds = mentions.map((id) => String(id));
    file.comments.unshift({
      author: socket.user.id,
      text: String(text).trim(),
      line,
      mentions: mentionIds,
      resolved: false,
    });
    await file.save();

    for (const mentionUserId of mentionIds) {
      await Notification.create({
        user: mentionUserId,
        type: 'mention',
        message: `${socket.user.name} mentioned you in ${file.name}`,
        data: { fileId, groupId: String(file.group), line },
      });
      io.to(`user:${mentionUserId}`).emit('notification:new', {
        type: 'mention',
        message: `${socket.user.name} mentioned you in ${file.name}`,
        data: { fileId, groupId: String(file.group), line },
      });
    }

    const comment = file.comments[0];
    io.to(`file:${fileId}`).emit('collab:file:commented', { fileId, comment });
  });

  socket.on('notification:mark-read', async ({ notificationId }) => {
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
