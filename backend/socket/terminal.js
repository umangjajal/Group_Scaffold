const pty = (() => {
  try {
    // eslint-disable-next-line global-require
    return require('node-pty');
  } catch (error) {
    return null;
  }
})();

const { BASE_DIR } = require('../utils/fileSync');
const path = require('path');
const fs = require('fs');
const Membership = require('../models/Membership');

/**
 * terminalSessions: Map<groupId, {
 *   ptyProcess: any,
 *   participants: Set<socketId>,
 *   outputBuffer: string[],
 *   config: { shell, cwd, env, cols, rows },
 *   cleanupTimer: NodeJS.Timeout | null
 * }>
 */
const terminalSessions = new Map();
const MAX_BUFFER_LINES = 200;
const SESSION_IDLE_TIMEOUT = 300000; // 5 minutes

module.exports = function registerTerminalSocket(io, socket) {
  socket.on('terminal:start', async ({ cols = 100, rows = 30, groupId, shell: requestedShell, env = {} } = {}) => {
    try {
      if (!pty) {
        socket.emit('terminal:error', { message: 'Terminal backend is unavailable.' });
        return;
      }

      if (!groupId) {
        socket.emit('terminal:error', { message: 'groupId is required.' });
        return;
      }

      const gId = String(groupId);
      
      // Verify membership
      const isMember = await Membership.exists({ user: socket.user.id, group: gId });
      if (!isMember) {
        socket.emit('terminal:error', { message: 'Unauthorized: You are not a member of this group.' });
        return;
      }

      socket.join(`terminal:${gId}`);

      if (terminalSessions.has(gId)) {
        const session = terminalSessions.get(gId);
        session.participants.add(socket.id);
        
        // Cancel cleanup timer if it was running
        if (session.cleanupTimer) {
          clearTimeout(session.cleanupTimer);
          session.cleanupTimer = null;
        }

        // Send existing buffer and current dimensions
        if (session.outputBuffer.length > 0) {
          socket.emit('terminal:data', session.outputBuffer.join(''));
        }
        socket.emit('terminal:ready', { 
          isExisting: true, 
          cols: session.config.cols, 
          rows: session.config.rows 
        });
        return;
      }

      const groupDir = path.join(BASE_DIR, gId);
      if (!fs.existsSync(groupDir)) {
        fs.mkdirSync(groupDir, { recursive: true });
      }

      const defaultShell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
      const shell = requestedShell || defaultShell;
      
      // Sanitized environment
      const cleanEnv = { 
        ...process.env, 
        ...env, 
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        GROUP_ID: gId,
        USER_ID: String(socket.user.id)
      };

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: Number(cols) || 100,
        rows: Number(rows) || 30,
        cwd: groupDir,
        env: cleanEnv,
      });

      const session = {
        ptyProcess,
        participants: new Set([socket.id]),
        outputBuffer: [],
        config: { 
          shell, 
          cwd: groupDir, 
          env: cleanEnv,
          cols: Number(cols) || 100,
          rows: Number(rows) || 30
        },
        cleanupTimer: null
      };

      terminalSessions.set(gId, session);

      ptyProcess.onData((data) => {
        io.to(`terminal:${gId}`).emit('terminal:data', data);
        session.outputBuffer.push(data);
        if (session.outputBuffer.length > MAX_BUFFER_LINES) {
          session.outputBuffer.shift();
        }
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        io.to(`terminal:${gId}`).emit('terminal:exit', { exitCode, signal });
        terminalSessions.delete(gId);
      });

      socket.emit('terminal:ready', { 
        isExisting: false, 
        cols: session.config.cols, 
        rows: session.config.rows 
      });
      console.log(`Terminal session started for group ${gId} by user ${socket.user.id}`);
    } catch (error) {
      console.error('terminal:start error', error);
      socket.emit('terminal:error', { message: 'Failed to initialize terminal.' });
    }
  });

  socket.on('terminal:input', ({ groupId, data }) => {
    if (!groupId) return;
    const session = terminalSessions.get(String(groupId));
    if (session && session.ptyProcess && session.participants.has(socket.id)) {
      session.ptyProcess.write(String(data || ''));
    }
  });

  socket.on('terminal:resize', ({ groupId, cols, rows }) => {
    if (!groupId) return;
    const gId = String(groupId);
    const session = terminalSessions.get(gId);
    if (session && session.ptyProcess && session.participants.has(socket.id)) {
      try {
        const nCols = Number(cols) || 100;
        const nRows = Number(rows) || 30;
        session.ptyProcess.resize(nCols, nRows);
        session.config.cols = nCols;
        session.config.rows = nRows;
        // Notify others that the terminal was resized
        io.to(`terminal:${gId}`).emit('terminal:resized', { cols: nCols, rows: nRows });
      } catch (_) { /* ignore */ }
    }
  });

  socket.on('terminal:stop', async ({ groupId }) => {
    if (!groupId) return;
    const gId = String(groupId);
    
    // Only members can stop? Or only the one who started? 
    // Let's stick with membership for now.
    const session = terminalSessions.get(gId);
    if (session && session.participants.has(socket.id)) {
      session.ptyProcess.kill();
      terminalSessions.delete(gId);
      io.to(`terminal:${gId}`).emit('terminal:terminated');
    }
  });

  socket.on('disconnect', () => {
    for (const [gId, session] of terminalSessions.entries()) {
      if (session.participants.has(socket.id)) {
        session.participants.delete(socket.id);
        
        if (session.participants.size === 0) {
          session.cleanupTimer = setTimeout(() => {
            const currentSession = terminalSessions.get(gId);
            if (currentSession && currentSession.participants.size === 0) {
              currentSession.ptyProcess.kill();
              terminalSessions.set(gId, null); // Clear from map or delete
              terminalSessions.delete(gId);
              console.log(`Auto-terminated idle terminal session for group: ${gId}`);
            }
          }, SESSION_IDLE_TIMEOUT);
        }
      }
    }
  });
};
