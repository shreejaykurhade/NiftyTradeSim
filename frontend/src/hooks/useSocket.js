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
  useEffect(() => {
    const sock = getSocket();
    const handler = (data) => onUpdate(data);
    sock.on('market_update', handler);
    return () => sock.off('market_update', handler);
  }, [onUpdate]);
}

// Hook: subscribe to private user order events
export function useOrderSocket(userId, onOrderExecuted) {
  useEffect(() => {
    if (!userId) return;
    const sock = getSocket();
    sock.emit('subscribe_user', userId);
    
    const handler = (data) => onOrderExecuted(data);
    sock.on('order_executed', handler);
    
    return () => sock.off('order_executed', handler);
  }, [userId, onOrderExecuted]);
}
