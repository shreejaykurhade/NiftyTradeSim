import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:5000', {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
  }
  return socket;
}

// Hook: subscribe to market_update events
export function useMarketSocket(onUpdate) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    const sock = getSocket();
    const handler = (data) => callbackRef.current(data);
    sock.on('market_update', handler);
    return () => sock.off('market_update', handler);
  }, []);
}
