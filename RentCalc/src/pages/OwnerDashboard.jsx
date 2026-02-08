import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext'; // Import socket
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

const OwnerDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket(); // Get socket
  
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
  
  const [availableYears, setAvailableYears] = useState([...DEFAULT_YEARS]);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYear, setNewYear] = useState('');

  // --- SOCKET LISTENER ---
  useEffect(() => {
    if (!socket) return;

    socket.on('new-notification', (newNotif) => {
      toast.success(`New Notification: ${newNotif.message}`);
      setNotifications(prev => [newNotif, ...prev]);
    });

    return () => socket.off('new-notification');
  }, [socket]);
  // -----------------------

  const fetchQR = useCallback(async () => {
    if (!user?._id) return;
    setQrLoading(true);
    try {
      const response = await usersAPI.getQR(user._id);
      setQrUrl(response.data.qrImageUrl || null);
    } catch (error) {
      console.error('Failed to fetch QR:', error);
    } finally {
      setQrLoading(false);
    }
  }, [user?._id]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await usersAPI.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await notificationsAPI.getNotifications();
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  useEffect(() => {
    if (user?._id) {
      fetchUsers();
      fetchNotifications();
      fetchQR();
    }
  }, [user?._id, fetchUsers, fetchNotifications, fetchQR]);

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
      toast.error('Failed to fetch rent history');
    } finally {
      setLoading(false);
    }
  };

  const handleAddYear = () => {
    const year = parseInt(newYear);
    if (!year || year < 2070 || year > 2200) {
      toast.error('Invalid year');
      return;
    }
    if (availableYears.includes(year)) {
      toast.error('Year exists');
      return;
    }
    setAvailableYears(prev => [...prev, year].sort((a, b) => a - b));
    setNewYear('');
    setShowAddYear(false);
    toast.success(`Year ${year} added`);
  };

  const handleUserSelect = (userId) => {
    setSelectedUserId(userId);
    setEditingEntry(null);
    setShowBulkPayment(false);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete user?')) return;
    try {
      await usersAPI.deleteUser(userId);
      toast.success('User deleted');
      setSelectedUserId('');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

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
        toast.success('Updated');
      } else {
        await rentsAPI.createRent(rentData);
        toast.success('Created');
      }

      setEditingEntry(null);
      fetchHistory();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save');
    }
  };

  const handleEditRent = (entry) => {
    setEditingEntry(entry);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRent = async (rentId) => {
    if (!window.confirm('Delete?')) return;
    try {
      await rentsAPI.deleteRent(rentId);
      toast.success('Deleted');
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
      toast.success('Payment applied');
      setShowBulkPayment(false);
      fetchHistory();
    } catch (error) {
      toast.error('Failed to apply');
    }
  };

  const handleDeleteNotification = async (id) => {
    try {
      await notificationsAPI.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      toast.error('Failed to mark read');
    }
  };

  const handleQRUpload = async (qrImageUrl) => {
    setQrUrl(qrImageUrl);
    setTimeout(() => fetchQR(), 1000);
  };

  const unpaidBills = history.filter(h => h.paymentStatus !== 'paid');
  const unreadNotifications = notifications.filter(n => !n.isRead).length;

  if (!user) return <Loading text="Loading..." />;

  return (
    <div className="dashboard">
      <Header notificationCount={unreadNotifications} onNotificationClick={() => setShowNotifications(true)} />
      <div className="dashboard-content">
        {user?.ownerCode && (
          <div className="owner-code-banner">
            <strong>Code:</strong> <code>{user.ownerCode}</code>
          </div>
        )}
        <div className="dashboard-section">
          {qrLoading ? <Loading text="Loading QR..." /> : <QRUpload currentQR={qrUrl} onUploadSuccess={handleQRUpload} />}
        </div>
        <div className="dashboard-section">
          <h2>Year Management</h2>
          {!showAddYear ? (
            <button className="btn-primary" onClick={() => setShowAddYear(true)}>+ Add Year</button>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="number" value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="Year" />
              <button className="btn-primary" onClick={handleAddYear}>Add</button>
              <button className="btn-secondary" onClick={() => setShowAddYear(false)}>Cancel</button>
            </div>
          )}
          <p>Available: {availableYears.join(', ')}</p>
        </div>
        <div className="dashboard-section">
          <h2>Select Tenant</h2>
          <UserSelect users={users} selectedUserId={selectedUserId} onSelect={handleUserSelect} onDelete={handleDeleteUser} />
        </div>
        {selectedUserId && (
          <>
            <UnpaidSummary unpaidBills={unpaidBills} onBulkPaymentClick={() => setShowBulkPayment(true)} />
            {showBulkPayment && (
              <div className="dashboard-section">
                <BulkPayment unpaidBills={unpaidBills} onApplyPayment={handleBulkPayment} onCancel={() => setShowBulkPayment(false)} />
              </div>
            )}
            <div className="dashboard-section">
              <RentForm onSubmit={handleSubmitRent} initialData={editingEntry} history={history} isEditing={!!editingEntry} onCancel={() => setEditingEntry(null)} availableYears={availableYears} />
            </div>
            <div className="dashboard-section">
              {loading ? <Loading /> : <RentHistory history={history} userName={users.find(u => u._id === selectedUserId)?.name} onEdit={handleEditRent} onDelete={handleDeleteRent} />}
            </div>
          </>
        )}
      </div>
      {showNotifications && <NotificationModal notifications={notifications} onClose={() => setShowNotifications(false)} onDelete={handleDeleteNotification} onMarkAllRead={handleMarkAllRead} />}
    </div>
  );
};

export default OwnerDashboard;