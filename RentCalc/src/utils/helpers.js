import { jsPDF } from 'jspdf';
import { BS_MONTHS } from './constants';

export const getMonthIndex = (monthName) => BS_MONTHS.indexOf(monthName);

export const formatCurrency = (amount) => `Rs. ${parseFloat(amount || 0).toFixed(2)}`;

export const sortRentsByDate = (rents) => {
  return [...rents].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return getMonthIndex(b.month) - getMonthIndex(a.month);
  });
};

export const getAvailableMonths = (year, history, isEditing = false) => {
  if (!year) return [];
  if (isEditing) return BS_MONTHS;
  const usedMonths = history.filter(h => h.year === parseInt(year)).map(h => h.month);
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
  const internetTotal = internet ? internetAmount * (selectedInternetMonths.size || multiMonths) : 0;

  return recurringTotal + electricityBill + internetTotal;
};

export const generateSinglePDF = (entry, userName) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`Rent Receipt - ${entry.month} ${entry.year}`, 14, 20);
  
  doc.setFontSize(12);
  doc.text(`Tenant: ${userName}`, 14, 35);
  
  let y = 50;
  doc.text(`Previous Unit: ${entry.prevUnit} units`, 14, y); y += 8;
  doc.text(`Current Unit: ${entry.currUnit} units`, 14, y); y += 8;
  doc.text(`Units Used: ${(entry.currUnit - entry.prevUnit).toFixed(1)} units`, 14, y); y += 8;
  doc.text(`Electricity Rate: Rs. ${entry.electricityRate}/unit`, 14, y); y += 8;
  doc.text(`Electricity Bill: Rs. ${((entry.currUnit - entry.prevUnit) * entry.electricityRate).toFixed(2)}`, 14, y); y += 12;
  doc.text(`Monthly Rent: Rs. ${entry.rent}`, 14, y); y += 8;
  doc.text(`Water Bill: Rs. ${entry.water}`, 14, y); y += 8;
  doc.text(`Waste Fee: Rs. ${entry.waste}`, 14, y); y += 8;
  
  if (entry.internet && entry.internetAmount > 0) {
    doc.text(`Internet: Rs. ${entry.internetAmount}`, 14, y); y += 8;
  }
  
  y += 8;
  doc.setFontSize(14);
  doc.text(`Total: Rs. ${entry.total}`, 14, y); y += 10;
  doc.setFontSize(12);
  doc.text(`Payment Status: ${entry.paymentStatus}`, 14, y); y += 8;
  doc.text(`Paid Amount: Rs. ${entry.paidAmount}`, 14, y); y += 8;
  doc.text(`Remaining: Rs. ${entry.remainingAmount}`, 14, y);
  
  doc.save(`rent_${userName}_${entry.month}_${entry.year}.pdf`);
};

export const generateCombinedPDF = (entries, userName) => {
  const doc = new jsPDF();
  const sorted = sortRentsByDate(entries).reverse();
  
  doc.setFontSize(16);
  doc.text(`Rent History - ${userName}`, 14, 20);
  
  let y = 35;
  let total = 0;
  
  sorted.forEach((entry) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.text(`${entry.month} ${entry.year}: Rs. ${entry.total} (${entry.paymentStatus})`, 14, y);
    y += 8;
    total += entry.total;
  });
  
  y += 10;
  doc.setFontSize(14);
  doc.text(`Grand Total: Rs. ${total.toFixed(2)}`, 14, y);
  
  doc.save(`rent_history_${userName}.pdf`);
};