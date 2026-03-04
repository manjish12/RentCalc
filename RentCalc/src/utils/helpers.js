import { jsPDF } from 'jspdf';
import { BS_MONTHS } from './constants';

export const getMonthIndex = (monthName) => {
  return BS_MONTHS.indexOf(monthName);
};

export const formatCurrency = (amount) => {
  return `Rs. ${parseFloat(amount || 0).toFixed(2)}`;
};

export const sortRentsByDate = (rents) => {
  return [...rents].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return getMonthIndex(b.month) - getMonthIndex(a.month);
  });
};

export const getAvailableMonths = (year, history, isEditing = false) => {
  if (!year) return [];
  if (isEditing) return BS_MONTHS;
  const usedMonths = history
    .filter(h => h.year === parseInt(year))
    .map(h => h.month);
  return BS_MONTHS.filter(m => !usedMonths.includes(m));
};

export const calculateTotal = (data) => {
  const {
    rent = 0, water = 0, waste = 0, prevUnit = 0, currUnit = 0,
    electricityRate = 0, internet = false, internetAmount = 0,
    multiMonths = 1, selectedInternetMonths = new Set()
  } = data;

  const electricityUsage = Math.max(currUnit - prevUnit, 0);
  const electricityBill = electricityUsage * electricityRate;
  const recurringTotal = (parseFloat(rent) + parseFloat(water) + parseFloat(waste)) * multiMonths;
  
  let internetTotal = 0;
  if (internet) {
    const internetCount = selectedInternetMonths.size || selectedInternetMonths.length || multiMonths;
    internetTotal = internetAmount * internetCount;
  }

  return recurringTotal + electricityBill + internetTotal;
};

// --- PDF GENERATION FUNCTIONS ---

