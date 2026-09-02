'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, setAuthToken, getAuthToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }
      setToken(storedToken);

      try {
        const res = await api.getMe();
        setUser(res.user);
      } catch (err) {
        console.error('Session restore failed:', err);
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const getDashboardPath = (role) => {
    switch (role) {
      case 'PROVIDER':
        return '/provider';
      case 'MEDIATOR':
        return '/mediator';
      case 'CLIENT':
      default:
        return '/client';
    }
  };

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
    const targetPath = getDashboardPath(res.user.role);
    router.push(targetPath);
    return res.user;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
    const targetPath = getDashboardPath(res.user.role);
    router.push(targetPath);
    return res.user;
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        getDashboardPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
