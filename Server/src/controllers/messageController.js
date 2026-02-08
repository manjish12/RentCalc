import Message from '../models/Message.js';

// Get conversation between two users
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

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user._id;

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      isRead: false
    });

    // Real-time: Send message to receiver
    const receiverSocketId = global.onlineUsers.get(receiverId.toString());
    if (receiverSocketId) {
      req.io.to(receiverSocketId).emit('receive-message', newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark messages as read
export const markMessagesRead = async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const currentUserId = req.user._id;

    // Update all messages sent by the OTHER user to ME as read
    await Message.updateMany(
      { senderId: otherUserId, receiverId: currentUserId, isRead: false },
      { $set: { isRead: true } }
    );

    // Real-time: Notify the SENDER that I read their messages
    const senderSocketId = global.onlineUsers.get(otherUserId.toString());
    if (senderSocketId) {
      req.io.to(senderSocketId).emit('messages-read', { byUserId: currentUserId });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- NEW FUNCTION: Get Unread Count ---
export const getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    // Count messages where I am receiver AND isRead is false
    const count = await Message.countDocuments({
      receiverId: currentUserId,
      isRead: false
    });

    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};