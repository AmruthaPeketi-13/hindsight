import { useState, useEffect } from 'react';
import { AuthContext } from './auth';
import { api } from '../api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('hindsight_token');
      const username = localStorage.getItem('hindsight_username');
      if (token && username) {
        // Verify token is still valid against the server
        try {
          const response = await fetch(api('/api/auth/me'), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setUser({ username: data.username || username, token });
          } else {
            localStorage.removeItem('hindsight_token');
            localStorage.removeItem('hindsight_username');
          }
        } catch (error) {
          // If server is unreachable, still restore session from storage
          console.warn('Auth check failed, restoring session from storage', error);
          setUser({ username, token });
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = (token, username) => {
    localStorage.setItem('hindsight_token', token);
    localStorage.setItem('hindsight_username', username);
    setUser({ username, token });
  };

  const logout = () => {
    localStorage.removeItem('hindsight_token');
    localStorage.removeItem('hindsight_username');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
