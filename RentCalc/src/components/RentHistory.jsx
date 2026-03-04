import React, { useState } from 'react';
import { FiEdit2, FiTrash2, FiDownload, FiEye, FiX } from 'react-icons/fi';
import { PAYMENT_STATUS_LABELS } from '../utils/constants';
import { formatCurrency, generateSinglePDF, generateCombinedPDF } from '../utils/helpers';
import '../styles/RentHistory.css';

const RentHistory = ({ 
  history, 
  userName, 
  onEdit, 
  onDelete, 
  showActions = true 
}) => {
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [viewEntry, setViewEntry] = useState(null);

  if (!history || history.length === 0) {
    return <div className="rent-history empty"><p>No rent history found</p></div>;
  }

  const handleSelectAll = () => {
    if (selectedEntries.size === history.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(history.map(e => e._id)));
    }
  };

  const handleSelectEntry = (id) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEntries(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (!onDelete) return; 
    if (window.confirm(`Are you sure you want to delete these ${selectedEntries.size} records? This cannot be undone.`)) {
      for (const id of selectedEntries) {
        await onDelete(id);
      }
      setSelectedEntries(new Set());
    }
  };

  const handleSingleDelete = async (id) => {
    if (!onDelete) return;
    if (window.confirm("Are you sure you want to delete this entry?")) {
      await onDelete(id);
    }
  };

  const handleDownloadSelected = () => {
    if (selectedEntries.size === 0) return;
    generateCombinedPDF(history.filter(e => selectedEntries.has(e._id)), userName);
  };

  const getStatusClass = (status) => {
    if (status === 'paid') return 'status-paid';
    if (status === 'unpaid') return 'status-unpaid';
    return 'status-partial';
  };

  const getStatusColor = (status) => {
    if (status === 'paid') return '#00b894';
    if (status === 'unpaid') return '#e74c3c';
    return '#f39c12';
  };

  const units = viewEntry ? (viewEntry.currUnit - viewEntry.prevUnit).toFixed(1) : 0;
  const elecBill = viewEntry ? (units * viewEntry.electricityRate).toFixed(2) : 0;

  return (
    <div className="rent-history">
      <div className="history-header">
        <h2>Rent History</h2>
        
        {showActions && (
          <div className="bulk-actions">
            {onDelete && (
              <button 
                className="btn-danger btn-small" 
                onClick={handleDeleteSelected} 
                disabled={selectedEntries.size === 0}
              >
                <FiTrash2 /> Delete ({selectedEntries.size})
              </button>
            )}
            <button 
              className="btn-primary btn-small" 
              onClick={handleDownloadSelected} 
              disabled={selectedEntries.size === 0}
            >
              <FiDownload /> Download Selected PDF
            </button>
          </div>
        )}
      </div>

      <div className="history-table-wrapper">
        <table className="history-table">
          <thead>
            <tr>
              {showActions && (
                <th className="checkbox-cell">
                  <input 
                    type="checkbox" 
                    checked={selectedEntries.size === history.length} 
                    onChange={handleSelectAll} 
                  />
                </th>
              )}
              <th>Month/Year</th>
              <th>Electricity</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Remaining</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map(entry => (
              <tr key={entry._id}>
                {showActions && (
                  <td className="checkbox-cell">
                    <input 
                      type="checkbox" 
                      checked={selectedEntries.has(entry._id)} 
                      onChange={() => handleSelectEntry(entry._id)} 
                    />
                  </td>
                )}
                <td className="month-year">{entry.month} {entry.year}</td>
                <td className="electricity">
                  {entry.prevUnit} → {entry.currUnit}
                  <small>({(entry.currUnit - entry.prevUnit).toFixed(1)} units)</small>
                </td>
                <td>{formatCurrency(entry.total)}</td>
                <td style={{ color: '#00b894' }}>{formatCurrency(entry.paidAmount)}</td>
                <td style={{ color: '#e74c3c' }}>{formatCurrency(entry.remainingAmount)}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(entry.paymentStatus)}`}>
                    {PAYMENT_STATUS_LABELS[entry.paymentStatus]}
                  </span>
                </td>
                <td className="actions">
                  {/* View Button */}
                  <button
                    className="btn-icon btn-view-icon"
                    onClick={() => setViewEntry(entry)}
                    title="View Details"
                  >
                    <FiEye />
                  </button>

                  {showActions && onEdit && (
                    <button className="btn-icon" onClick={() => onEdit(entry)} title="Edit">
                      <FiEdit2 />
                    </button>
                  )}
                  
                  {showActions && onDelete && (
                    <button 
                      className="btn-icon btn-danger-icon" 
                      onClick={() => handleSingleDelete(entry._id)} 
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                  
                  <button className="btn-icon" onClick={() => generateSinglePDF(entry, userName)} title="Download PDF">
                    <FiDownload />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Details Modal */}
      {viewEntry && (
        <div className="view-modal-overlay" onClick={() => setViewEntry(null)}>
          <div className="view-modal" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="view-modal-header">
              <div className="view-modal-title">
                
                <h3>Rent Details</h3>
              </div>
              <button className="view-modal-close" onClick={() => setViewEntry(null)}>
                <FiX />
              </button>
            </div>

            <div className="view-modal-body">

              {/* Period & Status */}
              <div className="view-modal-row">
                <div className="view-detail-block">
                  <span className="view-label">Period</span>
                  <span className="view-value">{viewEntry.month} {viewEntry.year}</span>
                </div>
                <div className="view-detail-block">
                  <span className="view-label">Status</span>
                  <span
                    className={`status-badge ${getStatusClass(viewEntry.paymentStatus)}`}
                    style={{ fontSize: '13px' }}
                  >
                    {PAYMENT_STATUS_LABELS[viewEntry.paymentStatus]}
                  </span>
                </div>
              </div>

              {/* Rent */}
              <div className="view-modal-row">
                <div className="view-detail-block">
                  <span className="view-label">Rent</span>
                  <span className="view-value">{formatCurrency(viewEntry.rent)}</span>
                </div>
              </div>

              <div className="view-modal-divider" />

              {/* Electricity Section */}
              <p className="view-section-title">Electricity</p>
              <div className="view-modal-row">
                <div className="view-detail-block">
                  <span className="view-label">Previous Reading</span>
                  <span className="view-value">{viewEntry.prevUnit}</span>
                </div>
                <div className="view-detail-block">
                  <span className="view-label">Current Reading</span>
                  <span className="view-value">{viewEntry.currUnit}</span>
                </div>
              </div>
              <div className="view-modal-row">
                <div className="view-detail-block">
                  <span className="view-label">Units Consumed</span>
                  <span className="view-value">{units} units</span>
                </div>
                <div className="view-detail-block">
                  <span className="view-label">Electricity Bill</span>
                  <span className="view-value">{formatCurrency(elecBill)}</span>
                </div>
              </div>

              <div className="view-modal-divider" />

              {/* Other Charges */}
              <p className="view-section-title">Other Charges</p>
              <div className="view-modal-row">
                <div className="view-detail-block">
                  <span className="view-label">Water</span>
                  <span className="view-value">{formatCurrency(viewEntry.water)}</span>
                </div>
                <div className="view-detail-block">
                  <span className="view-label">Waste Management</span>
                  <span className="view-value">{formatCurrency(viewEntry.waste)}</span>
                </div>
              </div>
              {viewEntry.internet && (
                <div className="view-modal-row">
                  <div className="view-detail-block">
                    <span className="view-label">Internet</span>
                    <span className="view-value">{formatCurrency(viewEntry.internetAmount)}</span>
                  </div>
                </div>
              )}

              <div className="view-modal-divider" />

              {/* Payment Summary */}
              <div className="view-summary-box">
                <div className="view-summary-row">
                  <span>Total Amount</span>
                  <span className="view-summary-value">{formatCurrency(viewEntry.total)}</span>
                </div>
                <div className="view-summary-row">
                  <span>Amount Paid</span>
                  <span className="view-summary-value" style={{ color: '#00b894' }}>
                    {formatCurrency(viewEntry.paidAmount)}
                  </span>
                </div>
                <div className="view-summary-row">
                  <span>Remaining Due</span>
                  <span className="view-summary-value" style={{ color: '#e74c3c' }}>
                    {formatCurrency(viewEntry.remainingAmount)}
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="view-modal-dates">
                <span>Created: {new Date(viewEntry.createdAt).toLocaleDateString()}</span>
                {viewEntry.updatedAt && (
                  <span>Updated: {new Date(viewEntry.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="view-modal-footer">
              <button
                className="btn-primary"
                onClick={() => generateSinglePDF(viewEntry, userName)}
              >
                <FiDownload /> Download PDF
              </button>
              <button className="btn-secondary" onClick={() => setViewEntry(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RentHistory;