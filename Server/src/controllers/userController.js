import User from '../models/User.js';
import Rent from '../models/Rent.js';
import Notification from '../models/Notification.js';
import { v2 as cloudinary } from 'cloudinary'; // Import Cloudinary

// Configure Cloudinary
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
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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

// --- UPDATED UPLOAD FUNCTION FOR CLOUDINARY ---
export const uploadQR = async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    console.log('Uploading QR to Cloudinary...');

    // Upload the Base64 string directly to Cloudinary
    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: 'rentcalc_qrs', // Optional: Folder name in Cloudinary
      width: 400,             // Optional: Resize
      crop: "scale"
    });

    console.log('Cloudinary Upload Success:', result.secure_url);

    // Save the Cloudinary URL to MongoDB
    await User.findByIdAndUpdate(req.user._id, { qrImageUrl: result.secure_url });

    res.json({ 
      qrImageUrl: result.secure_url, 
      message: 'QR uploaded successfully' 
    });

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};