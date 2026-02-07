import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import UserSelect from '../components/UserSelect';
import RentForm from '../components/RentForm';
import RentHistory from '../components/RentHistory';
import UnpaidSummary from '../components/UnpaidSummary';
import BulkPayment from '../components/BulkPayment';
import NotificationModal from '../components/NotificationModal';
import QRUpload from '../components/QRUpload';
import Loading from '../components/Loading';
import { usersAPI, rentsAPI, notificationsAPI } from '../services/api';
import { sortRentsByDate } from '../utils/helpers';
import { DEFAULT_YEARS } from '../utils/constants';
import '../styles/Dashboard.css';
import '../styles/Modal.css';

const OwnerDashboard = () => {
  const { user } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showBulkPayment, setShowBulkPayment] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  
  // Year Management
  const [availableYears, setAvailableYears] = useState([...DEFAULT_YEARS]);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYear, setNewYear] = useState('');

  // Fetch QR - Using useCallback to prevent recreation
  const fetchQR = useCallback(async () => {
    if (!user?._id) {
      console.log('No user ID available for QR fetch');
      return;
    }
    
    setQrLoading(true);
    try {
      console.log('Fetching QR for owner ID:', user._id);
      const response = await usersAPI.getQR(user._id);
      console.log('QR Response:', response.data);
      
      if (response.data.qrImageUrl) {
        setQrUrl(response.data.qrImageUrl);
      } else {
        setQrUrl(null);
      }
    } catch (error) {
      console.error('Failed to fetch QR:', error);
      setQrUrl(null);
    } finally {
      setQrLoading(false);
    }
  }, [user?._id]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await usersAPI.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await notificationsAPI.getNotifications();
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  // Initial data load - runs when user is available
  useEffect(() => {
    if (user?._id) {
      console.log('User loaded, fetching initial data...');
      fetchUsers();
      fetchNotifications();
      fetchQR();
    }
  }, [user?._id, fetchUsers, fetchNotifications, fetchQR]);

  // Fetch history when user changes
  useEffect(() => {
    if (selectedUserId) {
      fetchHistory();
    } else {
      setHistory([]);
      setEditingEntry(null);
    }
  }, [selectedUserId]);

  const fetchHistory = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const response = await rentsAPI.getRents(selectedUserId);
      setHistory(sortRentsByDate(response.data));
    } catch (error) {
      console.error('Fetch history error:', error);
      toast.error('Failed to fetch rent history');
    } finally {
      setLoading(false);
    }
  };

  // Year Management
  const handleAddYear = () => {
    const year = parseInt(newYear);
    if (!year || year < 2070 || year > 2200) {
      toast.error('Invalid year. Enter a year between 2070 and 2200');
      return;
    }
    if (availableYears.includes(year)) {
      toast.error('This year already exists');
      return;
    }
    setAvailableYears(prev => [...prev, year].sort((a, b) => a - b));
    setNewYear('');
    setShowAddYear(false);
    toast.success(`Year ${year} added successfully`);
  };

  // User Management
  const handleUserSelect = (userId) => {
    setSelectedUserId(userId);
    setEditingEntry(null);
    setShowBulkPayment(false);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user and all their rent records?')) return;
    try {
      await usersAPI.deleteUser(userId);
      toast.success('User deleted successfully');
      setSelectedUserId('');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  // Rent Management
  const handleSubmitRent = async (formData) => {
    try {
      const rentData = {
        userId: selectedUserId,
        month: formData.month,
        year: parseInt(formData.year),
        rent: parseFloat(formData.rent) || 0,
        prevUnit: parseFloat(formData.prevElectricity) || 0,
        currUnit: parseFloat(formData.currElectricity) || 0,
        electricityRate: parseFloat(formData.electricityRate) || 0,
        water: parseFloat(formData.water) || 0,
        waste: parseFloat(formData.waste) || 0,
        internet: formData.internet === 'yes',
        internetAmount: parseFloat(formData.internetRate) || 0,
        total: parseFloat(formData.total) || 0,
        paymentStatus: formData.paymentStatus,
        paidAmount: parseFloat(formData.paidAmount) || 0,
        remainingAmount: parseFloat(formData.remainingAmount) || 0
      };

      if (editingEntry) {
        await rentsAPI.updateRent(editingEntry._id, rentData);
        toast.success('Rent entry updated successfully');
      } else {
        await rentsAPI.createRent(rentData);
        toast.success('Rent entry created successfully');
      }

      setEditingEntry(null);
      fetchHistory();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.error || 'Failed to save rent entry');
    }
  };

  const handleEditRent = (entry) => {
    setEditingEntry(entry);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRent = async (rentId) => {
    if (!window.confirm('Delete this rent entry?')) return;
    try {
      await rentsAPI.deleteRent(rentId);
      toast.success('Rent entry deleted');
      fetchHistory();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleBulkPayment = async (paymentData) => {
    try {
      await rentsAPI.applyBulkPayment({
        userId: selectedUserId,
        amount: paymentData.amount,
        surplusAction: paymentData.surplusAction
      });
      toast.success('Bulk payment applied successfully');
      setShowBulkPayment(false);
      fetchHistory();
    } catch (error) {
      toast.error('Failed to apply payment');
    }
  };

  // Notifications
  const handleNotificationClick = () => {
    setShowNotifications(true);
  };

  const handleDeleteNotification = async (id) => {
    try {
      await notificationsAPI.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleCloseNotifications = () => {
    setShowNotifications(false);
  };

  // QR Upload - This callback updates the local state AND refetches to confirm
  const handleQRUpload = async (qrImageUrl) => {
    console.log('QR uploaded, new URL:', qrImageUrl);
    setQrUrl(qrImageUrl);
    
    // Refetch to confirm it's saved
    setTimeout(() => {
      fetchQR();
    }, 1000);
  };

  const unpaidBills = history.filter(h => h.paymentStatus !== 'paid');
  const unreadNotifications = notifications.filter(n => !n.isRead).length;
  const selectedUser = users.find(u => u._id === selectedUserId);

  // Show loading if user is not yet available
  if (!user) {
    return <Loading text="Loading dashboard..." />;
  }

  return (
    <div className="dashboard">
      <Header 
        notificationCount={unreadNotifications}
        onNotificationClick={handleNotificationClick}
      />

      <div className="dashboard-content">
        {/* Owner Code */}
        {user?.ownerCode && (
          <div className="owner-code-banner">
            <strong>Your Owner Code:</strong>
            <code>{user.ownerCode}</code>
            <small>Share this code with tenants so they can register under you</small>
          </div>
        )}

        {/* QR Upload */}
        <div className="dashboard-section">
          {qrLoading ? (
            <Loading text="Loading QR code..." />
          ) : (
            <QRUpload 
              currentQR={qrUrl} 
              onUploadSuccess={handleQRUpload} 
            />
          )}
        </div>

        {/* Year Management */}
        <div className="dashboard-section">
          <h2>Year Management</h2>
          {!showAddYear ? (
            <button 
              type="button"
              className="btn-primary" 
              onClick={() => setShowAddYear(true)}
            >
              + Add New Year
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                placeholder="Enter year (e.g., 2091)"
                style={{ 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  border: '2px solid #e1e8ed', 
                  width: '200px',
                  fontSize: '14px'
                }}
              />
              <button type="button" className="btn-primary" onClick={handleAddYear}>
                Add Year
              </button>
              <button 
                type="button"
                className="btn-secondary" 
                onClick={() => { setShowAddYear(false); setNewYear(''); }}
              >
                Cancel
              </button>
            </div>
          )}
          <p style={{ marginTop: '12px', color: '#666', fontSize: '13px' }}>
            <strong>Available Years:</strong> {availableYears.join(', ')}
          </p>
        </div>

        {/* User Selection */}
        <div className="dashboard-section">
          <h2>Select Tenant</h2>
          <UserSelect
            users={users}
            selectedUserId={selectedUserId}
            onSelect={handleUserSelect}
            onDelete={handleDeleteUser}
            placeholder="-- Select a Tenant --"
          />
          {users.length === 0 && (
            <p style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
              No tenants registered yet. Share your owner code with tenants so they can register.
            </p>
          )}
        </div>

        {selectedUserId && (
          <>
            {/* Unpaid Summary */}
            <UnpaidSummary 
              unpaidBills={unpaidBills}
              onBulkPaymentClick={() => setShowBulkPayment(true)}
            />

            {/* Bulk Payment */}
            {showBulkPayment && (
              <div className="dashboard-section">
                <BulkPayment
                  unpaidBills={unpaidBills}
                  onApplyPayment={handleBulkPayment}
                  onCancel={() => setShowBulkPayment(false)}
                />
              </div>
            )}

            {/* Rent Form */}
            <div className="dashboard-section">
              <RentForm
                onSubmit={handleSubmitRent}
                initialData={editingEntry}
                history={history}
                isEditing={!!editingEntry}
                onCancel={() => setEditingEntry(null)}
                availableYears={availableYears}
              />
            </div>

            {/* Rent History */}
            <div className="dashboard-section">
              {loading ? (
                <Loading text="Loading rent history..." />
              ) : (
                <RentHistory
                  history={history}
                  userName={selectedUser?.name || 'User'}
                  onEdit={handleEditRent}
                  onDelete={handleDeleteRent}
                  showActions={true}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Notification Modal */}
      {showNotifications && (
        <NotificationModal
          notifications={notifications}
          onClose={handleCloseNotifications}
          onDelete={handleDeleteNotification}
          onMarkAllRead={handleMarkAllRead}
        />
      )}
    </div>
  );
};

export default OwnerDashboard;