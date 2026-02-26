import React, { useState, useEffect, useRef } from 'react';
import { 
  FiMessageSquare, FiX, FiSend, FiUser, FiCheck, 
  FiChevronLeft, FiImage, FiTrash2, FiDownload, FiLoader 
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { messagesAPI } from '../services/api';
import toast from 'react-hot-toast';
import '../styles/ChatWidget.css';

const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const ChatWidget = ({ 
  defaultReceiverId = null, 
  defaultReceiverName = null,
  usersList = [] 
}) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const isOwner = user?.role === 'owner';
  
  const [currentView, setCurrentView] = useState(isOwner && !defaultReceiverId ? 'list' : 'chat');
  const [isOpen, setIsOpen] = useState(false);
  const [activeReceiverId, setActiveReceiverId] = useState(defaultReceiverId);
  const [activeReceiverName, setActiveReceiverName] = useState(defaultReceiverName);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadMap, setUnreadMap] = useState({});
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, message: null });
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu({ visible: false, x: 0, y: 0, message: null });
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

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
      
      if (usersList && usersList.length > 0) {
        const sender = usersList.find(u => u._id === message.senderId);
        if (sender) senderName = sender.name;
      } else if (message.senderId === defaultReceiverId) {
        senderName = defaultReceiverName || "Owner";
      }

      if (isOpen && currentView === 'chat' && 
         (message.senderId === activeReceiverId || message.senderId === user._id)) {
        
        setMessages(prev => [...prev, message]);
        setTimeout(scrollToBottom, 100);

        if (message.senderId === activeReceiverId) {
          playSound();
          messagesAPI.markMessagesRead(activeReceiverId); 
          const notifText = message.messageType === 'image' ? '📷 Sent an image' : message.text;
          flashTitle(`(${totalUnread + 1}) ${senderName}: ${notifText}`);
        }
      } else if (message.receiverId === user._id) {
        playSound();
        setTotalUnread(prev => prev + 1);
        setUnreadMap(prev => ({
          ...prev,
          [message.senderId]: (prev[message.senderId] || 0) + 1
        }));
        const notifText = message.messageType === 'image' ? '📷 Image' : 'messaged you';
        flashTitle(`(1) ${senderName} ${notifText}`);
      }
    };

    const handleMessagesRead = ({ byUserId }) => {
      if (byUserId === activeReceiverId) {
        setMessages(prev => 
          prev.map(msg => msg.senderId === user._id ? { ...msg, isRead: true } : msg)
        );
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('messages-read', handleMessagesRead);
    socket.on('message-deleted', handleMessageDeleted);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('messages-read', handleMessagesRead);
      socket.off('message-deleted', handleMessageDeleted);
    };
  }, [socket, isOpen, currentView, activeReceiverId, user, usersList, defaultReceiverId, defaultReceiverName, totalUnread]);

  // --- SEND TEXT MESSAGE ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeReceiverId) return;

    const tempMsg = {
      _id: Date.now(),
      senderId: user._id,
      text: newMessage,
      messageType: 'text',
      isRead: false,
      createdAt: new Date().toISOString(),
      sending: true
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
    setTimeout(scrollToBottom, 100);

    try {
      await messagesAPI.sendMessage(activeReceiverId, newMessage);
    } catch (error) { 
      console.error('Send failed');
      toast.error('Failed to send message');
      setMessages(prev => prev.filter(m => m._id !== tempMsg._id));
    }
  };

  // --- IMAGE HANDLING ---
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const cancelImagePreview = () => {
    setSelectedImage(null);
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendImage = async () => {
    if (!selectedImage || !activeReceiverId) return;

    setUploading(true);

    // Add temp message with preview
    const tempMsg = {
      _id: Date.now(),
      senderId: user._id,
      imageUrl: previewImage,
      messageType: 'image',
      isRead: false,
      createdAt: new Date().toISOString(),
      sending: true
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(scrollToBottom, 100);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          await messagesAPI.sendImage(activeReceiverId, event.target.result);
          cancelImagePreview();
        } catch (error) {
          console.error('Image upload failed:', error);
          toast.error('Failed to send image');
          setMessages(prev => prev.filter(m => m._id !== tempMsg._id));
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(selectedImage);
    } catch (error) {
      console.error('Image read failed:', error);
      toast.error('Failed to process image');
      setMessages(prev => prev.filter(m => m._id !== tempMsg._id));
      setUploading(false);
    }
  };

  // --- CONTEXT MENU (RIGHT CLICK) ---
const handleMessageContextMenu = (e, message) => {
  e.preventDefault();

  if (message.senderId !== user._id && message.messageType !== 'image') {
    return;
  }

  const menuWidth = 180;
  const menuHeight = 120;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let x = e.clientX;
  let y = e.clientY;

  if (x + menuWidth > viewportWidth) {
    x = viewportWidth - menuWidth - 10;
  }

  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight - 10;
  }

  if (x < 10) x = 10;
  if (y < 10) y = 10;

  setContextMenu({
    visible: true,
    x,
    y,
    message
  });
};

  const handleDeleteMessage = async () => {
    if (!contextMenu.message) return;

    const messageId = contextMenu.message._id;
    setContextMenu({ visible: false, x: 0, y: 0, message: null });

    try {
      await messagesAPI.deleteMessage(messageId);
      setMessages(prev => prev.filter(m => m._id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete message');
    }
  };

  const handleDownloadImage = () => {
    if (!contextMenu.message?.imageUrl) return;

    const link = document.createElement('a');
    link.href = contextMenu.message.imageUrl;
    link.download = `chat_image_${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setContextMenu({ visible: false, x: 0, y: 0, message: null });
    toast.success('Image download started');
  };

  // --- IMAGE PREVIEW MODAL ---
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const openFullscreenImage = (imageUrl) => {
    setFullscreenImage(imageUrl);
  };

  const closeFullscreenImage = () => {
    setFullscreenImage(null);
  };

  // --- FORMAT TIME ---
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) return null;

  return (
    <div className="chat-widget-container">
      {isOpen && (
        <div className="chat-box">
          {/* HEADER */}
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isOwner && currentView === 'chat' && (
                <button onClick={backToList} className="back-btn">
                  <FiChevronLeft />
                </button>
              )}
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
                    <div 
                      key={msg._id || index} 
                      className={`message ${msg.senderId === user._id ? 'sent' : 'received'} ${msg.messageType === 'image' ? 'image-message' : ''}`}
                      onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                    >
                      {/* IMAGE MESSAGE */}
                      {msg.messageType === 'image' && msg.imageUrl && (
                        <div className="message-image-container">
                          <img 
                            src={msg.imageUrl} 
                            alt="Shared" 
                            className="message-image"
                            onClick={() => openFullscreenImage(msg.imageUrl)}
                          />
                          {msg.sending && (
                            <div className="image-upload-overlay">
                              <FiLoader className="spinner" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* TEXT MESSAGE */}
                      {msg.messageType !== 'image' && msg.text && (
                        <span className="message-text">{msg.text}</span>
                      )}

                      {/* MESSAGE META */}
                      <div className="message-meta">
                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                        {msg.senderId === user._id && (
                          <span className={`message-status ${msg.isRead ? 'read' : ''}`}>
                            {msg.sending ? (
                              <FiLoader className="spinner" size={10} />
                            ) : msg.isRead ? (
                              <span className="double-check">
                                <FiCheck size={12} />
                                <FiCheck size={12} style={{ marginLeft: '-8px' }} />
                              </span>
                            ) : (
                              <FiCheck size={12} />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* IMAGE PREVIEW */}
              {previewImage && (
                <div className="image-preview-container">
                  <img src={previewImage} alt="Preview" className="image-preview" />
                  <div className="image-preview-actions">
                    <button 
                      className="preview-cancel-btn" 
                      onClick={cancelImagePreview}
                      disabled={uploading}
                    >
                      <FiX /> Cancel
                    </button>
                    <button 
                      className="preview-send-btn" 
                      onClick={handleSendImage}
                      disabled={uploading}
                    >
                      {uploading ? <FiLoader className="spinner" /> : <FiSend />} 
                      {uploading ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              {/* INPUT AREA */}
              <form className="chat-input-area" onSubmit={handleSendMessage}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  hidden
                />
                <button 
                  type="button" 
                  className="image-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || previewImage}
                  title="Send Image"
                >
                  <FiImage />
                </button>
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={uploading || previewImage}
                />
                <button 
                  type="submit" 
                  className="send-btn"
                  disabled={!newMessage.trim() || uploading || previewImage}
                >
                  <FiSend />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
            position: 'fixed'
          }}
        >
          {contextMenu.message?.messageType === 'image' && (
            <button onClick={handleDownloadImage}>
              <FiDownload /> Download Image
            </button>
          )}
          {contextMenu.message?.senderId === user._id && (
            <button onClick={handleDeleteMessage} className="delete-option">
              <FiTrash2 /> 
            </button>
          )}
        </div>
      )}

      {/* FULLSCREEN IMAGE MODAL */}
      {fullscreenImage && (
        <div className="fullscreen-image-overlay" onClick={closeFullscreenImage}>
          <button className="fullscreen-close-btn" onClick={closeFullscreenImage}>
            <FiX />
          </button>
          <img 
            src={fullscreenImage} 
            alt="Full size" 
            className="fullscreen-image"
            onClick={(e) => e.stopPropagation()}
          />
          <a 
            href={fullscreenImage} 
            download={`image_${Date.now()}.jpg`}
            target="_blank"
            rel="noopener noreferrer"
            className="fullscreen-download-btn"
            onClick={(e) => e.stopPropagation()}
          >
            <FiDownload /> Download
          </a>
        </div>
      )}

      {/* FAB BUTTON */}
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
