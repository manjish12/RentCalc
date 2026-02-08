import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import UserSelect from '../components/UserSelect';
import RentForm from '../components/RentForm';
import RentHistory from '../components/RentHistory';
import UnpaidSummary from '../components/UnpaidSummary';
import BulkPayment from '../components/BulkPayment';
import QRUpload from '../components/QRUpload';
import Loading from '../components/Loading';
import ChatWidget from '../components/ChatWidget'; 
import { usersAPI, rentsAPI, yearsAPI } from '../services/api'; // Added yearsAPI
import { sortRentsByDate, formatCurrency } from '../utils/helpers';
import { DEFAULT_YEARS } from '../utils/constants';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import '../styles/Dashboard.css';

const OwnerDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showBulkPayment, setShowBulkPayment] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  
  // Year Management State
  const [customYears, setCustomYears] = useState([]);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [isYearSubmitting, setIsYearSubmitting] = useState(false);

  // Combine Default + Custom Years, unique and sorted
  const allAvailableYears = Array.from(new Set([...DEFAULT_YEARS, ...customYears.map(y => y.year)])).sort((a, b) => a - b);

  // --- SOCKET LISTENER ---
  useEffect(() => {
    if (!socket) return;
    socket.on('new-notification', (newNotif) => {
      toast.success(`New Notification: ${newNotif.message}`);
    });
    return () => socket.off('new-notification');
  }, [socket]);
  // -----------------------

  // --- INITIAL DATA FETCH ---
  const fetchCustomYears = useCallback(async () => {
    try {
      const response = await yearsAPI.getYears();
      setCustomYears(response.data);
    } catch (error) {
      console.error('Failed to fetch years:', error);
    }
  }, []);

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

  useEffect(() => {
    if (user?._id) {
      fetchUsers();
      fetchQR();
      fetchCustomYears();
    }
  }, [user?._id, fetchUsers, fetchQR, fetchCustomYears]);

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

  // --- YEAR MANAGEMENT HANDLERS ---
  const handleAddYear = async () => {
    const year = parseInt(newYear);
    if (!year || year < 2070 || year > 2200) {
      toast.error('Invalid year (2070-2200)');
      return;
    }
    if (allAvailableYears.includes(year)) {
      toast.error('Year already exists');
      return;
    }

    setIsYearSubmitting(true);
    try {
      await yearsAPI.addYear(year);
      await fetchCustomYears(); 
      setNewYear('');
      setShowAddYear(false); // Close input after adding
      toast.success(`Year ${year} added`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add year');
    } finally {
      setIsYearSubmitting(false);
    }
  };

  const handleDeleteYear = async (id) => {
    if (!window.confirm('Delete this year from list?')) return;
    try {
      await yearsAPI.deleteYear(id);
      setCustomYears(prev => prev.filter(y => y._id !== id));
      toast.success('Year deleted');
    } catch (error) {
      toast.error('Failed to delete year');
    }
  };

  // --- RENT & USER HANDLERS ---
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
        multiMonths: formData.multiMonths || 1,
        selectedInternetMonths: formData.selectedInternetMonths || [],
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

  const handleQRUpload = async (qrImageUrl) => {
    setQrUrl(qrImageUrl);
    setTimeout(() => fetchQR(), 1000);
  };

  const unpaidBills = history.filter(h => h.paymentStatus !== 'paid');
  const totalPaid = history.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
  const totalDue = history.reduce((sum, h) => sum + (h.remainingAmount || 0), 0);
  const selectedUser = users.find(u => u._id === selectedUserId);

  if (!user) return <Loading text="Loading..." />;

  return (
    <div className="dashboard">
      <Header />
      
      <div className="dashboard-content">
        {user?.ownerCode && (
          <div className="owner-code-banner">
            <strong>Code:</strong> <code>{user.ownerCode}</code>
          </div>
        )}

        <div className="dashboard-section">
          {qrLoading ? <Loading text="Loading QR..." /> : <QRUpload currentQR={qrUrl} onUploadSuccess={handleQRUpload} />}
        </div>

        {/* --- YEAR MANAGEMENT SECTION --- */}
        <div className="dashboard-section">
          <h2>Year Management</h2>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {!showAddYear ? (
              <button 
                className="btn-primary btn-small" 
                onClick={() => setShowAddYear(true)}
              >
                <FiPlus /> Add New Year
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="number" 
                  value={newYear} 
                  onChange={(e) => setNewYear(e.target.value)} 
                  placeholder="Enter year (e.g., 2095)" 
                  style={{ padding: '8px', borderRadius: '6px', border: '2px solid #e1e8ed', width: '140px' }}
                />
                <button 
                  className="btn-primary btn-small" 
                  onClick={handleAddYear} 
                  disabled={isYearSubmitting}
                >
                  {isYearSubmitting ? 'Saving...' : 'Add'}
                </button>
                <button 
                  className="btn-secondary btn-small" 
                  onClick={() => { setShowAddYear(false); setNewYear(''); }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {/* Default Years (Read-only) */}
            {DEFAULT_YEARS.map(y => (
              <span key={y} style={{ padding: '6px 12px', background: '#e1e8ed', borderRadius: '20px', fontSize: '13px', color: '#666' }}>
                {y}
              </span>
            ))}
            
            {/* Custom Years (Deletable) */}
            {customYears.map(y => (
              <span key={y._id} style={{ 
                padding: '6px 12px', 
                background: '#d4edda', 
                border: '1px solid #c3e6cb', 
                borderRadius: '20px', 
                fontSize: '13px', 
                color: '#155724', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}>
                {y.year}
                <FiTrash2 
                  size={12} 
                  style={{ cursor: 'pointer', color: '#dc3545' }} 
                  onClick={() => handleDeleteYear(y._id)} 
                  title="Remove year"
                />
              </span>
            ))}
          </div>
        </div>
        {/* ------------------------------- */}

        <div className="dashboard-section">
          <h2>Select Tenant</h2>
          <UserSelect users={users} selectedUserId={selectedUserId} onSelect={handleUserSelect} onDelete={handleDeleteUser} />
        </div>

        {selectedUserId && (
          <>
            <div className="summary-cards">
              <div className="summary-card">
                <h3>Total Paid by {selectedUser?.name}</h3>
                <p className="amount paid">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="summary-card">
                <h3>Total Due from {selectedUser?.name}</h3>
                <p className="amount due">{formatCurrency(totalDue)}</p>
              </div>
            </div>

            <UnpaidSummary unpaidBills={unpaidBills} onBulkPaymentClick={() => setShowBulkPayment(true)} />
            
            {showBulkPayment && (
              <div className="dashboard-section">
                <BulkPayment unpaidBills={unpaidBills} onApplyPayment={handleBulkPayment} onCancel={() => setShowBulkPayment(false)} />
              </div>
            )}
            
            <div className="dashboard-section">
              <RentForm 
                onSubmit={handleSubmitRent} 
                initialData={editingEntry} 
                history={history} 
                isEditing={!!editingEntry} 
                onCancel={() => setEditingEntry(null)} 
                availableYears={allAvailableYears} // Pass all years to form
              />
            </div>
            
            <div className="dashboard-section">
              {loading ? <Loading /> : (
                <RentHistory 
                  history={history} 
                  userName={selectedUser?.name} 
                  onEdit={handleEditRent} 
                  onDelete={handleDeleteRent} 
                />
              )}
            </div>
          </>
        )}
      </div>
      

      <ChatWidget 
        receiverId={selectedUserId} 
        receiverName={selectedUser?.name} 
      />
    </div>
  );
};

export default OwnerDashboard;