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
    rent = 0,
    water = 0,
    waste = 0,
    prevUnit = 0,
    currUnit = 0,
    electricityRate = 0,
    internet = false,
    internetAmount = 0,
    multiMonths = 1,
    selectedInternetMonths = new Set()
  } = data;

  const electricityUsage = Math.max(currUnit - prevUnit, 0);
  const electricityBill = electricityUsage * electricityRate;
  const recurringTotal = (parseFloat(rent) + parseFloat(water) + parseFloat(waste)) * multiMonths;
  
  let internetTotal = 0;
  if (internet) {
    // If it's a Set (from form) use .size, if it's Array (from saved data logic) use length, else fallback to multiMonths
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
  doc.text(`Period: ${entry.month} ${entry.year}`, 14, 35);
  doc.text(`Tenant: ${userName}`, 14, 42);
  
  let y = 55;
  doc.setFont(undefined, 'bold');
  doc.text("Details:", 14, y);
  doc.setFont(undefined, 'normal');
  y += 8;

  // Electricity Section
  doc.text(`Electricity Reading:`, 14, y);
  doc.text(`${entry.prevUnit} (Prev) -> ${entry.currUnit} (Curr)`, 80, y);
  y += 6;
  const unitsUsed = (entry.currUnit - entry.prevUnit).toFixed(2);
  const elecCost = (unitsUsed * entry.electricityRate).toFixed(2);
  doc.text(`Units Used: ${unitsUsed} @ Rs.${entry.electricityRate}/unit`, 14, y);
  doc.text(`Rs. ${elecCost}`, 160, y, null, null, 'right');
  y += 10;

  // Other Charges
  doc.text(`Monthly Rent:`, 14, y);
  doc.text(`Rs. ${entry.rent.toFixed(2)}`, 160, y, null, null, 'right');
  y += 8;

  doc.text(`Water Charge:`, 14, y);
  doc.text(`Rs. ${entry.water.toFixed(2)}`, 160, y, null, null, 'right');
  y += 8;

  doc.text(`Waste Charge:`, 14, y);
  doc.text(`Rs. ${entry.waste.toFixed(2)}`, 160, y, null, null, 'right');
  y += 8;
  
  if (entry.internet && entry.internetAmount > 0) {
    doc.text(`Internet Charge:`, 14, y);
    doc.text(`Rs. ${entry.internetAmount.toFixed(2)}`, 160, y, null, null, 'right');
    y += 8;
  }
  
  // Line separator
  doc.line(14, y, 170, y);
  y += 10;

  // Totals
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Total Amount:`, 14, y);
  doc.text(`Rs. ${entry.total.toFixed(2)}`, 160, y, null, null, 'right');
  y += 12;

  doc.setFontSize(12);
  doc.text(`Payment Status:`, 14, y);
  doc.text(`${entry.paymentStatus.toUpperCase()}`, 160, y, null, null, 'right');
  y += 8;

  doc.text(`Paid Amount:`, 14, y);
  doc.text(`Rs. ${entry.paidAmount.toFixed(2)}`, 160, y, null, null, 'right');
  y += 8;

  doc.text(`Remaining Due:`, 14, y);
  doc.text(`Rs. ${entry.remainingAmount.toFixed(2)}`, 160, y, null, null, 'right');
  
  // Footer
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text("Thank you for your payment.", 105, 280, null, null, 'center');

  // Filename: rent_Name_Month_Year.pdf
  const filename = `rent_${userName.replace(/\s+/g, '_')}_${entry.month}_${entry.year}.pdf`;
  doc.save(filename);
};

export const generateCombinedPDF = (entries, userName) => {
  const doc = new jsPDF();
  
  // Sort entries from Oldest to Newest for the report
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return getMonthIndex(a.month) - getMonthIndex(b.month);
  });

  if (sortedEntries.length === 0) return;

  const startEntry = sortedEntries[0];
  const endEntry = sortedEntries[sortedEntries.length - 1];

  // Header
  doc.setFontSize(18);
  doc.text(`Rent History Statement`, 105, 20, null, null, 'center');
  
  doc.setFontSize(12);
  doc.text(`Tenant: ${userName}`, 14, 30);
  doc.text(`Period: ${startEntry.month} ${startEntry.year} to ${endEntry.month} ${endEntry.year}`, 14, 38);
  
  let y = 50;
  let grandTotal = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  
  sortedEntries.forEach((entry, index) => {
    // Check page break
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    
    // Entry Header (Background Highlight)
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 5, 182, 8, 'F');
    
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text(`${entry.month} ${entry.year}`, 16, y);
    doc.text(`Status: ${entry.paymentStatus}`, 150, y);
    y += 8;
    
    // Entry Details
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    
    // Row 1: Electricity
    const units = (entry.currUnit - entry.prevUnit).toFixed(2);
    const elecCost = (units * entry.electricityRate).toFixed(2);
    doc.text(`Electricity: ${entry.prevUnit} -> ${entry.currUnit} (${units} units @ ${entry.electricityRate}) = Rs.${elecCost}`, 20, y);
    y += 5;
    
    // Row 2: Fixed Charges
    let extras = `Rent: ${entry.rent} | Water: ${entry.water} | Waste: ${entry.waste}`;
    if (entry.internet && entry.internetAmount > 0) {
      extras += ` | Internet: ${entry.internetAmount}`;
    }
    doc.text(extras, 20, y);
    y += 6;
    
    // Row 3: Totals for this month
    doc.setFont(undefined, 'bold');
    doc.text(`Total: Rs. ${entry.total.toFixed(2)}   |   Paid: Rs. ${entry.paidAmount.toFixed(2)}   |   Due: Rs. ${entry.remainingAmount.toFixed(2)}`, 20, y);
    doc.setFont(undefined, 'normal');
    
    y += 10; // Space before next entry
    
    // Accumulate Grand Totals
    grandTotal += entry.total;
    totalPaid += entry.paidAmount;
    totalRemaining += entry.remainingAmount;
  });
  
  // Grand Summary Section at the bottom
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 10;
  
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('GRAND SUMMARY', 14, y);
  y += 10;
  
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.text(`Grand Total Amount:`, 14, y);
  doc.text(`Rs. ${grandTotal.toFixed(2)}`, 100, y);
  y += 8;
  
  doc.text(`Total Paid:`, 14, y);
  doc.text(`Rs. ${totalPaid.toFixed(2)}`, 100, y);
  y += 8;
  
  doc.setFont(undefined, 'bold');
  doc.text(`Total Pending Due:`, 14, y);
  doc.setTextColor(200, 0, 0); // Red color for due
  doc.text(`Rs. ${totalRemaining.toFixed(2)}`, 100, y);
  doc.setTextColor(0, 0, 0); // Reset color
  
  // Filename: rent_Name_From_To.pdf
  const safeName = userName.replace(/\s+/g, '_');
  const filename = `rent_${safeName}_${startEntry.month}_${startEntry.year}_to_${endEntry.month}_${endEntry.year}.pdf`;
  
  doc.save(filename);
};