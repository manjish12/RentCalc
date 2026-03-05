// utils/helpers.js
export const bsMonths = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export const getMonthIndex = (monthName) => {
  return bsMonths.indexOf(monthName);
};

export const getNextMonth = (currentMonth, currentYear) => {
  const monthIndex = getMonthIndex(currentMonth);
  const nextMonthIndex = (monthIndex + 1) % 12;
  const nextYear = nextMonthIndex === 0 ? currentYear + 1 : currentYear;
  
  return {
    month: bsMonths[nextMonthIndex],
    year: nextYear
  };
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace('NPR', 'Rs.');
};

export const calculateElectricityBill = (prevUnit, currUnit, rate) => {
  const usage = Math.max(currUnit - prevUnit, 0);
  return usage * rate;
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};