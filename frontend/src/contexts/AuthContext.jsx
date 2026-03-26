import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

function readStoredUser() {
  const stored = localStorage.getItem('user');
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Invalid stored user payload. Clearing local auth state.');
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return null;
  }
}

function persistValue(key, value) {
  if (typeof value === 'string' && value) {
    localStorage.setItem(key, value);
    return;
  }

  localStorage.removeItem(key);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refreshToken'));

  const saveAuth = ({ user, accessToken, refreshToken }) => {
    setUser(user);
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);

    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }

    persistValue('accessToken', accessToken);
    persistValue('refreshToken', refreshToken);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, saveAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
