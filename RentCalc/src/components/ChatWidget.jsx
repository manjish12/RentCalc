import React, { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiX, FiSend, FiUser, FiCheck, FiChevronLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { messagesAPI } from '../services/api';
import '../styles/ChatWidget.css';

const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

const ChatWidget = ({ 
  defaultReceiverId = null, 
  defaultReceiverName = null,
  usersList = [] 
}) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const isOwner = user?.role === 'owner';
  
  // FIX: Only force list view if we are Owner AND we haven't been given a default chat
  // If we are Tenant, we ALWAYS want chat view.
  const [currentView, setCurrentView] = useState(isOwner && !defaultReceiverId ? 'list' : 'chat');
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeReceiverId, setActiveReceiverId] = useState(defaultReceiverId);
  const [activeReceiverName, setActiveReceiverName] = useState(defaultReceiverName);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadMap, setUnreadMap] = useState({});
  
  const messagesEndRef = useRef(null);

  // --- DYNAMIC TITLE LOGIC ---
  const flashTitle = (text) => {
    if (document.hidden || !isOpen) {
      document.title = text;
    }
  };

  useEffect(() => {
    const resetTitle = () => { document.title = 'RentCalc'; };
    window.addEventListener('focus', resetTitle);
    document.addEventListener('click', resetTitle);
    return () => {
      window.removeEventListener('focus', resetTitle);
      document.removeEventListener('click', resetTitle);
    };
  }, []);

  const playSound = () => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.volume = 0.4;
      audio.play().catch(e => {});
    } catch (e) { console.error("Audio error", e); }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- INITIAL LOAD ---
  useEffect(() => {
    if (user) {
      fetchUnreadCounts();
    }
    
    // CRITICAL FIX FOR TENANT:
    // If we are passed a default receiver (like Owner), set it active immediately
    if (defaultReceiverId) {
      setActiveReceiverId(defaultReceiverId);
      setActiveReceiverName(defaultReceiverName || "Chat");
      setCurrentView('chat');
    }
  }, [user, defaultReceiverId, defaultReceiverName]);

  const fetchUnreadCounts = async () => {
    try {
      const res = await messagesAPI.getUnreadCount();
      setTotalUnread(res.data.unreadCount);
      setUnreadMap(res.data.breakdown || {});
    } catch (error) {
      console.error('Failed to get counts');
    }
  };

  const openChatWith = (id, name) => {
    setActiveReceiverId(id);
    setActiveReceiverName(name);
    setCurrentView('chat');
    
    setUnreadMap(prev => {
      const count = prev[id] || 0;
      const newTotal = Math.max(0, totalUnread - count);
      setTotalUnread(newTotal);
      const newMap = { ...prev };
      delete newMap[id];
      return newMap;
    });
    document.title = 'RentCalc';
  };

  const backToList = () => {
    // Only allow going back if we are an Owner (who has a list)
    if (isOwner) {
      setActiveReceiverId(null);
      setCurrentView('list');
      fetchUnreadCounts(); 
    }
  };

  // --- FETCH MESSAGES ---
  useEffect(() => {
    if (isOpen && currentView === 'chat' && activeReceiverId) {
      const loadMessages = async () => {
        try {
          const res = await messagesAPI.getMessages(activeReceiverId);
          setMessages(res.data);
          await messagesAPI.markMessagesRead(activeReceiverId);
          setTimeout(scrollToBottom, 100);
        } catch (error) { console.error(error); }
      };
      loadMessages();
    }
  }, [isOpen, currentView, activeReceiverId]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message) => {
      let senderName = "New Message";
      
      // Try to find name in list (Owner case)
      if (usersList && usersList.length > 0) {
        const sender = usersList.find(u => u._id === message.senderId);
        if (sender) senderName = sender.name;
      } 
      // Fallback for Tenant case (Sender is Owner)
      else if (message.senderId === defaultReceiverId) {
        senderName = defaultReceiverName || "Owner";
      }

      if (isOpen && currentView === 'chat' && 
         (message.senderId === activeReceiverId || message.senderId === user._id)) {
        
        setMessages(prev => [...prev, message]);
        setTimeout(scrollToBottom, 100);

        if (message.senderId === activeReceiverId) {
          playSound();
          messagesAPI.markMessagesRead(activeReceiverId); 
          flashTitle(`(${totalUnread + 1}) ${senderName} messaged you`);
        }
      } 
      else if (message.receiverId === user._id) {
        playSound();
        setTotalUnread(prev => prev + 1);
        setUnreadMap(prev => ({
          ...prev,
          [message.senderId]: (prev[message.senderId] || 0) + 1
        }));
        flashTitle(`(1) ${senderName} messaged you`);
      }
    };

    const handleMessagesRead = ({ byUserId }) => {
      if (byUserId === activeReceiverId) {
        setMessages(prev => 
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
  }, [socket, isOpen, currentView, activeReceiverId, user, usersList, defaultReceiverId, defaultReceiverName]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeReceiverId) return;

    try {
      const tempMsg = {
        _id: Date.now(),
        senderId: user._id,
        text: newMessage,
        isRead: false,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempMsg]);
      setNewMessage('');
      setTimeout(scrollToBottom, 100);

      await messagesAPI.sendMessage(activeReceiverId, newMessage);
    } catch (error) { console.error('Send failed'); }
  };

  if (!user) return null;

  return (
    <div className="chat-widget-container">
      {isOpen && (
        <div className="chat-box">
          {/* HEADER */}
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Only show Back button if Owner AND currently in chat view */}
              {isOwner && currentView === 'chat' && (
                <button onClick={backToList} className="back-btn">
                  <FiChevronLeft />
                </button>
              )}
              {/* Icon Logic: Show User Icon if Tenant OR if Owner in List View */}
              {(!isOwner || currentView === 'list') && (
                <FiUser style={{ color: 'white', fontSize: '20px' }} />
              )}
              
              <span className="header-title">
                {currentView === 'chat' ? activeReceiverName : 'Messages'}
              </span>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <FiX />
            </button>
          </div>

          {/* LIST VIEW (OWNER ONLY) */}
          {isOwner && currentView === 'list' && (
            <div className="chat-user-list">
              {usersList.length === 0 ? (
                <div className="empty-list">
                  <p>No tenants found.</p>
                  <small>Add tenants to see them here.</small>
                </div>
              ) : (
                usersList.map(u => (
                  <div 
                    key={u._id} 
                    className="user-list-item" 
                    onClick={() => openChatWith(u._id, u.name)}
                  >
                    <div className="user-avatar">{u.name.charAt(0).toUpperCase()}</div>
                    <div className="user-info">
                      <span className="user-name">{u.name}</span>
                      <span className="user-email">{u.email}</span>
                    </div>
                    {unreadMap[u._id] > 0 && (
                      <span className="list-badge">{unreadMap[u._id]}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* CHAT VIEW */}
          {currentView === 'chat' && (
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
                            <div className="double-check">
                              <FiCheck size={12} />
                              <FiCheck size={12} style={{ marginLeft: '-8px' }} />
                            </div>
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
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                />
                <button type="submit" className="send-btn"><FiSend /></button>
              </form>
            </>
          )}
        </div>
      )}

      <button className={`chat-fab ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <FiX /> : <FiMessageSquare />}
        {!isOpen && totalUnread > 0 && (
          <span className="chat-badge">{totalUnread}</span>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
