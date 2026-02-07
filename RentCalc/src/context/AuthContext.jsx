import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize auth from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = localStorage.getItem('rentcalc_user');
        
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          
          // Check if token exists
          if (parsedUser.token) {
            // Set user immediately for better UX
            setUser(parsedUser);
            
            // Verify token validity with backend
            try {
              const response = await authAPI.getProfile();
              
              // Update user data with fresh info from server
              const updatedUser = {
                ...parsedUser,
                ...response.data,
                token: parsedUser.token // Keep the token
              };
              
              setUser(updatedUser);
              localStorage.setItem('rentcalc_user', JSON.stringify(updatedUser));
            } catch (error) {
              // Only clear user if token is actually invalid (401)
              if (error.response?.status === 401) {
                console.error('Token invalid, logging out');
                logout(false); // Don't show toast on auto-logout
              }
              // For other errors (network, etc), keep user logged in
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const userData = response.data;
      
      // Save to state and localStorage
      setUser(userData);
      localStorage.setItem('rentcalc_user', JSON.stringify(userData));
      
      toast.success('Login successful!');
      navigate('/');
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (formData) => {
    try {
      const response = await authAPI.register(formData);
      const userData = response.data;
      
      toast.success(
        `Registration successful! ${
          userData.role === 'owner' ? `Your owner code: ${userData.ownerCode}` : ''
        }`
      );
      
      // Don't auto-login after registration
      navigate('/login');
      return { success: true, data: userData };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = (showToast = true) => {
    setUser(null);
    localStorage.removeItem('rentcalc_user');
    if (showToast) {
      toast.success('Logged out successfully');
    }
    navigate('/login');
  };

  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('rentcalc_user', JSON.stringify(updatedUser));
  };

  // Check if user is still authenticated
  const checkAuth = () => {
    const savedUser = localStorage.getItem('rentcalc_user');
    if (!savedUser) return false;
    
    try {
      const parsedUser = JSON.parse(savedUser);
      return !!parsedUser.token;
    } catch {
      return false;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    checkAuth,
    isAuthenticated: !!user,
    isOwner: user?.role === 'owner',
    isTenant: user?.role === 'tenant'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};