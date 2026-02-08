import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import RentHistory from '../components/RentHistory';
import Loading from '../components/Loading';
import ChatWidget from '../components/ChatWidget'; // Import Chat
import { rentsAPI, usersAPI, notificationsAPI } from '../services/api';
import { sortRentsByDate, formatCurrency, generateCombinedPDF } from '../utils/helpers';
import { FiDollarSign, FiX, FiCheck, FiDownload } from 'react-icons/fi';
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

  // --- SOCKET LISTENER ---
  useEffect(() => {
    if (!socket) return;

    socket.on('rent-updated', () => {
      toast('Your rent details have been updated', { icon: '🔄' });
      fetchHistory();
    });

    return () => socket.off('rent-updated');
  }, [socket]);
  // -----------------------

  useEffect(() => {
    if (user?._id) {
      fetchHistory();
      fetchQR();
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

  const fetchQR = async () => {
    try {
      if (user?.linkedOwnerId) {
        const response = await usersAPI.getQR(user.linkedOwnerId);
        setQrUrl(response.data.qrImageUrl);
      }
    } catch (error) {
      console.error('Fetch QR error:', error);
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

  const handleDownloadReport = () => {
    if (history.length === 0) {
      toast.error('No history to download');
      return;
    }
    generateCombinedPDF(history, user.name);
    toast.success('Downloading full report...');
  };

  const totalDue = history.filter(h => h.paymentStatus !== 'paid').reduce((sum, h) => sum + (h.remainingAmount || 0), 0);
  const totalPaid = history.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
  const unpaidEntries = history.filter(h => h.paymentStatus !== 'paid');

  return (
    <div className="dashboard">
      <Header />

      <div className="dashboard-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button 
            className="btn-primary" 
            onClick={handleDownloadReport}
            disabled={history.length === 0}
          >
            <FiDownload /> Download Full Statement
          </button>
        </div>

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

        <div className="dashboard-section">
          {loading ? (
            <Loading text="Loading your rent history..." />
          ) : (
            <RentHistory
              history={history}
              userName={user?.name || 'User'}
              showActions={false}
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

      {/* CHAT WIDGET - Connects to linked owner */}
      <ChatWidget 
        receiverId={user?.linkedOwnerId} 
        receiverName="Owner" 
      />
    </div>
  );
};

export default TenantDashboard;