import React, { useState, useEffect } from 'react';
import { FiX, FiEye, FiEyeOff, FiClock, FiUser } from 'react-icons/fi';
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
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await authAPI.getPasswordHistory();
      setHistory(res.data);
    } catch (error) {
      console.error("Failed to load history");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword({ oldPassword, newPassword });
      toast.success("Password updated successfully!");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content compact-modal">
        <div className="modal-header compact-header">
          <h3>Change Password</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        
        <div className="modal-body no-scroll-body compact-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <div className="form-group compact-group">
              <label>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showOld ? "text" : "password"} 
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)} 
                  required 
                  placeholder="Enter current password"
                  className="compact-input"
                />
                <span onClick={() => setShowOld(!showOld)} className="password-eye-icon">
                  {showOld ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>
            </div>

            <div className="form-group compact-group">
              <label>New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showNew ? "text" : "password"} 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  placeholder="Enter new password"
                  className="compact-input"
                />
                <span onClick={() => setShowNew(!showNew)} className="password-eye-icon">
                  {showNew ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>
            </div>

            <div className="form-group compact-group">
              <label>Confirm New Password</label>
              <input 
                type={showNew ? "text" : "password"} 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
                placeholder="Confirm new password"
                className="compact-input"
              />
            </div>

            {/* PASSWORD HISTORY SECTION */}
            <div className="password-history-section compact-history">
              <h4 className="history-title">
                <FiClock style={{ marginBottom: '-2px' }} /> Change History
              </h4>
              <div className="history-list">
                {history.length === 0 ? (
                  <p className="no-history">No previous password changes.</p>
                ) : (
                  history.map((item, index) => (
                    <div key={index} className="history-item">
                      <div className="history-left">
                        <FiUser size={10} style={{ marginRight: '4px', color: '#888' }} />
                        <span className="history-user">{item.changedBy}</span>
                      </div>
                      <span className="history-date">{formatDate(item.changedAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                {loading ? 'Updating...' : 'Update'}
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

export default ChangePasswordModal;