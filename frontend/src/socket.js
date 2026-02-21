import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('accessToken') || '';
}

export const socket = io(API_URL, {
  autoConnect: false,
  withCredentials: true,
  auth: { token: getToken() },
});

export function connectSocket() {
  socket.auth = { token: getToken() };
  if (!socket.connected) {
    socket.connect();
  }

  socket.off('connect_error');
  socket.on('connect_error', (err) => {
    console.error('socket connect_error', err.message);
  });
}
