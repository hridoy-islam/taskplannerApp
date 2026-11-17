import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/**
 * Socket server origin. Like the web app, it's the API URL without its trailing "/api".
 * Override with EXPO_PUBLIC_SOCKET_URL if the socket runs elsewhere.
 */
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || API_URL.replace(/\/api\/?$/, '');

/**
 * Opens a socket and joins this user's room ("setup").
 *
 * The room is re-joined on every (re)connect: when the phone switches network, sleeps or the app
 * comes back from the background, socket.io reconnects with a brand-new server socket, and without
 * a fresh "setup" that socket would never receive this user's notifications / messages again.
 * The user id also goes in the handshake so an updated server joins the room before any event.
 */
export function connectSocket(user: { _id: string; name?: string }): Socket {
  const socket = io(SOCKET_URL, { transports: ['websocket'], auth: { userId: user._id } });
  socket.on('connect', () => socket.emit('setup', user));
  return socket;
}
