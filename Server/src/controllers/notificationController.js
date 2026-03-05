// controllers/notificationController.js
import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ ownerId: req.user._id })
      .populate('tenantId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createNotification = async (req, res) => {
  try {
    const { message, type } = req.body;

    if (req.user.role === 'owner') {
      return res.status(400).json({ error: 'Owners cannot create notifications' });
    }

    const notification = await Notification.create({
      tenantId: req.user._id,
      ownerId: req.user.linkedOwnerId,
      message: message || 'Rent payment completed',
      type: type || 'payment'
    });

    await notification.populate('tenantId', 'name email');

    // --- SOCKET EMIT ---
    const ownerSocketId = global.onlineUsers.get(req.user.linkedOwnerId.toString());
    if (ownerSocketId) {
      req.io.to(ownerSocketId).emit('new-notification', notification);
    }
    // -------------------

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { ownerId: req.user._id, isRead: false }, 
      { isRead: true }
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getNotificationCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      ownerId: req.user._id,
      isRead: false
    });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};