// src/components/EditProfileModal.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';
import { FiX, FiUser, FiMail } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../styles/Modal.css';

const EditProfileModal = ({ onClose }) => {
  const { user, updateUser } = useAuth();
  const [editForm, setEditForm] = useState({
    name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);

  // Initialize form with current user data
  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!editForm.name || !editForm.email) {
      toast.error('Name and email are required');
      return;
    }

    if (!validateEmail(editForm.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await usersAPI.updateProfile({
        name: editForm.name,
        email: editForm.email
      });

      // Update local user context
      await updateUser(response.data.user);
      
      toast.success('Profile updated successfully');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <FiUser /> Edit Profile
          </h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="edit-name">
              <FiUser /> Full Name *
            </label>
            <input
              type="text"
              id="edit-name"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-email">
              <FiMail /> Email Address *
            </label>
            <input
              type="email"
              id="edit-email"
              value={editForm.email}
              onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;