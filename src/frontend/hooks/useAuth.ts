import { useState, useEffect } from 'react';

const AUTH_KEY = 'solana-playground-auth';
const CORRECT_PASSWORD = 'f09e8b8a8fc1';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check localStorage on mount
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const login = (inputPassword: string) => {
    if (inputPassword === CORRECT_PASSWORD) {
      localStorage.setItem(AUTH_KEY, CORRECT_PASSWORD);
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setPassword('');
  };

  return {
    isAuthenticated,
    password,
    setPassword,
    error,
    login,
    logout,
  };
}
