// Socket.io client connection helper
import { io } from 'socket.io-client';
import { BASE_URL } from "../src/config.js";

let socket = null;

export const connectSocket = (token) => {
  if (!socket) {
    socket = io(BASE_URL || undefined, { auth: { token } });
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
