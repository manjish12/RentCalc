import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiLogOut, FiUser, FiLock } from 'react-icons/fi';
import ChangePasswordModal from './ChangePasswordModal';
import '../styles/Header.css';

const Header = () => {
  const { user, logout } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">RentCalc</h1>
          <span className="header-role">{user?.role}</span>
        </div>
        <div className="header-right">
          <div className="header-user">
            <FiUser className="header-icon" />
            <span>{user?.name}</span>
          </div>
          <button type="button" className="header-logout-btn" onClick={() => setShowPasswordModal(true)} title="Change Password" style={{ background: '#f8f9fa', color: '#555', border: '1px solid #e1e8ed', marginRight: '5px' }}>
            <FiLock className="header-icon" />
          </button>
          <button type="button" className="header-logout-btn" onClick={handleLogout} title="Logout">
            <FiLogOut className="header-icon" />
          </button>
        </div>
      </header>
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </>
  );
};

export default Header;