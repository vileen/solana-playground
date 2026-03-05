import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean | null;
  password: string;
  setPassword: (password: string) => void;
  error: string;
  login: (inputPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Normalize API URL - ensure it ends with /api but doesn't duplicate it
const rawApiUrl = import.meta.env.VITE_API_URL || '';
const API_URL = rawApiUrl.replace(/\/$/, '').replace(/\/api$/, '') + '/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/status`, {
        credentials: 'include',
      });
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
    } catch {
      setIsAuthenticated(false);
    }
  };

  const login = async (inputPassword: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: inputPassword }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setError('');
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid password');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setIsAuthenticated(false);
      setPassword('');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        password,
        setPassword,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
