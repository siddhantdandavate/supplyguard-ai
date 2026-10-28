import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LoginCredentials, RegisterCredentials, User } from '../types/api';
import { api, getToken, setToken, setUnauthorizedHandler } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegisterCredentials) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      if (getToken()) {
        try {
          setUser(await api.getMe());
        } catch {
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const res = await api.login(credentials);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: RegisterCredentials) => {
    const res = await api.register(data);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await api.getMe());
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, login, register, logout, refreshUser, setUser }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
