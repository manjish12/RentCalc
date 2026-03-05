//controllers/messageController.js
import Message from '../models/Message.js';
import User from '../models/User.js';
import { Expo } from 'expo-server-sdk';
import { v2 as cloudinary } from 'cloudinary';

export const expoClient = new Expo();

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
    res.status(500).json({ error: error.message });
  }
};


// ===============================
// Send Message (Text or Image with Push Notification)
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

    // ===============================
    // If image is sent, upload to Cloudinary
    // ===============================
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

    // Validate: must have either text or image
    if (messageType === 'text' && (!text || !text.trim())) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // ===============================
    // Save message
    // ===============================
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: text || '',
      imageUrl,
      imagePublicId,
      messageType,
      isRead: false
    });

    // ===============================
    // Real-time Socket Emit
    // ===============================
    const receiverSocketId = global.onlineUsers?.get(receiverId.toString());
    if (receiverSocketId && req.io) {
      req.io.to(receiverSocketId).emit('receive-message', newMessage);
    }

    // ===============================
// Push Notification (Expo)
// ===============================
const sender = await User.findById(senderId);

if (receiver?.pushToken && Expo.isExpoPushToken(receiver.pushToken)) {
  const notificationBody = messageType === 'image' 
    ? ' Sent an image' 
    : text;

  const message = {
    to: receiver.pushToken,
    sound: 'default',
    title: ` ${sender.name}`,
    body: notificationBody,
    data: {
      type: 'chat',
      senderId: senderId.toString(),
      senderName: sender.name,
      messageId: newMessage._id.toString()
    },
    channelId: 'chat',        // ✅ CRITICAL
    priority: 'high',         // ✅ CRITICAL
    badge: 1,
  };

  try {
    const chunks = expoClient.chunkPushNotifications([message]);
    const tickets = [];
    
    for (let chunk of chunks) {
      const ticketChunk = await expoClient.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    
    console.log('✅ Chat notification sent:', tickets[0]);
  } catch (pushError) {
    console.error('❌ Push notification error:', pushError);
  }
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

    // Mark messages as read
    await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false
      },
      { $set: { isRead: true } }
    );

    // Notify sender in real-time
    const senderSocketId = global.onlineUsers?.get(otherUserId.toString());
    if (senderSocketId && req.io) {
      req.io.to(senderSocketId).emit('messages-read', {
        byUserId: currentUserId
      });
    }

    res.json({ success: true });

  } catch (error) {
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

    const totalUnread = unreadStats.reduce(
      (acc, curr) => acc + curr.count,
      0
    );

    const breakdown = {};
    unreadStats.forEach(item => {
      breakdown[item._id] = item.count;
    });

    res.json({
      unreadCount: totalUnread,
      breakdown
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ===============================
// Delete Message (NEW)
// ===============================
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only sender can delete their own message
    if (message.senderId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own messages' });
    }

    // Delete image from Cloudinary if exists
    if (message.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(message.imagePublicId);
        console.log('Deleted image from Cloudinary:', message.imagePublicId);
      } catch (cloudinaryError) {
        console.error('Failed to delete image from Cloudinary:', cloudinaryError);
        // Continue with message deletion even if Cloudinary fails
      }
    }

    await message.deleteOne();

    // Notify receiver in real-time that message was deleted
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
