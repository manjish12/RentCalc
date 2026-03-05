// controllers/messageController.js
import Message from '../models/Message.js';
import User from '../models/User.js';
import { Expo } from 'expo-server-sdk';
import { v2 as cloudinary } from 'cloudinary';

// Create a new Expo SDK client
export const expoClient = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN, // Optional but recommended
});

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
// Send Message with Push Notification (FIXED)
// ===============================
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text, imageBase64, messageType = 'text' } = req.body;
    const senderId = req.user._id;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    let imageUrl = null;
    let imagePublicId = null;

    // Upload image if present
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

    // Validate message content
    if (messageType === 'text' && (!text || !text.trim())) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Save message
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: text || '',
      imageUrl,
      imagePublicId,
      messageType,
      isRead: false
    });

    // Real-time Socket Emit
    const receiverSocketId = global.onlineUsers?.get(receiverId.toString());
    if (receiverSocketId && req.io) {
      req.io.to(receiverSocketId).emit('receive-message', newMessage);
    }

    // ============================================
    // FIXED: Push Notification for Android
    // ============================================
    const sender = await User.findById(senderId);

    if (receiver?.pushToken) {
      // Validate token format
      if (!Expo.isExpoPushToken(receiver.pushToken)) {
        console.log('❌ Invalid Expo push token format:', receiver.pushToken.substring(0, 20));
      } else {
        // Prepare notification content
        const notificationBody = messageType === 'image' 
          ? '📷 Sent an image' 
          : (text?.substring(0, 100) || 'New message');
        
        const notificationTitle = sender.name || 'New Message';

        // Create notification message with Android-specific fields
        const message = {
          to: receiver.pushToken,
          sound: 'default',
          title: notificationTitle,
          body: notificationBody,
          data: {
            type: 'chat',
            senderId: senderId.toString(),
            senderName: sender.name,
            messageId: newMessage._id.toString(),
            messageType: messageType,
            timestamp: new Date().toISOString()
          },
          // Android specific
          channelId: 'chat',              // Must match Android channel
          priority: 'high',                // High priority for Android
          badge: 1,
          // Additional Android options
          _displayInForeground: true,
          _category: 'chat',
          // For Android heads-up notification
          android: {
            channelId: 'chat',
            priority: 'high',
            sound: 'default',
            vibrate: true,
            color: '#3498db'
          }
        };

        try {
          // Send notification
          const chunks = expoClient.chunkPushNotifications([message]);
          const tickets = [];
          
          for (let chunk of chunks) {
            const ticketChunk = await expoClient.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
          }
          
          console.log('✅ Chat notification sent:', tickets[0]?.id);

          // Check for errors in tickets
          for (let ticket of tickets) {
            if (ticket.status === 'error') {
              console.error('❌ Push ticket error:', ticket.message);
              
              // Handle specific errors
              if (ticket.details?.error === 'DeviceNotRegistered') {
                // Token is invalid - remove it
                await User.findByIdAndUpdate(receiver._id, { 
                  $set: { pushToken: null } 
                });
                console.log('✅ Removed invalid push token for user:', receiver._id);
              }
              
              if (ticket.details?.error === 'MessageTooBig') {
                console.error('❌ Push message too big');
              }
            }
          }
        } catch (pushError) {
          console.error('❌ Push notification error:', pushError);
          
          // Log detailed error for debugging
          if (pushError.response) {
            console.error('Push API response:', pushError.response.data);
          }
        }
      }
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

    if (!Expo.isExpoPushToken(user.pushToken)) {
      return res.status(400).json({ error: 'Invalid push token format' });
    }

    const message = {
      to: user.pushToken,
      sound: 'default',
      title: '🔔 Test Notification',
      body: 'This is a test message from RentCalc',
      data: { 
        type: 'test',
        timestamp: new Date().toISOString()
      },
      channelId: 'chat',
      priority: 'high',
      android: {
        channelId: 'chat',
        priority: 'high',
        sound: 'default',
        vibrate: true
      }
    };

    const ticket = await expoClient.sendPushNotificationsAsync([message]);
    
    res.json({ 
      success: true, 
      ticket,
      message: 'Test notification sent',
      token: user.pushToken.substring(0, 30) + '...'
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: error.message });
  }
};