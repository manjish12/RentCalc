import React, { useState } from 'react';
import { FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
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

  // --- BULK DELETE LOGIC ---
  const handleDeleteSelected = async () => {
    if (!onDelete) return; 
    
    // Single Alert for Bulk Action
    if (window.confirm(`Are you sure you want to delete these ${selectedEntries.size} records? This cannot be undone.`)) {
      // Loop through and delete without asking again
      for (const id of selectedEntries) {
        await onDelete(id);
      }
      setSelectedEntries(new Set());
    }
  };

  // --- SINGLE DELETE LOGIC ---
  const handleSingleDelete = async (id) => {
    if (!onDelete) return;
    
    // Single Alert for Single Action
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
                  
                  <button className="btn-icon" onClick={() => generateSinglePDF(entry, userName)} title="Download">
                    <FiDownload />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RentHistory;