import React, { useState, useEffect } from 'react';
import { BS_MONTHS, DEFAULT_YEARS, PAYMENT_STATUS } from '../utils/constants';
import { getAvailableMonths, calculateTotal } from '../utils/helpers';
import '../styles/RentForm.css';

const RentForm = ({ 
  onSubmit, 
  initialData = null, 
  history = [],
  isEditing = false,
  onCancel,
  availableYears = DEFAULT_YEARS
}) => {
  const [form, setForm] = useState({
    month: '',
    year: '',
    rent: '',
    water: '',
    waste: '',
    prevElectricity: '',
    currElectricity: '',
    electricityRate: '',
    internet: 'no',
    internetRate: '',
    paymentStatus: PAYMENT_STATUS.PAID,
    paidAmount: '', // Starts empty
    remainingAmount: ''
  });
  
  const [multiMonths, setMultiMonths] = useState(1);
  const [selectedInternetMonths, setSelectedInternetMonths] = useState(new Set());
  const [total, setTotal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form
  useEffect(() => {
    if (initialData) {
      setForm({
        month: initialData.month || '',
        year: initialData.year?.toString() || '',
        rent: initialData.rent?.toString() || '',
        water: initialData.water?.toString() || '',
        waste: initialData.waste?.toString() || '',
        prevElectricity: initialData.prevUnit?.toString() || '',
        currElectricity: initialData.currUnit?.toString() || '',
        electricityRate: initialData.electricityRate?.toString() || '',
        internet: initialData.internet ? 'yes' : 'no',
        internetRate: initialData.internetAmount?.toString() || '',
        paymentStatus: initialData.paymentStatus || PAYMENT_STATUS.PAID,
        paidAmount: initialData.paidAmount?.toString() || '',
        remainingAmount: initialData.remainingAmount?.toString() || ''
      });
    }
  }, [initialData]);

  // Auto-fill
  useEffect(() => {
    if (!isEditing && history.length > 0 && !initialData) {
      const lastEntry = history[0];
      setForm(prev => ({
        ...prev,
        prevElectricity: lastEntry.currUnit?.toString() || '',
        rent: lastEntry.rent?.toString() || '',
        electricityRate: lastEntry.electricityRate?.toString() || '',
        water: lastEntry.water?.toString() || '',
        waste: lastEntry.waste?.toString() || ''
      }));
    }
  }, [history, isEditing, initialData]);

  // Handle Internet Month Selection Default
  useEffect(() => {
    if (form.internet === 'yes') {
      const months = getCalculationMonths();
      setSelectedInternetMonths(new Set(months));
    }
  }, [multiMonths, form.month, form.internet]);

  // --- CHANGED LOGIC HERE FOR 0 VS EMPTY ---
  useEffect(() => {
    const calculatedTotal = calculateTotal({
      rent: parseFloat(form.rent) || 0,
      water: parseFloat(form.water) || 0,
      waste: parseFloat(form.waste) || 0,
      prevUnit: parseFloat(form.prevElectricity) || 0,
      currUnit: parseFloat(form.currElectricity) || 0,
      electricityRate: parseFloat(form.electricityRate) || 0,
      internet: form.internet === 'yes',
      internetAmount: parseFloat(form.internetRate) || 0,
      multiMonths,
      selectedInternetMonths
    });

    setTotal(calculatedTotal);

    if (form.paymentStatus === PAYMENT_STATUS.PAID) {
      // If Paid, Paid = Total, Remaining = 0
      setForm(prev => ({ ...prev, paidAmount: calculatedTotal.toString(), remainingAmount: '0' }));
    } else if (form.paymentStatus === PAYMENT_STATUS.UNPAID) {
      // If Unpaid, Paid = 0, Remaining = Total
      setForm(prev => ({ ...prev, paidAmount: '0', remainingAmount: calculatedTotal.toString() }));
    } else {
      // If Partially Paid
      // Only calculate remaining based on what is typed. 
      // If nothing typed (empty string), treat as 0 for calculation but keep string empty
      const currentPaid = form.paidAmount === '' ? 0 : parseFloat(form.paidAmount);
      const remaining = Math.max(calculatedTotal - currentPaid, 0);
      
      setForm(prev => ({ 
        ...prev, 
        // We DO NOT set paidAmount here, we let the user type it.
        remainingAmount: remaining.toString() 
      }));
    }
  }, [form.rent, form.water, form.waste, form.prevElectricity, form.currElectricity, 
      form.electricityRate, form.internet, form.internetRate, form.paymentStatus, 
      form.paidAmount, multiMonths, selectedInternetMonths]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'prevElectricity' && history.length > 0 && !isEditing) return;
    
    setForm(prev => {
      const newForm = { ...prev, [name]: value };
      
      // If switching TO Partially Paid, clear the paid amount so it's not "0"
      if (name === 'paymentStatus' && value === PAYMENT_STATUS.PARTIALLY_PAID) {
        newForm.paidAmount = ''; 
      }
      
      if (name === 'internet' && value === 'no') {
        newForm.internetRate = '';
        setSelectedInternetMonths(new Set());
      }
      return newForm;
    });
  };

  const getCalculationMonths = () => {
    if (!form.month) return [];
    const startIdx = BS_MONTHS.indexOf(form.month);
    const months = [];
    for (let i = 0; i < multiMonths; i++) {
      months.push(BS_MONTHS[(startIdx + i) % 12]);
    }
    return months;
  };

  const handleInternetMonthToggle = (monthName) => {
    const newSelected = new Set(selectedInternetMonths);
    if (newSelected.has(monthName)) newSelected.delete(monthName);
    else newSelected.add(monthName);
    setSelectedInternetMonths(newSelected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.month || !form.year) { alert('Please select month and year'); return; }
    
    setIsSubmitting(true);
    try {
      // If paidAmount is empty string, send 0 to backend
      const payload = {
        ...form,
        paidAmount: form.paidAmount === '' ? '0' : form.paidAmount,
        multiMonths,
        selectedInternetMonths: Array.from(selectedInternetMonths),
        total
      };

      await onSubmit(payload);
      
      if (!isEditing) {
        setForm(prev => ({ ...prev, month: '', currElectricity: '', paidAmount: '', remainingAmount: '' }));
        setMultiMonths(1);
        setSelectedInternetMonths(new Set());
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const months = getAvailableMonths(form.year, history, isEditing);

  return (
    <form onSubmit={handleSubmit} className="rent-form">
      <h2>{isEditing ? 'Edit' : 'Add'} Rent Entry</h2>

      {!isEditing && (
        <div className="form-row">
          <label>Rent Duration</label>
          <select value={multiMonths} onChange={(e) => setMultiMonths(parseInt(e.target.value))}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
              <option key={n} value={n}>{n} Month{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div className="form-row-group">
        <div className="form-row">
          <label>Year *</label>
          <select name="year" value={form.year} onChange={handleChange} required>
            <option value="">Select Year</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>Start Month *</label>
          <select name="month" value={form.month} onChange={handleChange} required disabled={!form.year}>
            <option value="">Select Month</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row-group">
        <div className="form-row">
          <label>Monthly Rent (Rs.) *</label>
          <input type="number" name="rent" value={form.rent} onChange={handleChange} required min="0" step="0.01" />
        </div>
        <div className="form-row">
          <label>Water (Rs.) *</label>
          <input type="number" name="water" value={form.water} onChange={handleChange} required min="0" step="0.01" />
        </div>
        <div className="form-row">
          <label>Waste (Rs.) *</label>
          <input type="number" name="waste" value={form.waste} onChange={handleChange} required min="0" step="0.01" />
        </div>
      </div>

      <div className="form-row-group">
        <div className="form-row">
          <label>Prev. Electricity {history.length > 0 && !isEditing && '(Auto)'}</label>
          <input 
            type="number" name="prevElectricity" value={form.prevElectricity} onChange={handleChange} 
            required min="0" readOnly={history.length > 0 && !isEditing}
            style={{ backgroundColor: history.length > 0 && !isEditing ? '#f0f0f0' : 'white' }}
          />
        </div>
        <div className="form-row">
          <label>Curr. Electricity *</label>
          <input type="number" name="currElectricity" value={form.currElectricity} onChange={handleChange} required min="0" />
        </div>
        <div className="form-row">
          <label>Rate (Rs./unit) *</label>
          <input type="number" name="electricityRate" value={form.electricityRate} onChange={handleChange} required min="0" step="0.01" />
        </div>
      </div>

      <div className="form-row">
        <label>Internet</label>
        <div className="radio-group">
          <label className="radio-label">
            <input type="radio" name="internet" value="yes" checked={form.internet === 'yes'} onChange={handleChange} /> Yes
          </label>
          <label className="radio-label">
            <input type="radio" name="internet" value="no" checked={form.internet === 'no'} onChange={handleChange} /> No
          </label>
        </div>
      </div>

      {form.internet === 'yes' && form.month && (
        <div className="form-row internet-section">
          <label>Internet Rate (Rs./month)</label>
          <input 
            type="number" name="internetRate" value={form.internetRate} 
            onChange={(e) => setForm(prev => ({ ...prev, internetRate: e.target.value }))}
            required min="0" step="0.01"
          />
          <div className="internet-months">
            <label className="internet-months-label">Select Months:</label>
            <div className="internet-months-grid">
              {getCalculationMonths().map((monthName) => (
                <label key={monthName} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedInternetMonths.has(monthName)}
                    onChange={() => handleInternetMonthToggle(monthName)}
                  />
                  {monthName}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="form-row">
        <label>Payment Status</label>
        <select name="paymentStatus" value={form.paymentStatus} onChange={handleChange} required>
          <option value={PAYMENT_STATUS.PAID}>Paid</option>
          <option value={PAYMENT_STATUS.UNPAID}>Unpaid</option>
          <option value={PAYMENT_STATUS.PARTIALLY_PAID}>Partially Paid</option>
        </select>
      </div>

      {form.paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID && (
        <div className="partial-payment">
          <div className="form-row">
            <label>Paid Amount</label>
            <input 
              type="number" 
              name="paidAmount" 
              value={form.paidAmount} 
              onChange={handleChange} 
              required 
              min="0" 
              placeholder="Enter amount"
            />
          </div>
          <div className="form-row">
            <label>Remaining</label>
            <input type="number" name="remainingAmount" value={form.remainingAmount} readOnly style={{ backgroundColor: '#e9ecef' }} />
          </div>
        </div>
      )}

      <div className="total-display">
        <h3>Total: Rs. {total.toFixed(2)}</h3>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
        </button>
        {isEditing && onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  );
};

export default RentForm;