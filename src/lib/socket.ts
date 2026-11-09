import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/**
 * Socket server origin. Like the web app, it's the API URL without its trailing "/api".
 * Override with EXPO_PUBLIC_SOCKET_URL if the socket runs elsewhere.
 */
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || API_URL.replace(/\/api\/?$/, '');

/** Opens a socket and runs the server's "setup" handshake for this user. */
export function connectSocket(user: { _id: string; name?: string }): Socket {
  const socket = io(SOCKET_URL, { transports: ['websocket'] });
  socket.emit('setup', user);
  return socket;
}
