import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '../utils/helpers';
import '../styles/BulkPayment.css';

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const round2 = (v) => Number(Number(v || 0).toFixed(2));

const BulkPayment = ({ unpaidBills = [], onApplyPayment, onCancel }) => {
  const [amount, setAmount] = useState('');
  const [distribution, setDistribution] = useState([]);
  const [surplus, setSurplus] = useState(0);
  const [surplusAction, setSurplusAction] = useState('deduct');

  // Sort bills oldest → newest (must match backend)
  const sortedUnpaidBills = useMemo(
    () =>
      [...unpaidBills]
        .filter((b) => b && Number(b.remainingAmount) > 0)
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return BS_MONTHS.indexOf(a.month) - BS_MONTHS.indexOf(b.month);
        }),
    [unpaidBills]
  );

  useEffect(() => {
    const numericAmount = parseFloat(amount);

    if (!numericAmount || numericAmount <= 0 || sortedUnpaidBills.length === 0) {
      setDistribution([]);
      setSurplus(0);
      return;
    }

    let remaining = round2(numericAmount);
    const rows = [];

    for (const bill of sortedUnpaidBills) {
      if (remaining <= 0) break;

      const due = round2(bill.remainingAmount);
      if (due <= 0) continue;

      const applied = round2(Math.min(remaining, due));
      const newDue = round2(due - applied);
      const newStatus = newDue === 0 ? 'paid' : 'partially_paid';

      rows.push({
        id: bill._id,
        month: bill.month,
        year: bill.year,
        previousDue: due,
        applied,
        newDue,
        newStatus
      });

      remaining = round2(remaining - applied);
    }

    setDistribution(rows);
    setSurplus(remaining > 0 ? remaining : 0);
  }, [amount, sortedUnpaidBills]);

  const handleApply = () => {
    const numericAmount = parseFloat(amount);
    if (!numericAmount || distribution.length === 0) return;

    onApplyPayment({
      amount: round2(numericAmount),
      distribution,     // only for UI/debug – backend recalculates
      surplus: round2(surplus),
      surplusAction
    });
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

      {distribution.length > 0 && (
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
              {distribution.map((row, i) => (
                <tr key={row.id || i}>
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
                  {/* <label className="radio-label">
                    <input
                      type="radio"
                      value="deduct"
                      checked={surplusAction === 'deduct'}
                      onChange={() => setSurplusAction('deduct')}
                    />
                    Deduct from next month
                  </label> */}
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
        <button
          className="btn-primary"
          onClick={handleApply}
          disabled={!amount || distribution.length === 0}
        >
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