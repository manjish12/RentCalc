// controllers/userController.js
import User from '../models/User.js';
import Rent from '../models/Rent.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Year from '../models/Year.js';
import bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';

// ✅ Configure Cloudinary
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
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    await Rent.deleteMany({ userId: user._id });
    await Message.deleteMany({ 
      $or: [{ senderId: user._id }, { receiverId: user._id }] 
    });
    await Notification.deleteMany({ 
      $or: [{ tenantId: user._id }, { ownerId: user._id }] 
    });
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name && name.trim() !== '') {
      user.name = name.trim();
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    if (email && email.trim() !== '' && email !== user.email) {
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
    console.error('Get QR error:', error);
    res.status(500).json({ error: 'Failed to fetch QR' });
  }
};

// ✅ Cloudinary upload for QR codes
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
    console.error('Upload QR error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

export const resetTenantPassword = async (req, res) => {
  try {
    const { tenantId, newPassword } = req.body;
    const owner = req.user;

    const tenant = await User.findById(tenantId);
    if (!tenant || tenant.linkedOwnerId?.toString() !== owner._id.toString()) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const salt = await bcrypt.genSalt(10);
    tenant.password = await bcrypt.hash(newPassword, salt);
    tenant.mustChangePassword = true;
    
    tenant.resetBy = { name: owner.name, id: owner._id };
    tenant.resetAt = new Date();
    
    await tenant.save();

    // ✅ Save notification to database
    await Notification.create({
      tenantId: tenant._id,
      ownerId: owner._id,
      title: 'Password Reset',
      message: `Your password has been reset by ${owner.name}. Please log in and change your password immediately.`,
      type: 'security',
      isRead: false,
      createdAt: new Date()
    });

    // ✅ Send push notification
    if (tenant.pushToken && Expo.isExpoPushToken(tenant.pushToken)) {
      try {
        const { sendPushNotification } = await import('../utils/pushNotification.js');
        await sendPushNotification(tenant.pushToken, {
          title: '🔒 Password Reset',
          body: `${owner.name} reset your password. Change it now in Settings.`,
          data: {
            type: 'password_reset',
            tenantId: tenant._id.toString(),
            ownerName: owner.name
          },
          channelId: 'security' // ✅ Must match app channel
        });
        console.log('✅ Password reset notification sent');
      } catch (pushError) {
        console.error('Push notification failed:', pushError);
      }
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


// controllers/userController.js - Update savePushToken function
export const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    // FCM tokens don't have a specific prefix - they're just strings
    // But we can validate length (FCM tokens are usually > 50 chars)
    const isValidFCMToken = token.length > 50;
    
    console.log('📱 Saving FCM push token for user:', req.user._id);
    console.log('🔑 Token format valid:', isValidFCMToken);
    console.log('🔑 Token preview:', token.substring(0, 30) + '...');

    await User.findByIdAndUpdate(req.user._id, { 
      pushToken: token,
      pushTokenUpdatedAt: new Date()
    });

    console.log('✅ FCM token saved successfully');
    
    res.status(200).json({ 
      success: true,
      message: 'FCM token saved'
    });
  } catch (error) {
    console.error('❌ Save push token error:', error);
    res.status(500).json({ error: "Failed to save token" });
  }
};

export const clearPushToken = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pushToken: null });
    res.json({ message: 'Push token cleared successfully' });
  } catch (error) {
    console.error('Clear push token error:', error);
    res.status(500).json({ error: 'Failed to clear push token' });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { tenantId: req.user._id },
        { ownerId: req.user._id }
      ]
    }).sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};
