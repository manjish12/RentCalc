import Rent from '../models/Rent.js';

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export const getRents = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    const rents = await Rent.find({ userId }).sort({ year: -1, month: 1 });
    res.json(rents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createRent = async (req, res) => {
  try {
    const { 
      userId, month, year, rent, prevUnit, currUnit, electricityRate, 
      water, internet, internetAmount, waste, 
      multiMonths = 1, 
      selectedInternetMonths = [],
      paymentStatus, // Get status from form
      paidAmount     // Get paid amount from form
    } = req.body;

    if (!userId || !month || !year) {
      return res.status(400).json({ error: 'userId, month, and year are required' });
    }

    const createdRents = [];
    const startIdx = BS_MONTHS.indexOf(month);
    
    const numYear = parseInt(year);
    const numRent = parseFloat(rent) || 0;
    const numWater = parseFloat(water) || 0;
    const numWaste = parseFloat(waste) || 0;
    const numElecRate = parseFloat(electricityRate) || 0;
    const numInternetAmt = parseFloat(internetAmount) || 0;
    
    let currentPrevUnit = parseFloat(prevUnit) || 0;
    const finalCurrUnit = parseFloat(currUnit) || 0;
    
    const totalElecUsage = Math.max(finalCurrUnit - currentPrevUnit, 0);
    const usagePerMonth = totalElecUsage / multiMonths;

    for (let i = 0; i < multiMonths; i++) {
      // 1. Calculate Month/Year
      const currentMonthIdx = (startIdx + i) % 12;
      const yearOffset = Math.floor((startIdx + i) / 12);
      const currentYear = numYear + yearOffset;
      const currentMonthName = BS_MONTHS[currentMonthIdx];

      // 2. Check duplicate
      const existing = await Rent.findOne({ userId, month: currentMonthName, year: currentYear });
      if (existing) continue; 

      // 3. Electricity Logic
      let thisMonthCurrUnit;
      if (i === multiMonths - 1) {
        thisMonthCurrUnit = finalCurrUnit;
      } else {
        thisMonthCurrUnit = currentPrevUnit + usagePerMonth;
      }
      
      thisMonthCurrUnit = Math.round(thisMonthCurrUnit * 100) / 100;
      currentPrevUnit = Math.round(currentPrevUnit * 100) / 100;

      // 4. Internet Logic
      const shouldChargeInternet = internet && selectedInternetMonths.includes(currentMonthName);
      const thisMonthInternetAmount = shouldChargeInternet ? numInternetAmt : 0;

      // 5. Total Calculation
      const thisMonthElecUsage = Math.max(thisMonthCurrUnit - currentPrevUnit, 0);
      const elecCost = thisMonthElecUsage * numElecRate;
      const monthlyTotal = numRent + numWater + numWaste + elecCost + thisMonthInternetAmount;
      const roundedTotal = Math.round(monthlyTotal * 100) / 100;

      // --- FIX: PAYMENT STATUS LOGIC ---
      let finalStatus = 'unpaid';
      let finalPaid = 0;
      let finalRemaining = roundedTotal;

      if (paymentStatus === 'paid') {
        finalStatus = 'paid';
        finalPaid = roundedTotal;
        finalRemaining = 0;
      } 
      // If single month and partial, we use the input amount
      else if (paymentStatus === 'partially_paid' && multiMonths === 1) {
        finalStatus = 'partially_paid';
        finalPaid = parseFloat(paidAmount) || 0;
        finalRemaining = roundedTotal - finalPaid;
      }
      // ---------------------------------

      const newRent = await Rent.create({
        userId,
        month: currentMonthName,
        year: currentYear,
        rent: numRent,
        prevUnit: currentPrevUnit,
        currUnit: thisMonthCurrUnit,
        electricityRate: numElecRate,
        water: numWater,
        waste: numWaste,
        internet: shouldChargeInternet,
        internetAmount: thisMonthInternetAmount,
        total: roundedTotal,
        paymentStatus: finalStatus, // Use calculated status
        paidAmount: finalPaid,      // Use calculated paid
        remainingAmount: finalRemaining // Use calculated remaining
      });

      createdRents.push(newRent);
      currentPrevUnit = thisMonthCurrUnit;
    }

    // Socket Emit
    const tenantSocketId = global.onlineUsers.get(userId.toString());
    if (tenantSocketId) {
      req.io.to(tenantSocketId).emit('rent-updated');
    }
    
    res.status(201).json({ 
      message: 'Rent entries created successfully', 
      count: createdRents.length,
      data: createdRents 
    });

  } catch (error) {
    console.error('Create rent error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createBulkRents = async (req, res) => {
  try {
    const { entries } = req.body;
    if (!entries || !Array.isArray(entries)) return res.status(400).json({ error: 'No entries' });

    const created = await Rent.insertMany(entries);
    
    if (entries.length > 0) {
      const tenantSocketId = global.onlineUsers.get(entries[0].userId.toString());
      if (tenantSocketId) req.io.to(tenantSocketId).emit('rent-updated');
    }

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRent = async (req, res) => {
  try {
    const { rent, water, waste, prevUnit, currUnit, electricityRate, internetAmount } = req.body;
    
    let newTotal = req.body.total;
    let newRemaining = req.body.remainingAmount;

    if (rent !== undefined && currUnit !== undefined) {
       const elecCost = (parseFloat(currUnit) - parseFloat(prevUnit)) * parseFloat(electricityRate);
       newTotal = parseFloat(rent) + parseFloat(water) + parseFloat(waste) + parseFloat(internetAmount || 0) + elecCost;
       
       if (req.body.paymentStatus === 'unpaid') newRemaining = newTotal;
       else if (req.body.paymentStatus === 'partially_paid') newRemaining = newTotal - (parseFloat(req.body.paidAmount) || 0);
       else if (req.body.paymentStatus === 'paid') newRemaining = 0;
    }

    const updatedRent = await Rent.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        total: newTotal,
        remainingAmount: newRemaining 
      },
      { new: true }
    );

    if (!updatedRent) return res.status(404).json({ error: 'Rent not found' });

    const tenantSocketId = global.onlineUsers.get(updatedRent.userId.toString());
    if (tenantSocketId) req.io.to(tenantSocketId).emit('rent-updated');

    res.json(updatedRent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRent = async (req, res) => {
  try {
    const rent = await Rent.findById(req.params.id);
    if (!rent) return res.status(404).json({ error: 'Rent not found' });

    const userId = rent.userId;
    await Rent.findByIdAndDelete(req.params.id);

    const tenantSocketId = global.onlineUsers.get(userId.toString());
    if (tenantSocketId) req.io.to(tenantSocketId).emit('rent-updated');

    res.json({ message: 'Rent deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const applyBulkPayment = async (req, res) => {
  try {
    const { userId, amount, surplusAction } = req.body;

    const unpaidRents = await Rent.find({ 
      userId, 
      paymentStatus: { $ne: 'paid' } 
    }).sort({ year: 1, month: 1 });

    if (unpaidRents.length === 0) {
      return res.status(400).json({ error: 'No unpaid rents found' });
    }

    let remainingAmount = parseFloat(amount);
    const updates = [];

    for (const rent of unpaidRents) {
      if (remainingAmount <= 0) break;

      const dueAmount = rent.remainingAmount;
      const paymentApplied = Math.min(remainingAmount, dueAmount);

      rent.paidAmount = (rent.paidAmount || 0) + paymentApplied;
      rent.remainingAmount = dueAmount - paymentApplied;
      rent.paymentStatus = rent.remainingAmount === 0 ? 'paid' : 'partially_paid';

      await rent.save();
      updates.push({ 
        rentId: rent._id, 
        month: rent.month, 
        year: rent.year, 
        paymentApplied 
      });

      remainingAmount -= paymentApplied;
    }

    const tenantSocketId = global.onlineUsers.get(userId.toString());
    if (tenantSocketId) req.io.to(tenantSocketId).emit('rent-updated');

    res.json({ 
      message: 'Bulk payment applied successfully', 
      updates, 
      surplus: remainingAmount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};