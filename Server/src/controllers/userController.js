import User from '../models/User.js';
import Rent from '../models/Rent.js';
import Notification from '../models/Notification.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    console.error('Get user error:', error);
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
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET QR - Fixed to handle both owner and tenant requests
export const getQR = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('Getting QR for user ID:', userId);
    
    const user = await User.findById(userId).select('qrImageUrl role');
    
    if (!user) {
      console.log('User not found for QR fetch');
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('Found user QR URL:', user.qrImageUrl);
    res.json({ qrImageUrl: user.qrImageUrl || null });
  } catch (error) {
    console.error('Get QR error:', error);
    res.status(500).json({ error: error.message });
  }
};

// UPLOAD QR - Fixed with better error handling and logging
export const uploadQR = async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    console.log('Uploading QR for user:', req.user._id);
    console.log('Image data length:', imageBase64.length);

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Created uploads directory:', uploadsDir);
    }

    // Generate unique filename
    const fileName = `qr-${req.user._id}-${Date.now()}.png`;
    const filePath = path.join(uploadsDir, fileName);

    // Extract base64 data and save file
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    console.log('Saved QR image to:', filePath);

    // Create the image URL
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
    console.log('Generated image URL:', imageUrl);

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id, 
      { qrImageUrl: imageUrl },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Updated user QR URL in database:', updatedUser.qrImageUrl);

    res.json({ 
      qrImageUrl: imageUrl, 
      message: 'QR uploaded successfully' 
    });
  } catch (error) {
    console.error('QR upload error:', error);
    res.status(500).json({ error: error.message });
  }
};