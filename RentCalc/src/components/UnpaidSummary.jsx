import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import { formatCurrency } from '../utils/helpers';
import '../styles/UnpaidSummary.css';
const UnpaidSummary = ({ unpaidBills, onBulkPaymentClick }) => {
  if (!unpaidBills || unpaidBills.length === 0) return null;

  const totalDue = unpaidBills.reduce((sum, bill) => sum + (bill.remainingAmount || 0), 0);

  return (
    <div className="unpaid-summary">
      <div className="summary-header">
        <FiAlertCircle className="alert-icon" />
        <strong>Unpaid Bills:</strong>
      </div>
      
      <div className="summary-items">
        {unpaidBills.map((bill, i) => (
          <span key={i} className="summary-item">
            {bill.month} {bill.year}: {formatCurrency(bill.remainingAmount)}
          </span>
        ))}
      </div>
      
      <div className="summary-footer">
        <span className="total-due">Total Due: {formatCurrency(totalDue)}</span>
        {onBulkPaymentClick && (
          <button className="btn-primary btn-small" onClick={onBulkPaymentClick}>
            Apply Bulk Payment
          </button>
        )}
      </div>
    </div>
  );
};

export default UnpaidSummary;