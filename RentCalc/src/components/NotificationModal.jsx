import React from 'react';
import { FiX, FiTrash2, FiClock } from 'react-icons/fi';
import '../styles/Modal.css';
const NotificationModal = ({ notifications = [], onClose, onDelete, onMarkAllRead }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
  };

  const handleMarkAllRead = (e) => {
    e.preventDefault();
    if (onMarkAllRead) {
      onMarkAllRead();
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Notifications ({notifications.length})</h3>
          <button 
            type="button" 
            className="modal-close" 
            onClick={onClose}
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>
        
        <div className="modal-body">
          {notifications.length === 0 ? (
            <p className="no-notifications">No notifications yet</p>
          ) : (
            <>
              {unreadCount > 0 && (
                <button 
                  type="button"
                  className="btn-secondary btn-small" 
                  onClick={handleMarkAllRead}
                  style={{ marginBottom: '16px', width: '100%' }}
                >
                  Mark All as Read ({unreadCount} unread)
                </button>
              )}
              
              <ul className="notification-list">
                {notifications.map(notification => (
                  <li 
                    key={notification._id} 
                    className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
                  >
                    <div className="notification-content">
                      <strong>{notification.tenantId?.name || 'Unknown Tenant'}</strong>
                      <p>{notification.message}</p>
                      <small className="notification-time">
                        <FiClock /> {formatDate(notification.createdAt)}
                      </small>
                    </div>
                    <button 
                      type="button"
                      className="btn-icon btn-danger-icon"
                      onClick={(e) => handleDelete(e, notification._id)}
                      aria-label="Delete notification"
                    >
                      <FiTrash2 />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;