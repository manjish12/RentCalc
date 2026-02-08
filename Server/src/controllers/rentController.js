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
    console.log('Received Rent Data:', req.body);
    
    const { 
      userId, month, year, rent, prevUnit, currUnit, electricityRate, 
      water, internet, internetAmount, waste, 
      multiMonths = 1, // Default to 1 if missing
      selectedInternetMonths = [] // Array of month names
    } = req.body;

    // Validation
    if (!userId || !month || !year) {
      return res.status(400).json({ error: 'userId, month, and year are required' });
    }

    // --- CALCULATION LOGIC START ---
    const createdRents = [];
    const startIdx = BS_MONTHS.indexOf(month);
    
    // Parse numbers
    const numYear = parseInt(year);
    const numRent = parseFloat(rent) || 0;
    const numWater = parseFloat(water) || 0;
    const numWaste = parseFloat(waste) || 0;
    const numElecRate = parseFloat(electricityRate) || 0;
    const numInternetAmt = parseFloat(internetAmount) || 0;
    
    let currentPrevUnit = parseFloat(prevUnit) || 0;
    const finalCurrUnit = parseFloat(currUnit) || 0;
    
    // Calculate total electricity used
    const totalElecUsage = Math.max(finalCurrUnit - currentPrevUnit, 0);
    // Distribute usage evenly per month
    const usagePerMonth = totalElecUsage / multiMonths;

    for (let i = 0; i < multiMonths; i++) {
      // 1. Calculate Month and Year (Handling Rollover)
      const currentMonthIdx = (startIdx + i) % 12;
      const yearOffset = Math.floor((startIdx + i) / 12);
      const currentYear = numYear + yearOffset;
      const currentMonthName = BS_MONTHS[currentMonthIdx];

      // 2. Check if entry already exists
      const existing = await Rent.findOne({ 
        userId, 
        month: currentMonthName, 
        year: currentYear 
      });

      if (existing) {
        // If it exists, we skip it or you could throw an error. 
        // For now, let's skip to avoid crashing the whole batch.
        console.warn(`Entry for ${currentMonthName} ${currentYear} already exists. Skipping.`);
        continue; 
      }

      // 3. Calculate Electricity for this specific month
      // If it's the last month, force exact match to final unit to avoid rounding errors
      let thisMonthCurrUnit;
      if (i === multiMonths - 1) {
        thisMonthCurrUnit = finalCurrUnit;
      } else {
        thisMonthCurrUnit = currentPrevUnit + usagePerMonth;
      }
      
      // Round to 2 decimal places
      thisMonthCurrUnit = Math.round(thisMonthCurrUnit * 100) / 100;
      currentPrevUnit = Math.round(currentPrevUnit * 100) / 100;

      // 4. Calculate Internet
      // Only charge internet if: global internet is YES AND this month is in the selected list
      const shouldChargeInternet = internet && selectedInternetMonths.includes(currentMonthName);
      const thisMonthInternetAmount = shouldChargeInternet ? numInternetAmt : 0;

      // 5. Calculate Total
      // (Rent + Water + Waste) + (Elec Usage * Rate) + Internet
      const thisMonthElecUsage = Math.max(thisMonthCurrUnit - currentPrevUnit, 0);
      const elecCost = thisMonthElecUsage * numElecRate;
      
      const monthlyTotal = numRent + numWater + numWaste + elecCost + thisMonthInternetAmount;

      // 6. Create Entry
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
        total: Math.round(monthlyTotal * 100) / 100, // Round total
        paymentStatus: 'unpaid',
        paidAmount: 0,
        remainingAmount: Math.round(monthlyTotal * 100) / 100
      });

      createdRents.push(newRent);

      // Prepare prev unit for next loop iteration
      currentPrevUnit = thisMonthCurrUnit;
    }
    // --- CALCULATION LOGIC END ---

    // --- SOCKET EMIT ---
    // Notify the tenant that data has changed
    const tenantSocketId = global.onlineUsers.get(userId.toString());
    if (tenantSocketId) {
      req.io.to(tenantSocketId).emit('rent-updated');
    }
    // -------------------
    
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

// ... Keep updateRent, deleteRent, applyBulkPayment, createBulkRents exactly as they were ...
// (I will include them below so you have the full file)

export const createBulkRents = async (req, res) => {
  // NOTE: This function is for when you send an array of FULL objects manually.
  // The createRent function above now handles the "1 form -> multiple entries" logic.
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
    // Basic recalculate logic if values changed
    const { rent, water, waste, prevUnit, currUnit, electricityRate, internetAmount } = req.body;
    
    // If these fields are present, recalculate total
    let newTotal = req.body.total;
    let newRemaining = req.body.remainingAmount;

    if (rent !== undefined && currUnit !== undefined) {
       const elecCost = (parseFloat(currUnit) - parseFloat(prevUnit)) * parseFloat(electricityRate);
       newTotal = parseFloat(rent) + parseFloat(water) + parseFloat(waste) + parseFloat(internetAmount || 0) + elecCost;
       
       // If it was unpaid, remaining = total
       if (req.body.paymentStatus === 'unpaid') newRemaining = newTotal;
       // If partial, remaining = total - paid
       else if (req.body.paymentStatus === 'partially_paid') newRemaining = newTotal - (parseFloat(req.body.paidAmount) || 0);
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

    // Handle Surplus if "deduct" is selected (Basic implementation)
    // In a real app, you might create a credit entry or subtract from next month
    if (remainingAmount > 0 && surplusAction === 'deduct') {
       // Logic to save credit could go here
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