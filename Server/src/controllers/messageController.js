import Message from '../models/Message.js';
import User from '../models/User.js';
import { Expo } from 'expo-server-sdk';
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
// Send Message (with Push Notification)
// ===============================
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user._id;

    // Save message
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      isRead: false
    });

    // ===============================
    // Real-time Socket Emit
    // ===============================
    const receiverSocketId = global.onlineUsers.get(receiverId.toString());
    if (receiverSocketId) {
      req.io.to(receiverSocketId).emit('receive-message', newMessage);
    }

    // ===============================
    // Push Notification (Expo)
    // ===============================
    const receiver = await User.findById(receiverId);
    const sender = await User.findById(senderId);

    if (
      receiver?.pushToken &&
      Expo.isExpoPushToken(receiver.pushToken)
    ) {
      const message = {
        to: receiver.pushToken,
        sound: 'default',
        title: `New Message from ${sender.name}`,
        body: text,
        data: {
          messageId: newMessage._id,
          senderId: senderId
        },
      };

      await expoClient.sendPushNotificationsAsync([message]);
    }

    res.status(201).json(newMessage);

  } catch (error) {
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
    const senderSocketId = global.onlineUsers.get(otherUserId.toString());
    if (senderSocketId) {
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