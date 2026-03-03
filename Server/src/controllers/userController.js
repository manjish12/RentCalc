// controllers/userController.js
import User from '../models/User.js';
import Rent from '../models/Rent.js';
import Notification from '../models/Notification.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const getUsers = async (req, res) => {
  try {
    let users;
    if (req.user.role === 'owner') {
      users = await User.find({ linkedOwnerId: req.user._id }).select('-password').sort('name');
    } else {
      users = [req.user];
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await Rent.deleteMany({ userId: user._id });
    await Notification.deleteMany({ $or: [{ tenantId: user._id }, { ownerId: user._id }] });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ NEW: Update Profile (Name & Email)
export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update name if provided
    if (name && name.trim() !== '') {
      user.name = name.trim();
    }

    // Update phone if provided
    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    // Update email if provided (with validation)
    if (email && email.trim() !== '' && email !== user.email) {
      // Check if email already exists
      const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      user.email = email.trim().toLowerCase();
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        ownerCode: user.ownerCode,
        linkedOwnerId: user.linkedOwnerId
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getQR = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('qrImageUrl');
    res.json({ qrImageUrl: user?.qrImageUrl || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const uploadQR = async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });
    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: 'rentcalc_qrs',
      width: 400,
      crop: "scale"
    });
    await User.findByIdAndUpdate(req.user._id, { qrImageUrl: result.secure_url });
    res.json({ qrImageUrl: result.secure_url, message: 'QR uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// Server/src/controllers/userController.js

exports.resetTenantPassword = async (req, res) => {
  try {
    const { tenantId, newPassword } = req.body;
    const owner = req.user;

    // Verify owner has this tenant
    const tenant = await User.findById(tenantId);
    if (!tenant || tenant.linkedOwnerId.toString() !== owner._id.toString()) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    tenant.password = await bcrypt.hash(newPassword, salt);
    tenant.mustChangePassword = true; // Force tenant to change on next login
    await tenant.save();

    // ✅ CREATE NOTIFICATION FOR TENANT
    await Notification.create({
      tenantId: tenant._id,
      ownerId: owner._id,
      title: 'Password Reset',
      message: `Your password has been reset by ${owner.name}. Please log in and change your password immediately.`,
      type: 'security',
      isRead: false,
      createdAt: new Date()
    });

    // ✅ SEND PUSH NOTIFICATION
    try {
      const { sendPushNotification } = require('../utils/pushNotification');
      await sendPushNotification(tenant.pushToken, {
        title: '🔒 Password Reset',
        body: 'Your password was reset by your owner. Please log in and change it.',
        data: {
          type: 'password_reset',
          tenantId: tenant._id.toString()
        }
      });
    } catch (pushError) {
      console.error('Push notification failed:', pushError);
      // Don't fail the request if push fails
    }
      res.json({ 
      message: 'Password reset successfully',
      temporaryPassword: newPassword 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const savePushToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token required" });
  try {
    await User.findByIdAndUpdate(req.user.id, { pushToken: token });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save token" });
  }
};