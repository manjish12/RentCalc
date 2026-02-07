import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FiLogOut, FiBell, FiUser } from 'react-icons/fi';
import '../styles/Header.css';
const Header = ({ notificationCount = 0, onNotificationClick }) => {
  const { user, logout } = useAuth();

  const handleNotificationClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onNotificationClick) {
      onNotificationClick();
    }
  };

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
  };

  return (
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
        
        {user?.role === 'owner' && onNotificationClick && (
          <button 
            type="button"
            className="header-notification-btn"
            onClick={handleNotificationClick}
            aria-label="Notifications"
          >
            <FiBell className="header-icon" />
            {notificationCount > 0 && (
              <span className="notification-badge">{notificationCount}</span>
            )}
          </button>
        )}
        
        <button 
          type="button"
          className="header-logout-btn" 
          onClick={handleLogout}
        >
          <FiLogOut className="header-icon" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Header;