import React, { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiX, FiSend, FiUser, FiCheck } from 'react-icons/fi'; // Import FiCheck
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { messagesAPI } from '../services/api';
import '../styles/ChatWidget.css';

const ChatWidget = ({ receiverId, receiverName }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch messages & Mark as Read when opening chat
  useEffect(() => {
    if (isOpen && receiverId) {
      const initChat = async () => {
        try {
          // Get messages
          const response = await messagesAPI.getMessages(receiverId);
          setMessages(response.data);
          
          // Mark as read immediately
          await messagesAPI.markMessagesRead(receiverId);
          
          setTimeout(scrollToBottom, 100);
        } catch (error) {
          console.error('Failed to load chat');
        }
      };
      initChat();
    }
  }, [isOpen, receiverId]);

  // 2. Socket Listeners
  useEffect(() => {
    if (!socket) return;

    // Handle receiving a new message
    const handleReceiveMessage = async (message) => {
      if (message.senderId === receiverId || message.senderId === user._id) {
        setMessages((prev) => [...prev, message]);
        setTimeout(scrollToBottom, 100);

        // If chat is open, mark this new message as read immediately
        if (isOpen && message.senderId === receiverId) {
          await messagesAPI.markMessagesRead(receiverId);
        }
      }
    };

    // Handle "Seen" event (When the other user reads MY messages)
    const handleMessagesRead = ({ byUserId }) => {
      if (byUserId === receiverId) {
        setMessages((prev) => 
          prev.map(msg => 
            msg.senderId === user._id ? { ...msg, isRead: true } : msg
          )
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
        text: newMessage,
        isRead: false, // Initially unread
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, tempMsg]);
      setNewMessage('');
      setTimeout(scrollToBottom, 100);

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
                  <p style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>No messages yet.</p>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.senderId === user._id ? 'sent' : 'received'}`}>
                      {msg.text}
                      
                      {/* --- SEEN ICON LOGIC --- */}
                      {msg.senderId === user._id && (
                        <div className={`message-status ${msg.isRead ? 'read' : ''}`}>
                          {msg.isRead ? (
                            // Double Check for Read
                            <div className="double-check">
                              <FiCheck size={12} />
                              <FiCheck size={12} style={{ marginLeft: '-8px' }} />
                            </div>
                          ) : (
                            // Single Check for Sent
                            <FiCheck size={12} />
                          )}
                        </div>
                      )}
                      {/* ----------------------- */}
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
      </button>
    </div>
  );
};

export default ChatWidget;