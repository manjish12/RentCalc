// controllers/rentController.js
import Rent from '../models/Rent.js';
import User from '../models/User.js';

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// ==========================================
// Helper: Send Notification (Socket + FCM Push)
// ==========================================
const sendRentNotification = async (userId, title, body, io) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return;
    }

    console.log('📤 Sending rent notification to:', userId);
    console.log('   Title:', title);
    console.log('   Body:', body);
    console.log('   Push Token exists:', !!user.pushToken);

    // 1. Socket.io Notification (For Web & Active App)
    const socketId = global.onlineUsers?.get(userId.toString());
    if (socketId && io) {
      io.to(socketId).emit('rent-updated', { 
        title: title, 
        message: body 
      });
      console.log('✅ Socket notification sent');
    }

    // 2. FCM Push Notification (For Mobile Background) - Dynamic Import
    if (user.pushToken) {
      try {
        // Dynamic import - works even if function is not exported
        const messageModule = await import('./messageController.js');
        
        // Try to get the sendFCMNotification function
        const sendFCMNotification = messageModule.sendFCMNotification || 
                                    messageModule.default?.sendFCMNotification;
        
        if (sendFCMNotification && typeof sendFCMNotification === 'function') {
          await sendFCMNotification(
            user.pushToken,
            title,
            body,
            { type: 'rent_update', userId: userId.toString() }
          );
          console.log('✅ Rent FCM notification sent to:', userId);
        } else {
          console.log('⚠️ sendFCMNotification function not found in messageController');
          console.log('   Available exports:', Object.keys(messageModule));
        }
      } catch (error) {
        console.error('❌ Error sending FCM push notification:', error.message);
      }
    } else {
      console.log('⚠️ No push token for user:', userId);
    }
  } catch (error) {
    console.error('Notification logic error:', error);
  }
};

// ==========================================
// Get Rents
// ==========================================
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

