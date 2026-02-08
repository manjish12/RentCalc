import React, { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiX, FiSend, FiUser, FiCheck } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { messagesAPI } from '../services/api';
import '../styles/ChatWidget.css';

// Notification Sound
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const ChatWidget = ({ receiverId, receiverName }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Badge State
  const [unreadCount, setUnreadCount] = useState(0);
  
  const messagesEndRef = useRef(null);
  const audioRef = useRef(new Audio(NOTIFICATION_SOUND));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const playSound = () => {
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log("Audio interaction needed"));
    } catch (e) {
      console.error(e);
    }
  };

  // 1. Initial Load: Get Unread Count
  useEffect(() => {
    if (user) {
      const fetchCount = async () => {
        try {
          const res = await messagesAPI.getUnreadCount();
          setUnreadCount(res.data.unreadCount);
        } catch (error) {
          console.error('Failed to get unread count');
        }
      };
      fetchCount();
    }
  }, [user]);

  // 2. Fetch Messages when Chat Opens
  useEffect(() => {
    if (isOpen && receiverId) {
      const initChat = async () => {
        try {
          const response = await messagesAPI.getMessages(receiverId);
          setMessages(response.data); // No decryption needed
          
          // Mark as read and reset badge
          await messagesAPI.markMessagesRead(receiverId);
          setUnreadCount(0);
          
          setTimeout(scrollToBottom, 100);
        } catch (error) {
          console.error('Failed to load chat');
        }
      };
      initChat();
    }
  }, [isOpen, receiverId]);

  // 3. Socket Listeners
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = async (message) => {
      // Logic if message belongs to current conversation
      if (message.senderId === receiverId || message.senderId === user._id) {
        setMessages((prev) => [...prev, message]);
        setTimeout(scrollToBottom, 100);

        // If I am the receiver
        if (message.receiverId === user._id) {
          playSound(); 

          if (isOpen) {
            // If chat open, mark read immediately
            await messagesAPI.markMessagesRead(receiverId);
          } else {
            // If chat closed, increase badge
            setUnreadCount(prev => prev + 1);
          }
        }
      } 
      // Logic if message is from someone else
      else if (message.receiverId === user._id) {
        playSound();
        setUnreadCount(prev => prev + 1);
      }
    };

    const handleMessagesRead = ({ byUserId }) => {
      if (byUserId === receiverId) {
        setMessages((prev) => 
          prev.map(msg => msg.senderId === user._id ? { ...msg, isRead: true } : msg)
        );
      }
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('messages-read', handleMessagesRead);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('messages-read', handleMessagesRead);
    };
  }, [socket, receiverId, user, isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !receiverId) return;

    try {
      const tempMsg = {
        _id: Date.now(),
        senderId: user._id,
        receiverId: receiverId,
        text: newMessage,
        isRead: false,
        createdAt: new Date().toISOString()
      };
      
      setMessages((prev) => [...prev, tempMsg]);
      setNewMessage('');
      setTimeout(scrollToBottom, 100);

      // Send plain text
      await messagesAPI.sendMessage(receiverId, newMessage);
    } catch (error) {
      console.error('Failed to send message');
    }
  };

  if (!user) return null;

  return (
    <div className="chat-widget-container">
      {isOpen && (
        <div className="chat-box">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiUser />
              <span>{receiverName || 'Select a User'}</span>
            </div>
            <button className="btn-icon" onClick={() => setIsOpen(false)} style={{ color: 'white', background: 'transparent', border: 'none' }}>
              <FiX />
            </button>
          </div>

          {!receiverId ? (
            <div className="chat-empty">
              <FiMessageSquare size={40} style={{ marginBottom: '10px' }} />
              <p>Please select a tenant/owner to start chatting.</p>
            </div>
          ) : (
            <>
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>
                    No messages yet. Say hi! 👋
                  </p>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.senderId === user._id ? 'sent' : 'received'}`}>
                      {msg.text}
                      {msg.senderId === user._id && (
                        <div className={`message-status ${msg.isRead ? 'read' : ''}`}>
                          {msg.isRead ? (
                            <div className="double-check"><FiCheck size={12} /><FiCheck size={12} style={{ marginLeft: '-8px' }} /></div>
                          ) : (
                            <FiCheck size={12} />
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-input-area" onSubmit={handleSendMessage}>
                <input type="text" placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                <button type="submit" className="send-btn"><FiSend /></button>
              </form>
            </>
          )}
        </div>
      )}

      <button className={`chat-fab ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <FiX /> : <FiMessageSquare />}
        {!isOpen && unreadCount > 0 && (
          <span className="chat-badge">{unreadCount}</span>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;