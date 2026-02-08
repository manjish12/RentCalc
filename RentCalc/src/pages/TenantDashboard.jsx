import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import RentHistory from '../components/RentHistory';
import Loading from '../components/Loading';
import ChatWidget from '../components/ChatWidget';
import { rentsAPI, usersAPI, notificationsAPI } from '../services/api';
import { sortRentsByDate, formatCurrency } from '../utils/helpers'; // Removed generateCombinedPDF import
import { FiDollarSign, FiX, FiCheck } from 'react-icons/fi'; // Removed FiDownload import
import '../styles/Dashboard.css';
import '../styles/Modal.css';

const TenantDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [notifying, setNotifying] = useState(false);
  const [ownerName, setOwnerName] = useState('Owner');

  useEffect(() => {
    if (!socket) return;
    socket.on('rent-updated', () => {
      toast('Your rent details have been updated', { icon: '🔄' });
      fetchHistory();
    });
    return () => socket.off('rent-updated');
  }, [socket]);

  useEffect(() => {
    if (user?._id) {
      fetchHistory();
      fetchOwnerDetails();
    }
  }, [user]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await rentsAPI.getRents(user._id);
      setHistory(sortRentsByDate(response.data));
    } catch (error) {
      console.error('Fetch history error:', error);
      toast.error('Failed to fetch rent history');
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnerDetails = async () => {
    try {
      if (user?.linkedOwnerId) {
        const ownerRes = await usersAPI.getUser(user.linkedOwnerId);
        setOwnerName(ownerRes.data.name);
        setQrUrl(ownerRes.data.qrImageUrl);
      }
    } catch (error) {
      console.error('Fetch owner details error:', error);
    }
  };

  const handlePayRent = (entry) => {
    setSelectedEntry(entry);
    setShowPaymentModal(true);
  };

  const handleCloseModal = () => {
    setShowPaymentModal(false);
    setSelectedEntry(null);
  };

  const handleNotifyOwner = async () => {
    if (!selectedEntry) return;
    setNotifying(true);
    const now = new Date().toLocaleString();
    const message = `Payment notification for ${selectedEntry.month} ${selectedEntry.year} - Amount: ${formatCurrency(selectedEntry.remainingAmount)} - Sent on ${now}`;

    try {
      await notificationsAPI.createNotification({ message, type: 'payment' });
      toast.success('Owner has been notified of your payment!');
      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to notify owner');
    } finally {
      setNotifying(false);
    }
  };

  const totalDue = history.filter(h => h.paymentStatus !== 'paid').reduce((sum, h) => sum + (h.remainingAmount || 0), 0);
  const totalPaid = history.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
  const unpaidEntries = history.filter(h => h.paymentStatus !== 'paid');

  return (
    <div className="dashboard">
      <Header />

      <div className="dashboard-content">
        
        {/* Summary Section */}
        <div className="summary-cards">
          <div className="summary-card">
            <h3>Total Paid</h3>
            <p className="amount paid">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="summary-card">
            <h3>Total Due</h3>
            <p className="amount due">{formatCurrency(totalDue)}</p>
          </div>
        </div>

        {/* Pending Payments Section */}
        {unpaidEntries.length > 0 && (
          <div className="dashboard-section">
            <div className="unpaid-entries">
              <h3>Pending Payments</h3>
              <div className="pending-list">
                {unpaidEntries.map(entry => (
                  <div key={entry._id} className="pending-item">
                    <span><strong>{entry.month} {entry.year}</strong>: {formatCurrency(entry.remainingAmount)}</span>
                    <button type="button" className="btn-primary btn-small" onClick={() => handlePayRent(entry)}><FiDollarSign /> Pay Now</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rent History Table */}
        <div className="dashboard-section">
          {loading ? (
            <Loading text="Loading your rent history..." />
          ) : (
            <RentHistory 
              history={history} 
              userName={user?.name || 'User'} 
              showActions={true} /* Enable Checkboxes & Bulk Download */
              onEdit={null}      /* Disable Edit */
              onDelete={null}    /* Disable Delete */
            />
          )}
        </div>
      </div>

      {showPaymentModal && selectedEntry && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Pay Rent</h3>
              <button type="button" className="modal-close" onClick={handleCloseModal}><FiX /></button>
            </div>
            <div className="modal-body">
              <p className="payment-amount">{formatCurrency(selectedEntry.remainingAmount)}</p>
              <p className="payment-period">For: {selectedEntry.month} {selectedEntry.year}</p>
              {qrUrl ? (
                <div className="qr-display"><p>Scan to pay:</p><img src={qrUrl} alt="QR Code" /></div>
              ) : (
                <p className="no-qr">No QR code available.</p>
              )}
            </div>
            <div className="modal-footer">
              <div className="payment-actions">
                <button type="button" className="btn-primary" onClick={handleNotifyOwner} disabled={notifying} style={{ width: '100%' }}>
                  <FiCheck /> {notifying ? 'Sending...' : "I've Paid - Notify Owner"}
                </button>
                <button type="button" className="btn-secondary" onClick={handleCloseModal} style={{ width: '100%' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHAT WIDGET */}
      <ChatWidget 
        receiverId={user?.linkedOwnerId} 
        receiverName={ownerName} 
      />
    </div>
  );
};

export default TenantDashboard;