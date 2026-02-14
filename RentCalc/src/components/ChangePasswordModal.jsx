import React, { useState } from 'react';
import { FiX, FiEye, FiEyeOff } from 'react-icons/fi';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import '../styles/Modal.css';

const ChangePasswordModal = ({ onClose }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authAPI.changePassword({ oldPassword, newPassword });
      toast.success("Password updated!");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3>Change Password</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group">
              <label>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showOld ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required placeholder="Enter current password" />
                <span onClick={() => setShowOld(!showOld)} style={{ position: 'absolute', right: '10px', top: '35%', cursor: 'pointer' }}>{showOld ? <FiEyeOff /> : <FiEye />}</span>
              </div>
            </div>
            <div className="form-group">
              <label>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Enter new password" />
                <span onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: '10px', top: '35%', cursor: 'pointer' }}>{showNew ? <FiEyeOff /> : <FiEye />}</span>
              </div>
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type={showNew ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm new password" />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>{loading ? 'Updating...' : 'Update'}</button>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;