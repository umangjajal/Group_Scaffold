let pty = null;
try {
  // Optional dependency in constrained environments.
  // In production, install node-pty for full terminal support.
  // eslint-disable-next-line global-require
  pty = require('node-pty');
} catch (error) {
  pty = null;
}

const { BASE_DIR } = require('../utils/fileSync');
const path = require('path');
const fs = require('fs');

const terminalSessions = new Map(); // socket.id -> ptyProcess

module.exports = function registerTerminalSocket(io, socket) {
  socket.on('terminal:start', ({ cols = 100, rows = 30, groupId } = {}) => {
    try {
      if (!pty) {
        socket.emit('terminal:error', { message: 'Terminal backend is unavailable. Install node-pty on server.' });
        return;
      }

      if (terminalSessions.has(socket.id)) {
        terminalSessions.get(socket.id).kill();
        terminalSessions.delete(socket.id);
      }

      let cwd = process.cwd();
      if (groupId) {
        const groupDir = path.join(BASE_DIR, String(groupId));
        if (!fs.existsSync(groupDir)) {
          fs.mkdirSync(groupDir, { recursive: true });
        }
        cwd = groupDir;
      }

      const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: Number(cols) || 100,
        rows: Number(rows) || 30,
        cwd,
        env: process.env,
      });

      terminalSessions.set(socket.id, ptyProcess);

      ptyProcess.onData((data) => {
        socket.emit('terminal:data', data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        socket.emit('terminal:exit', { exitCode });
        terminalSessions.delete(socket.id);
      });

      socket.emit('terminal:ready');
    } catch (error) {
      console.error('terminal:start error', error.message);
      socket.emit('terminal:error', { message: 'Terminal failed to start.' });
    }
  });

  socket.on('terminal:input', ({ data }) => {
    const session = terminalSessions.get(socket.id);
    if (!session) return;
    session.write(String(data || ''));
  });

  socket.on('terminal:resize', ({ cols, rows }) => {
    const session = terminalSessions.get(socket.id);
    if (!session) return;
    try {
      session.resize(Number(cols) || 100, Number(rows) || 30);
    } catch (_) {
      // ignore invalid resize
    }
  });

  socket.on('terminal:stop', () => {
    const session = terminalSessions.get(socket.id);
    if (session) {
      session.kill();
      terminalSessions.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    const session = terminalSessions.get(socket.id);
    if (session) {
      session.kill();
      terminalSessions.delete(socket.id);
    }
  });
};
