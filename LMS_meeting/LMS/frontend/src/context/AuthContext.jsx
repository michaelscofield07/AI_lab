import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Configure axios base url (uses relative path for proxy compliance)
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Configure Axios headers whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  // Sync theme to document element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch user profile on load if token exists
  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await axios.get('/api/auth/profile');
          setUser(res.data);
        } catch (err) {
          console.error('Failed to fetch profile', err);
          // Token expired or invalid
          setToken('');
          setUser(null);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      setToken(res.data.token);
      setUser({
        _id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role,
      });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Login failed. Please try again.',
      };
    }
  };

  const register = async (name, email, password, role) => {
    try {
      const res = await axios.post('/api/auth/register', { name, email, password, role });
      setToken(res.data.token);
      setUser({
        _id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role,
      });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Registration failed. Please try again.',
      };
    }
  };

  const logout = () => {
    setToken('');
    setUser(null);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        theme,
        login,
        register,
        logout,
        toggleTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
