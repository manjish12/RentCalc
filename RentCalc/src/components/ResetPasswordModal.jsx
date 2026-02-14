import React, { useState } from 'react';
import { FiX, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { usersAPI } from '../services/api';
import toast from 'react-hot-toast';
import '../styles/Modal.css';

const ResetPasswordModal = ({ tenantId, tenantName, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await usersAPI.resetTenantPassword(tenantId, newPassword);
      toast.success(`Password reset for ${tenantName}`);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3>Reset Password</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        
        <div className="modal-body">
          <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
            Set a new password for <strong>{tenantName}</strong>. They will be forced to change it upon next login.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div className="form-group">
              <label>New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Enter new password"
                  style={{ width: '100%', padding: '10px', paddingRight: '40px' }}
                />
                <span 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#888' }}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input 
                type={showPassword ? "text" : "password"} 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
                style={{ width: '100%', padding: '10px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="submit" className="btn-danger" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                <FiLock /> {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;