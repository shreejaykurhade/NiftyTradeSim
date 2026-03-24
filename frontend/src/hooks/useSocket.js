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
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const sock = getSocket();
    const handler = (data) => onUpdateRef.current(data);
    sock.on('market_update', handler);
    return () => sock.off('market_update', handler);
  }, []); // only run once — ref keeps callback fresh
}

// Hook: subscribe to private user order events
// Uses ref so inline callbacks don't cause repeated re-subscriptions
export function useOrderSocket(userId, onOrderExecuted) {
  const callbackRef = useRef(onOrderExecuted);
  callbackRef.current = onOrderExecuted;

  useEffect(() => {
    if (!userId) return;
    const sock = getSocket();
    sock.emit('subscribe_user', userId); // subscribe only once per userId

    const handler = (data) => callbackRef.current(data);
    sock.on('order_executed', handler);

    return () => sock.off('order_executed', handler);
  }, [userId]); // only re-run if userId changes
}