// ==========================================
// Create Rent (Single or Multi-Month)
// ==========================================
export const createRent = async (req, res) => {
  try {
    const { 
      userId, month, year, rent, prevUnit, currUnit, electricityRate, 
      water, internet, internetAmount, waste, 
      multiMonths = 1, 
      selectedInternetMonths = [],
      paymentStatus, 
      paidAmount 
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

    // --- PAYMENT DISTRIBUTION LOGIC ---
    let distributablePaidAmount = 0;
    if (paymentStatus === 'partially_paid') {
      distributablePaidAmount = parseFloat(paidAmount) || 0;
    }

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

      // 6. Apply Payment Logic
      let finalStatus = 'unpaid';
      let finalPaid = 0;
      let finalRemaining = roundedTotal;

      if (paymentStatus === 'paid') {
        finalStatus = 'paid';
        finalPaid = roundedTotal;
        finalRemaining = 0;
      } 
      else if (paymentStatus === 'partially_paid') {
        finalPaid = Math.min(distributablePaidAmount, roundedTotal);
        finalPaid = Math.round(finalPaid * 100) / 100;
        
        finalRemaining = roundedTotal - finalPaid;
        finalRemaining = Math.round(finalRemaining * 100) / 100;

        distributablePaidAmount -= finalPaid;

        if (finalRemaining <= 0.5) { 
          finalStatus = 'paid';
          finalRemaining = 0;
        } else if (finalPaid > 0) {
          finalStatus = 'partially_paid';
        } else {
          finalStatus = 'unpaid';
        }
      }

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
        paymentStatus: finalStatus,
        paidAmount: finalPaid,
        remainingAmount: finalRemaining
      });

      createdRents.push(newRent);
      currentPrevUnit = thisMonthCurrUnit;
    }

    // ➤ SEND NOTIFICATION
    if (createdRents.length > 0) {
      const notificationMessage = createdRents.length === 1 
        ? `New rent bill added for ${month} ${year}`
        : `${createdRents.length} rent bills added starting ${month} ${year}`;
      
      await sendRentNotification(
        userId,
        ' New Rent Bill',
        notificationMessage,
        req.io
      );
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

// ==========================================
// Create Bulk Rents (CSV/Import)
// ==========================================
export const createBulkRents = async (req, res) => {
  try {
    const { entries } = req.body;
    if (!entries || !Array.isArray(entries)) return res.status(400).json({ error: 'No entries' });

    const created = await Rent.insertMany(entries);
    
    // ➤ SEND NOTIFICATION (Assuming all entries for same user)
    if (entries.length > 0) {
      const userId = entries[0].userId;
      await sendRentNotification(
        userId,
        ' Bulk Rents Added',
        `${entries.length} rent records have been added to your account.`,
        req.io
      );
    }

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// Update Rent
// ==========================================
export const updateRent = async (req, res) => {
  try {
    const { rent, water, waste, prevUnit, currUnit, electricityRate, internetAmount } = req.body;
    
    let newTotal = req.body.total;
    let newRemaining = req.body.remainingAmount;

    // Recalculate if critical fields changed
    if (rent !== undefined && currUnit !== undefined) {
       const elecCost = (parseFloat(currUnit) - parseFloat(prevUnit)) * parseFloat(electricityRate);
       newTotal = parseFloat(rent) + parseFloat(water) + parseFloat(waste) + parseFloat(internetAmount || 0) + elecCost;
       
       if (req.body.paymentStatus === 'unpaid') {
         newRemaining = newTotal;
       } else if (req.body.paymentStatus === 'partially_paid') {
         newRemaining = newTotal - (parseFloat(req.body.paidAmount) || 0);
       } else if (req.body.paymentStatus === 'paid') {
         newRemaining = 0;
       }
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

    // ➤ SEND NOTIFICATION
    await sendRentNotification(
      updatedRent.userId,
      ' Rent Updated',
      `Your rent for ${updatedRent.month} ${updatedRent.year} has been updated.`,
      req.io
    );

    res.json(updatedRent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// Delete Rent
// ==========================================
export const deleteRent = async (req, res) => {
  try {
    const rent = await Rent.findById(req.params.id);
    if (!rent) return res.status(404).json({ error: 'Rent not found' });

    const { userId, month, year } = rent;
    await Rent.findByIdAndDelete(req.params.id);

    // ➤ SEND NOTIFICATION
    await sendRentNotification(
      userId,
      ' Rent Deleted',
      `The rent record for ${month} ${year} has been removed.`,
      req.io
    );

    res.json({ message: 'Rent deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// Apply Bulk Payment
// ==========================================
export const applyBulkPayment = async (req, res) => {
  try {
    const { userId, amount, surplusAction } = req.body;

    // Fetch all unpaid rents
    let unpaidRents = await Rent.find({ 
      userId, 
      paymentStatus: { $ne: 'paid' } 
    });

    if (unpaidRents.length === 0) {
      return res.status(400).json({ error: 'No unpaid rents found' });
    }

    // Sort: Oldest First
    unpaidRents.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return BS_MONTHS.indexOf(a.month) - BS_MONTHS.indexOf(b.month);
    });

    let remainingAmount = parseFloat(amount);
    const updates = [];

    for (const rent of unpaidRents) {
      if (remainingAmount <= 0) break;

      const dueAmount = rent.remainingAmount;
      const paymentApplied = Math.min(remainingAmount, dueAmount);

      rent.paidAmount = (rent.paidAmount || 0) + paymentApplied;
      rent.remainingAmount = dueAmount - paymentApplied;
      
      // Update Status
      if (rent.remainingAmount <= 0.5) { 
        rent.paymentStatus = 'paid';
        rent.remainingAmount = 0;
      } else {
        rent.paymentStatus = 'partially_paid';
      }

      await rent.save();
      
      updates.push({ 
        rentId: rent._id, 
        month: rent.month, 
        year: rent.year, 
        paymentApplied 
      });

      remainingAmount -= paymentApplied;
    }

    // ➤ SEND NOTIFICATION
    await sendRentNotification(
      userId,
      ' Payment Received',
      `A payment of Rs. ${amount} was applied to your pending bills.`,
      req.io
    );

    res.json({ 
      message: 'Bulk payment applied successfully', 
      updates, 
      surplus: remainingAmount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