export const generateSinglePDF = (entry, userName) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`Rent Receipt`, 105, 20, null, null, 'center');
  
  doc.setFontSize(12);
  doc.text(`Tenant: ${userName}`, 14, 30);
  doc.text(`Period: ${entry.month} ${entry.year}`, 14, 38);
  
  let y = 50;

  // --- HEADER BAR ---
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y - 6, 182, 9, 'F');
  
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  
  // Left: Month Year
  doc.text(`${entry.month} ${entry.year}`, 16, y);
  
  // Middle: "Units" Label (Inside Gray Bar)
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Units", 60, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');

  // Right: Status
  doc.text(`${entry.paymentStatus.toUpperCase()}`, 190, y, null, null, 'right');
  y += 12;
  
  // --- DETAILS ---
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  
  // Electricity
  const units = (entry.currUnit - entry.prevUnit).toFixed(2);
  const elecCost = (units * entry.electricityRate).toFixed(2);
  
  doc.text(`Electricity:`, 20, y);
  doc.text(`${entry.prevUnit} to ${entry.currUnit}`, 60, y); 
  doc.text(`(${units} units x Rs.${entry.electricityRate})`, 110, y);
  doc.text(`Rs. ${elecCost}`, 190, y, null, null, 'right');
  y += 8;

  // Charges
  const addRow = (label, value) => {
    doc.text(`${label}:`, 20, y);
    doc.text(`Rs. ${parseFloat(value).toFixed(2)}`, 190, y, null, null, 'right');
    y += 6;
  };

  addRow('Rent', entry.rent);
  addRow('Water', entry.water);
  addRow('Waste', entry.waste);

  if (entry.internet && entry.internetAmount > 0) {
    addRow('Internet', entry.internetAmount);
  }
  
  // Line
  y += 2;
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 10;

  // Totals
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Total:`, 20, y);
  doc.text(`Rs. ${entry.total.toFixed(2)}`, 190, y, null, null, 'right');
  y += 8;

  doc.setFont(undefined, 'normal');
  doc.text(`Paid:`, 20, y);
  doc.text(`Rs. ${entry.paidAmount.toFixed(2)}`, 190, y, null, null, 'right');
  y += 8;

  if (entry.remainingAmount > 0) doc.setTextColor(200, 0, 0);
  doc.text(`Due:`, 20, y);
  doc.text(`Rs. ${entry.remainingAmount.toFixed(2)}`, 190, y, null, null, 'right');
  doc.setTextColor(0, 0, 0);
  
  // ✅ FIXED: Clean filename with spaces preserved and original casing
  const filename = `${userName} - ${entry.month} ${entry.year}.pdf`;
  doc.save(filename);
};

export const generateCombinedPDF = (entries, userName) => {
  const doc = new jsPDF();
  
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return getMonthIndex(a.month) - getMonthIndex(b.month);
  });

  if (sortedEntries.length === 0) return;

  const startEntry = sortedEntries[0];
  const endEntry = sortedEntries[sortedEntries.length - 1];

  doc.setFontSize(18);
  doc.text(`Rent History Statement`, 105, 20, null, null, 'center');
  
  doc.setFontSize(12);
  doc.text(`Tenant: ${userName}`, 14, 30);
  doc.text(`Period: ${startEntry.month} ${startEntry.year} to ${endEntry.month} ${endEntry.year}`, 14, 38);
  
  let y = 50;
  let grandTotal = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  
  sortedEntries.forEach((entry) => {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    
    // --- ENTRY HEADER (Gray Bar) ---
    doc.setFillColor(245, 245, 245);
    doc.rect(14, y - 6, 182, 9, 'F');
    
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    // 1. Month Year
    doc.text(`${entry.month} ${entry.year}`, 16, y);
    
    // 2. "Units" Label inside Header
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Units", 60, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');

    // 3. Status
    doc.text(`${entry.paymentStatus.toUpperCase()}`, 190, y, null, null, 'right');
    y += 12;
    
    // --- DETAILS ---
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    // Electricity Row
    const units = (entry.currUnit - entry.prevUnit).toFixed(2);
    const elecCost = (units * entry.electricityRate).toFixed(2);
    
    doc.text(`Electricity:`, 20, y);
    doc.text(`${entry.prevUnit} to ${entry.currUnit}`, 60, y); 
    doc.text(`(${units} units x Rs.${entry.electricityRate})`, 110, y);
    doc.text(`Rs. ${elecCost}`, 190, y, null, null, 'right');
    y += 6;

    // Fixed Charges
    const addRow = (label, value) => {
      doc.text(`${label}:`, 20, y);
      doc.text(`Rs. ${parseFloat(value).toFixed(2)}`, 190, y, null, null, 'right');
      y += 6;
    };

    addRow('Rent', entry.rent);
    addRow('Water', entry.water);
    addRow('Waste', entry.waste);

    if (entry.internet && entry.internetAmount > 0) {
      addRow('Internet', entry.internetAmount);
    }
    
    // Line
    doc.setLineWidth(0.1);
    doc.line(20, y, 190, y);
    y += 6;

    // Month Totals
    doc.setFont(undefined, 'bold');
    doc.text(`Total:`, 20, y);
    doc.text(`Rs. ${entry.total.toFixed(2)}`, 190, y, null, null, 'right');
    y += 6;

    doc.setFont(undefined, 'normal');
    doc.text(`Paid:`, 20, y);
    doc.text(`Rs. ${entry.paidAmount.toFixed(2)}`, 190, y, null, null, 'right');
    y += 6;

    if (entry.remainingAmount > 0) doc.setTextColor(200, 0, 0);
    doc.text(`Due:`, 20, y);
    doc.text(`Rs. ${entry.remainingAmount.toFixed(2)}`, 190, y, null, null, 'right');
    doc.setTextColor(0, 0, 0);
    
    y += 15;
    
    grandTotal += entry.total;
    totalPaid += entry.paidAmount;
    totalRemaining += entry.remainingAmount;
  });
  
  // Grand Summary
  if (y > 200) {
    doc.addPage();
    y = 20;
  }
  
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 10;
  
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('GRAND SUMMARY', 105, y, null, null, 'center');
  y += 10;
  
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.text(`Grand Total Amount:`, 20, y);
  doc.text(`Rs. ${grandTotal.toFixed(2)}`, 190, y, null, null, 'right');
  y += 8;
  
  doc.text(`Total Paid:`, 20, y);
  doc.text(`Rs. ${totalPaid.toFixed(2)}`, 190, y, null, null, 'right');
  y += 8;
  
  doc.setFont(undefined, 'bold');
  doc.text(`Total Pending Due:`, 20, y);
  doc.setTextColor(200, 0, 0); 
  doc.text(`Rs. ${totalRemaining.toFixed(2)}`, 190, y, null, null, 'right');
  doc.setTextColor(0, 0, 0); 
  
  // ✅ FIXED: Clean filename with spaces preserved and original casing
  const filename = sortedEntries.length === 1
    ? `${userName} - ${startEntry.month} ${startEntry.year}.pdf`
    : `${userName} - ${startEntry.month} ${startEntry.year} to ${endEntry.month} ${endEntry.year}.pdf`;
  
  doc.save(filename);
};
