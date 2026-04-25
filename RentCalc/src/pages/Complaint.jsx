// src/pages/Complaint.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiSend, FiX, FiArrowLeftCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../styles/Auth.css';

const Complaint = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [charCount, setCharCount] = useState(0);

  // ✅ Formspree endpoint - complaints go directly to your email
  const FORMSPREE_URL = 'https://formspree.io/f/mzdawynd';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'message') {
      setCharCount(value.length);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!formData.email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }

    if (formData.message.length > 500) {
      toast.error('Message must be less than 500 characters');
      return;
    }

    setLoading(true);
    try {
      // ✅ Send directly to Formspree (no backend API needed)
      const response = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject || 'No Subject',
          message: formData.message,
          app: 'RentCalc Website',
          timestamp: new Date().toLocaleString(),
        }),
      });

      if (response.ok) {
        toast.success('Complaint submitted successfully! We will get back to you soon.');
        setFormData({ name: '', email: '', subject: '', message: '' });
        setCharCount(0);
        navigate('/login');
      } else {
        const errorData = await response.json();
        toast.error(errorData.errors?.[0]?.message || 'Failed to submit complaint');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box" style={{ maxWidth: '500px' }}>
        {/* Header */}
        <div className="auth-header" style={{ marginBottom: '20px' }}>
          <button 
            className="complaint-back-btn" 
            style={{ flex: 1,  color: '#6d61d7ff',background: '#ffffffff', border: '1px solid #ffffffff' }}
            onClick={() => navigate('/login')}
          >
            <FiArrowLeftCircle size={40} />
          </button>
          <h1 style={{ fontSize: '24px', margin: 0 }}>Submit Complaint</h1>
        </div>

        {/* Info Box */}
        <div className="info-box" style={{ 
          background: '#e3f2fd', 
          borderLeft: '4px solid #2196f3', 
          padding: '12px', 
          marginBottom: '20px', 
          borderRadius: '4px' 
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#1976d2' }}>
            Your feedback helps us improve. We typically respond within 24-48 hours.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Name */}
          <div className="form-group">
            <label>Your Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label>Your Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>

          {/* Subject */}
          <div className="form-group">
            <label>Subject (Optional)</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Brief subject"
            />
          </div>

          {/* Message */}
          <div className="form-group">
            <label>Your Complaint/Feedback *</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Describe your issue or suggestion..."
              rows="5"
              maxLength="500"
              required
              style={{ 
                minHeight: '100px', 
                resize: 'vertical',
                fontFamily: 'inherit',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e1e8ed',
                fontSize: '14px'
              }}
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#95a5a6', marginTop: '4px' }}>
              {charCount}/500
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button 
              type="button" 
              className="auth-btn" 
              style={{ flex: 1, background: '#ea1919ff', color: '#ffffffff', border: '1px solid #e1e8ed' }}
              onClick={() => navigate('/login')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="auth-btn" 
              style={{ flex: 1 }}
              disabled={loading}
            >
              <FiSend style={{ marginRight: '8px' }} /> 
              {loading ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Complaint;
