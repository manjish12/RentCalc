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
    console.log('Creating rent with data:', req.body);
    
    const { userId, month, year, rent, prevUnit, currUnit, electricityRate, water, internet, internetAmount, waste, total, paymentStatus, paidAmount, remainingAmount } = req.body;

    // Validate required fields
    if (!userId || !month || !year) {
      return res.status(400).json({ error: 'userId, month, and year are required' });
    }

    // Check for duplicate
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
    console.log('Rent created successfully:', newRent._id);
    
    res.status(201).json(newRent);
  } catch (error) {
    console.error('Create rent error:', error);
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
      const existing = await Rent.findOne({ 
        userId: entry.userId, 
        month: entry.month, 
        year: entry.year 
      });
      
      if (!existing) {
        const newRent = await Rent.create({
          ...entry,
          year: parseInt(entry.year),
          rent: parseFloat(entry.rent) || 0,
          prevUnit: parseFloat(entry.prevUnit) || 0,
          currUnit: parseFloat(entry.currUnit) || 0,
          electricityRate: parseFloat(entry.electricityRate) || 0,
          water: parseFloat(entry.water) || 0,
          internet: entry.internet === true || entry.internet === 'yes',
          internetAmount: parseFloat(entry.internetAmount) || 0,
          waste: parseFloat(entry.waste) || 0,
          total: parseFloat(entry.total) || 0,
          paidAmount: parseFloat(entry.paidAmount) || 0,
          remainingAmount: parseFloat(entry.remainingAmount) || 0
        });
        createdRents.push(newRent);
      }
    }

    res.status(201).json({ 
      message: `${createdRents.length} entries created`,
      data: createdRents 
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateRent = async (req, res) => {
  try {
    const rent = await Rent.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        year: parseInt(req.body.year),
        rent: parseFloat(req.body.rent) || 0,
        prevUnit: parseFloat(req.body.prevUnit) || 0,
        currUnit: parseFloat(req.body.currUnit) || 0,
        electricityRate: parseFloat(req.body.electricityRate) || 0,
        water: parseFloat(req.body.water) || 0,
        internet: req.body.internet === true || req.body.internet === 'yes',
        internetAmount: parseFloat(req.body.internetAmount) || 0,
        waste: parseFloat(req.body.waste) || 0,
        total: parseFloat(req.body.total) || 0,
        paidAmount: parseFloat(req.body.paidAmount) || 0,
        remainingAmount: parseFloat(req.body.remainingAmount) || 0
      },
      { new: true }
    );

    if (!rent) {
      return res.status(404).json({ error: 'Rent not found' });
    }

    res.json(rent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRent = async (req, res) => {
  try {
    const rent = await Rent.findByIdAndDelete(req.params.id);
    if (!rent) {
      return res.status(404).json({ error: 'Rent not found' });
    }
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
      return res.status(400).json({ error: 'No unpaid rents' });
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
      updates.push({ rentId: rent._id, month: rent.month, year: rent.year, paymentApplied });
      remainingAmount -= paymentApplied;
    }

    res.json({ message: 'Payment applied', updates, surplus: remainingAmount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};