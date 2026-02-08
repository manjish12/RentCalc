import Year from '../models/Year.js';

export const getYears = async (req, res) => {
  try {
    const years = await Year.find({ ownerId: req.user._id }).sort({ year: 1 });
    res.json(years);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addYear = async (req, res) => {
  try {
    const { year } = req.body;
    const numYear = parseInt(year);

    if (!numYear) return res.status(400).json({ error: 'Invalid year' });

    // Check if exists for this owner
    const existing = await Year.findOne({ ownerId: req.user._id, year: numYear });
    if (existing) {
      return res.status(400).json({ error: 'Year already exists' });
    }

    const newYear = await Year.create({
      ownerId: req.user._id,
      year: numYear
    });

    res.status(201).json(newYear);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteYear = async (req, res) => {
  try {
    await Year.findByIdAndDelete(req.params.id);
    res.json({ message: 'Year deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};