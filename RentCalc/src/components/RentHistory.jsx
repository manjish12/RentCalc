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

  const handleDeleteSelected = async () => {
    // Safety check: ensure onDelete exists
    if (!onDelete) return; 
    
    if (selectedEntries.size === 0 || !window.confirm(`Delete ${selectedEntries.size} entries?`)) return;
    
    for (const id of selectedEntries) {
      await onDelete(id);
    }
    setSelectedEntries(new Set());
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
            {/* Only show Delete button if onDelete is provided (Owner only) */}
            {onDelete && (
              <button 
                className="btn-danger btn-small" 
                onClick={handleDeleteSelected} 
                disabled={selectedEntries.size === 0}
              >
                <FiTrash2 /> Delete ({selectedEntries.size})
              </button>
            )}
            
            {/* Always show Download button for both Owner and Tenant */}
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
                  {/* Only show Edit button if onEdit is provided */}
                  {showActions && onEdit && (
                    <button className="btn-icon" onClick={() => onEdit(entry)} title="Edit">
                      <FiEdit2 />
                    </button>
                  )}
                  
                  {/* Only show Delete button if onDelete is provided */}
                  {showActions && onDelete && (
                    <button className="btn-icon btn-danger-icon" onClick={() => onDelete(entry._id)} title="Delete">
                      <FiTrash2 />
                    </button>
                  )}
                  
                  {/* Always show Single PDF download */}
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