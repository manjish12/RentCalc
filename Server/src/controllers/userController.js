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
      folder: 'rentcalc_qrs', width: 400, crop: "scale"
    });

    await User.findByIdAndUpdate(req.user._id, { qrImageUrl: result.secure_url });
    res.json({ qrImageUrl: result.secure_url, message: 'QR uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// --- RESET TENANT PASSWORD ---
export const resetTenantPassword = async (req, res) => {
  try {
    const { tenantId, newPassword } = req.body;

    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Unauthorized' });

    const tenant = await User.findOne({ _id: tenantId, linkedOwnerId: req.user._id });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Store Owner Name in history
    tenant.passwordHistory.push({
      hash: tenant.password,
      changedAt: new Date(),
      changedBy: `${req.user.name} (Owner)`
    });

    if (tenant.passwordHistory.length > 6) tenant.passwordHistory.shift();

    tenant.password = newPassword;
    tenant.mustChangePassword = true; 
    await tenant.save();

    res.json({ message: 'Tenant password reset' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Add this new function at the bottom
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

