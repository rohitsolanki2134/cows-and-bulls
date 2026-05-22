import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/game';
import api from '../utils/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  guestLogin: (username: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('token');
    if (saved) {
      api.get('/auth/me', { headers: { Authorization: `Bearer ${saved}` } })
        .then(r => { setToken(saved); setUser(r.data.user); })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const applyAuth = (data: { token: string; user: User }) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
  };

  const login = async (username: string, password: string) => {
    const r = await api.post('/auth/login', { username, password });
    applyAuth(r.data);
  };

  const register = async (username: string, password: string) => {
    const r = await api.post('/auth/register', { username, password });
    applyAuth(r.data);
  };

  const guestLogin = async (username: string) => {
    const r = await api.post('/auth/guest', { username });
    applyAuth(r.data);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, guestLogin, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
