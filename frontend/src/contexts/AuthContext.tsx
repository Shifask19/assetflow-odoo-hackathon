import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: () => boolean;
  isAssetManager: () => boolean;
  isDeptHead: () => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('assetflow_token');
    const saved = localStorage.getItem('assetflow_user');
    if (token && saved) {
      try {
        setUser(JSON.parse(saved));
        // Verify token
        authApi.me().then(res => {
          setUser(res.data);
          localStorage.setItem('assetflow_user', JSON.stringify(res.data));
        }).catch(() => {
          logout();
        }).finally(() => setLoading(false));
      } catch {
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { token, user: userData } = res.data;
    localStorage.setItem('assetflow_token', token);
    localStorage.setItem('assetflow_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('assetflow_token');
    localStorage.removeItem('assetflow_user');
    setUser(null);
  };

  const isAdmin = () => user?.role === 'admin';
  const isAssetManager = () => user?.role === 'asset_manager' || user?.role === 'admin';
  const isDeptHead = () => user?.role === 'department_head' || user?.role === 'admin';
  const hasRole = (...roles: string[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isAssetManager, isDeptHead, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
