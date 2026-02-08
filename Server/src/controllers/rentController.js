import Rent from '../models/Rent.js';

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
    const { userId, month, year, rent, prevUnit, currUnit, electricityRate, water, internet, internetAmount, waste, total, paymentStatus, paidAmount, remainingAmount } = req.body;

    if (!userId || !month || !year) {
      return res.status(400).json({ error: 'userId, month, and year are required' });
    }

    const existing = await Rent.findOne({ userId, month, year });
    if (existing) {
      return res.status(400).json({ error: `Entry for ${month} ${year} already exists` });
    }

    const rentData = {
      userId,
      month,
      year: parseInt(year),
      rent: parseFloat(rent) || 0,
      prevUnit: parseFloat(prevUnit) || 0,
      currUnit: parseFloat(currUnit) || 0,
      electricityRate: parseFloat(electricityRate) || 0,
      water: parseFloat(water) || 0,
      internet: internet === true || internet === 'yes',
      internetAmount: parseFloat(internetAmount) || 0,
      waste: parseFloat(waste) || 0,
      total: parseFloat(total) || 0,
      paymentStatus: paymentStatus || 'unpaid',
      paidAmount: parseFloat(paidAmount) || 0,
      remainingAmount: parseFloat(remainingAmount) || 0
    };

    const newRent = await Rent.create(rentData);

    // --- SOCKET EMIT ---
    const tenantSocketId = global.onlineUsers.get(userId.toString());
    if (tenantSocketId) {
      req.io.to(tenantSocketId).emit('rent-updated');
    }
    // -------------------
    
    res.status(201).json(newRent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createBulkRents = async (req, res) => {
  try {
    const { entries } = req.body;
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'No entries provided' });
    }

    const createdRents = [];
    
    for (const entry of entries) {
      const existing = await Rent.findOne({ userId: entry.userId, month: entry.month, year: entry.year });
      if (!existing) {
        const newRent = await Rent.create({ ...entry, year: parseInt(entry.year) });
        createdRents.push(newRent);
      }
    }

    // --- SOCKET EMIT (To the specific tenant) ---
    if (entries.length > 0) {
      const tenantSocketId = global.onlineUsers.get(entries[0].userId.toString());
      if (tenantSocketId) {
        req.io.to(tenantSocketId).emit('rent-updated');
      }
    }
    // -------------------

    res.status(201).json({ message: `${createdRents.length} entries created`, data: createdRents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRent = async (req, res) => {
  try {
    const rent = await Rent.findByIdAndUpdate(
      req.params.id,
      { ...req.body, year: parseInt(req.body.year) },
      { new: true }
    );

    if (!rent) {
      return res.status(404).json({ error: 'Rent not found' });
    }

    // --- SOCKET EMIT ---
    const tenantSocketId = global.onlineUsers.get(rent.userId.toString());
    if (tenantSocketId) {
      req.io.to(tenantSocketId).emit('rent-updated');
    }
    // -------------------

    res.json(rent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRent = async (req, res) => {
  try {
    const rent = await Rent.findById(req.params.id);
    if (!rent) return res.status(404).json({ error: 'Rent not found' });

    // Store userId before deleting
    const userId = rent.userId;

    await Rent.findByIdAndDelete(req.params.id);

    // --- SOCKET EMIT ---
    const tenantSocketId = global.onlineUsers.get(userId.toString());
    if (tenantSocketId) {
      req.io.to(tenantSocketId).emit('rent-updated');
    }
    // -------------------

    res.json({ message: 'Rent deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const applyBulkPayment = async (req, res) => {
  try {
    const { userId, amount, surplusAction } = req.body;

    const unpaidRents = await Rent.find({ userId, paymentStatus: { $ne: 'paid' } }).sort({ year: 1, month: 1 });

    if (unpaidRents.length === 0) return res.status(400).json({ error: 'No unpaid rents' });

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
      updates.push({ rentId: rent._id, month: rent.month, year: rent.year, paymentApplied });
      remainingAmount -= paymentApplied;
    }

    // --- SOCKET EMIT ---
    const tenantSocketId = global.onlineUsers.get(userId.toString());
    if (tenantSocketId) {
      req.io.to(tenantSocketId).emit('rent-updated');
    }
    // -------------------

    res.json({ message: 'Payment applied', updates, surplus: remainingAmount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};