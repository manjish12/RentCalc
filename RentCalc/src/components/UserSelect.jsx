import React from 'react';
import { FiTrash2, FiUser } from 'react-icons/fi';
import '../styles/UserSelect.css';
const UserSelect = ({ 
  users = [], 
  selectedUserId, 
  onSelect, 
  onDelete,
  showDelete = true,
  placeholder = 'Select User'
}) => {
  const handleChange = (e) => {
    onSelect(e.target.value);
  };

  const handleDelete = () => {
    if (onDelete && selectedUserId) {
      onDelete(selectedUserId);
    }
  };

  return (
    <div className="user-select">
      <div className="select-wrapper">
        <FiUser className="select-icon" />
        <select value={selectedUserId} onChange={handleChange}>
          <option value="">{placeholder}</option>
          {users.map(user => (
            <option key={user._id} value={user._id}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
      </div>
      
      {showDelete && selectedUserId && onDelete && (
        <button 
          type="button"
          className="btn-danger"
          onClick={handleDelete}
        >
          <FiTrash2 /> Delete User
        </button>
      )}
    </div>
  );
};

export default UserSelect;
