// controllers/messageController.js
import Message from '../models/Message.js';
import User from '../models/User.js';
import { v2 as cloudinary } from 'cloudinary';
import admin from 'firebase-admin';

// Helper function to send FCM notification
async function sendFCMNotification(receiverToken, title, body, data = {}) {
  if (!receiverToken) {
    console.log('ℹ️ No push token provided');
    return null;
  }
  
  try {
    if (!admin.apps.length) {
      console.log('⚠️ Firebase Admin not initialized');
      return null;
    }
    
    const message = {
      token: receiverToken,
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'chat',
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          color: '#3498db',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };
    
    const response = await admin.messaging().send(message);
    console.log('✅ FCM notification sent:', response);
    return response;
  } catch (error) {
    console.error('❌ FCM notification error:', error.code, error.message);
    
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('🗑️ Invalid token detected');
      // Optionally remove invalid token from database
      // await User.findByIdAndUpdate(userId, { pushToken: null });
    }
    
    return null;
  }
}

// ===============================
// Get conversation between 2 users
// ===============================
export const getMessages = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// Send Message with FCM Push Notification
// ===============================
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text, imageBase64, messageType = 'text' } = req.body;
    const senderId = req.user._id;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    let imageUrl = null;
    let imagePublicId = null;

    if (messageType === 'image' && imageBase64) {
      try {
        const uploadResult = await cloudinary.uploader.upload(imageBase64, {
          folder: 'rentcalc/chat_images',
          resource_type: 'auto',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        });

        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image' });
      }
    }

    if (messageType === 'text' && (!text || !text.trim())) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: text || '',
      imageUrl,
      imagePublicId,
      messageType,
      isRead: false
    });

    // Socket emit for real-time
    const receiverSocketId = global.onlineUsers?.get(receiverId.toString());
    if (receiverSocketId && req.io) {
      req.io.to(receiverSocketId).emit('receive-message', newMessage);
    }

    // FCM Push Notification
    const sender = await User.findById(senderId);

    if (receiver?.pushToken) {
      console.log('📤 Sending FCM notification to:', receiver.pushToken.substring(0, 20) + '...');
      
      const notificationBody = messageType === 'image'
        ? '📷 Sent an image'
        : (text?.substring(0, 100) || 'New message');
      
      const notificationTitle = sender.name || 'New Message';

      await sendFCMNotification(
        receiver.pushToken,
        notificationTitle,
        notificationBody,
        {
          type: 'chat',
          senderId: senderId.toString(),
          senderName: sender.name,
          messageId: newMessage._id.toString(),
          messageType: messageType,
        }
      );
    } else {
      console.log('ℹ️ No push token for receiver:', receiverId);
    }

    res.status(201).json(newMessage);

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// Mark Messages as Read
// ===============================
export const markMessagesRead = async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const currentUserId = req.user._id;

    await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false
      },
      { $set: { isRead: true } }
    );

    const senderSocketId = global.onlineUsers?.get(otherUserId.toString());
    if (senderSocketId && req.io) {
      req.io.to(senderSocketId).emit('messages-read', {
        byUserId: currentUserId
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark messages read error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// Get Unread Count
// ===============================
export const getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const unreadStats = await Message.aggregate([
      {
        $match: {
          receiverId: currentUserId,
          isRead: false
        }
      },
      {
        $group: {
          _id: "$senderId",
          count: { $sum: 1 }
        }
      }
    ]);

    const totalUnread = unreadStats.reduce((acc, curr) => acc + curr.count, 0);
    const breakdown = {};
    unreadStats.forEach(item => {
      breakdown[item._id] = item.count;
    });

    res.json({ unreadCount: totalUnread, breakdown });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// Delete Message
// ===============================
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    if (message.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(message.imagePublicId);
      } catch (cloudinaryError) {
        console.error('Failed to delete image from Cloudinary:', cloudinaryError);
      }
    }

    await message.deleteOne();

    const receiverSocketId = global.onlineUsers?.get(message.receiverId.toString());
    if (receiverSocketId && req.io) {
      req.io.to(receiverSocketId).emit('message-deleted', {
        messageId: message._id,
        deletedBy: currentUserId
      });
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// TEST: Send Test Notification
// ===============================
export const sendTestNotification = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.pushToken) {
      return res.status(400).json({ error: 'No push token found for user' });
    }

    const result = await sendFCMNotification(
      user.pushToken,
      '🔔 Test Notification',
      'This is a test message from RentCalc',
      { type: 'test', timestamp: new Date().toISOString() }
    );
    
    res.json({ 
      success: true, 
      result,
      message: 'Test notification sent',
      token: user.pushToken.substring(0, 30) + '...'
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: error.message });
  }
};