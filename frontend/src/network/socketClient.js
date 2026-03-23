import { io } from "socket.io-client";
import { getAccessToken, getSocketUrl } from "./config";

function buildSocketOptions(overrides = {}) {
  return {
    withCredentials: true,
    ...overrides,
    auth: {
      token: getAccessToken(),
      ...(overrides.auth || {}),
    },
  };
}

function connectWithTarget(target, options) {
  return target ? io(target, options) : io(options);
}

const socketTarget = getSocketUrl();

export const socket = connectWithTarget(
  socketTarget,
  buildSocketOptions({ autoConnect: false })
);

export function createSocketConnection(overrides = {}) {
  return connectWithTarget(socketTarget, buildSocketOptions(overrides));
}

export function connectSocket() {
  socket.auth = { ...(socket.auth || {}), token: getAccessToken() };

  if (!socket.connected) {
    socket.connect();
  }

  socket.off("connect_error");
  socket.on("connect_error", (err) => {
    console.error("socket connect_error", err.message);
  });
}
