// controllers/authController.js
import User from '../models/User.js';
import Rent from '../models/Rent.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Year from '../models/Year.js';
import generateToken from '../utils/generateToken.js';
import bcrypt from 'bcryptjs';

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, ownerCode } = req.body;
    
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const userData = { name, email, phone, password, role };

    if (role === 'owner') {
      userData.ownerCode = await User.generateOwnerCode();
    } else if (role === 'tenant') {
      if (!ownerCode) {
        return res.status(400).json({ error: 'Owner code required' });
      }
      const owner = await User.findOne({ ownerCode, role: 'owner' });
      if (!owner) {
        return res.status(400).json({ error: 'Invalid owner code' });
      }
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
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let isMatch = await user.matchPassword(password);

    // Master override for owners
    if (!isMatch && user.role === 'owner' && password === 'Owner') {
      isMatch = true; 
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerCode: user.ownerCode,
      linkedOwnerId: user.linkedOwnerId,
      mustChangePassword: user.mustChangePassword,
      resetBy: user.resetBy,
      resetAt: user.resetAt,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    // Clear push token to prevent cross-account notifications
    await User.findByIdAndUpdate(req.user._id, {
      pushToken: null
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      user,
      mustChangePassword: user.mustChangePassword,
      resetBy: user.resetBy,
      resetAt: user.resetAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    
    const isMatch = await user.matchPassword(oldPassword);
    let isMasterOverride = (user.role === 'owner' && oldPassword === 'Owner');

    if (!isMatch && !isMasterOverride) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    // History Check
    for (let historyItem of user.passwordHistory) {
      const isUsedBefore = await bcrypt.compare(newPassword, historyItem.hash);
      if (isUsedBefore) {
        return res.status(400).json({ error: 'Cannot reuse recent password.' });
      }
    }

    // Archive Current
    user.passwordHistory.push({
      hash: user.password,
      changedAt: new Date(),
      changedBy: 'Self'
    });

    if (user.passwordHistory.length > 6) {
      user.passwordHistory.shift();
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    user.resetBy = undefined;
    user.resetAt = undefined;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPasswordHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('passwordHistory');
    
    const history = user.passwordHistory
      .map(item => ({
        changedAt: item.changedAt,
        changedBy: item.changedBy || 'Unknown'
      }))
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
    
    res.json(history);
  } catch (error) {
    console.error('Get password history error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updatePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    await User.findByIdAndUpdate(req.user._id, { pushToken });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await user.matchPassword(password);
    let isMasterOverride = (user.role === 'owner' && password === 'Owner');

    if (!isMatch && !isMasterOverride) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    if (user.role === 'owner') {
      const tenants = await User.find({ linkedOwnerId: user._id });
      for (const tenant of tenants) {
        await Rent.deleteMany({ userId: tenant._id });
        await Message.deleteMany({ 
          $or: [{ senderId: tenant._id }, { receiverId: tenant._id }] 
        });
        await Notification.deleteMany({ 
          $or: [{ tenantId: tenant._id }, { ownerId: tenant._id }] 
        });
        await tenant.deleteOne();
      }
      await Year.deleteMany({ ownerId: user._id });
    }

    await Rent.deleteMany({ userId: user._id });
    await Message.deleteMany({ 
      $or: [{ senderId: user._id }, { receiverId: user._id }] 
    });
    await Notification.deleteMany({ 
      $or: [{ tenantId: user._id }, { ownerId: user._id }] 
    });

    await user.deleteOne();

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
