// src/components/DeleteAccountModal.jsx
import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiAlertTriangle, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../styles/Modal.css';

const DeleteAccountModal = ({ onClose }) => {
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async (e) => {
    e.preventDefault();
    
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    if (!window.confirm('This action cannot be undone. Are you absolutely sure?')) {
      return;
    }

    setLoading(true);
    try {
      await authAPI.deleteAccount({ password });
      await logout();
      toast.success('Account deleted successfully');
      if (onClose) onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete account. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content delete-account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-danger">
            <FiAlertTriangle /> Delete Account
          </h3>
        </div>

        <div className="modal-body">
          <div className="warning-box">
            <p><strong>Warning:</strong> This action cannot be undone.</p>
            <p>All your data will be permanently deleted including:</p>
            <ul>
              <li>Rent history and records</li>
              <li>Messages and notifications</li>
              {onClose?.user?.role === 'owner' && (
                <>
                  <li>All linked tenants</li>
                  <li>Custom years</li>
                </>
              )}
            </ul>
          </div>

          <form onSubmit={handleDelete}>
            <div className="form-group">
              <label htmlFor="password">
                <FiLock /> Enter your password to confirm:
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                autoFocus
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-danger" disabled={loading}>
                {loading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;