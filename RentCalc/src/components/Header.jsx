import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiLogOut, FiUser, FiLock } from 'react-icons/fi';
import ChangePasswordModal from './ChangePasswordModal';
import '../styles/Header.css';

const Header = () => {
  const { user, logout } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
  };

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">RentCalc</h1>
          <span className="header-role">{user?.role}</span>
        </div>

        {/* Hamburger for small screens */}
        <button
          type="button"
          className={`header-menu-toggle ${menuOpen ? 'open' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Right side: user + actions */}
        <div className={`header-right ${menuOpen ? 'open' : ''}`}>
          <div className="header-user">
            <FiUser className="header-icon" />
            <span>{user?.name}</span>
          </div>

          <div className="header-menu-row">
            <button
              type="button"
              className="header-logout-btn header-change-password-btn"
              onClick={() => {
                setShowPasswordModal(true);
                setMenuOpen(false);
              }}
              title="Change Password"
            >
              <FiLock className="header-icon" />
            </button>
            {/* Text label visible only in mobile view */}
            <span className="header-menu-label">Change Password</span>
          </div>

          <div className="header-menu-row">
            <button
              type="button"
              className="header-logout-btn"
              onClick={(e) => {
                handleLogout(e);
                setMenuOpen(false);
              }}
              title="Logout"
            >
              <FiLogOut className="header-icon" />
            </button>
            {/* Text label visible only in mobile view */}
            <span className="header-menu-label">Logout</span>
          </div>
        </div>
      </header>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </>
  );
};

export default Header;