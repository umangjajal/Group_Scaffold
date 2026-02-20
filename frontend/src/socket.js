import { io } from "socket.io-client";

function getToken() {
  return localStorage.getItem("token") || "user:1";
}

export const socket = io("http://localhost:5000", {
  autoConnect: false,
  withCredentials: true,
  auth: { token: getToken() },
});

export function connectSocket() {
  socket.auth = { token: getToken() };
  socket.connect();

  socket.on("connect_error", (err) =>
    console.error("socket connect_error", err.message)
  );
}
