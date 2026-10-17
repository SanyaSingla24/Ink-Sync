import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    // No URL in dev -> connects to same origin -> Vite proxies /socket.io to backend.
    // In production, set VITE_SOCKET_URL (e.g. https://your-api.onrender.com)
    socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};