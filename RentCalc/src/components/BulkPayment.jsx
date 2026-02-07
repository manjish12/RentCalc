import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/helpers';
import '../styles/BulkPayment.css';
const BulkPayment = ({ unpaidBills, onApplyPayment, onCancel }) => {
  const [amount, setAmount] = useState('');
  const [results, setResults] = useState([]);
  const [surplus, setSurplus] = useState(0);
  const [surplusAction, setSurplusAction] = useState('deduct');

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setResults([]);
      setSurplus(0);
      return;
    }

    let remaining = parseFloat(amount);
    const distribution = [];

    for (const bill of unpaidBills) {
      if (remaining <= 0) break;

      const dueAmount = bill.remainingAmount;
      const applied = Math.min(remaining, dueAmount);

      distribution.push({
        id: bill._id,
        month: bill.month,
        year: bill.year,
        previousDue: dueAmount,
        applied,
        newDue: dueAmount - applied,
        newStatus: (dueAmount - applied) <= 0 ? 'paid' : 'partially_paid'
      });

      remaining -= applied;
    }

    setResults(distribution);
    setSurplus(remaining > 0 ? remaining : 0);
  }, [amount, unpaidBills]);

  const handleApply = () => {
    if (!amount || results.length === 0) return;
    onApplyPayment({ amount: parseFloat(amount), distribution: results, surplus, surplusAction });
  };

  return (
    <div className="bulk-payment">
      <h3>Apply Bulk Payment</h3>
      
      <div className="form-row">
        <label>Payment Amount (Rs.)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount received"
          min="0"
          step="0.01"
        />
      </div>

      {results.length > 0 && (
        <div className="distribution-preview">
          <h4>Payment Distribution:</h4>
          <table className="distribution-table">
            <thead>
              <tr>
                <th>Month/Year</th>
                <th>Previous Due</th>
                <th>Applied</th>
                <th>New Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i}>
                  <td>{row.month}/{row.year}</td>
                  <td>{formatCurrency(row.previousDue)}</td>
                  <td className="applied">{formatCurrency(row.applied)}</td>
                  <td>{formatCurrency(row.newDue)}</td>
                  <td>
                    <span className={`status-badge status-${row.newStatus}`}>
                      {row.newStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {surplus > 0 && (
            <div className="surplus-section">
              <div className="surplus-amount">
                <strong>Surplus Amount:</strong> {formatCurrency(surplus)}
              </div>
              <div className="form-row">
                <label>What to do with surplus?</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="deduct"
                      checked={surplusAction === 'deduct'}
                      onChange={() => setSurplusAction('deduct')}
                    />
                    Deduct from next month
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="return"
                      checked={surplusAction === 'return'}
                      onChange={() => setSurplusAction('return')}
                    />
                    Return to tenant
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bulk-payment-actions">
        <button className="btn-primary" onClick={handleApply} disabled={!amount || results.length === 0}>
          Apply Payment
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default BulkPayment;