import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    // In production, connect to the Railway backend; in dev, use same origin (Vite proxy)
    const serverUrl = import.meta.env.VITE_API_URL ?? window.location.origin;
    const s = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      closeOnBeforeunload: false,
    });

    s.on('connect', () => console.log('[socket] connected'));
    s.on('connect_error', (e) => console.error('[socket] error:', e.message));

    socketRef.current = s;
    setSocket(s);

    // Tab visibility: force reconnect when tab becomes active again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      s.disconnect();
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
