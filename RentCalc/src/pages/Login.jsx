// src/screens/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiLogIn, FiEye, FiEyeOff, FiMessageSquare } from 'react-icons/fi';
import '../styles/Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate(); // ✅ Added for navigation

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    await login(email.trim(), password);
    setLoading(false);
  };

  // ✅ Handle Complaint Button Click
  const handleComplaintClick = () => {
    navigate('/complaint');
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h1>RentCalc</h1>
          <p>Sign in to your account</p>
        </div>

        {/* ✅ Complaint Icon - Top Right Corner */}
        <button 
          className="complaint-icon-btn" 
          onClick={handleComplaintClick}
          title="Submit Complaint / Feedback"
          aria-label="Submit Complaint"
        >
          <FiMessageSquare size={20} />
        </button>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email"><FiMail /> Email</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Enter your email" 
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="password"><FiLock /> Password</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                id="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Enter your password" 
                required 
              />
              <button 
                type="button" 
                className="password-toggle-icon" 
                onClick={() => setShowPassword(!showPassword)} 
                tabIndex="-1"
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px' }}>
            <p style={{ margin: 0, color: '#666' }}>Tenant forgot password? Contact your Owner.</p>
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            <FiLogIn /> {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Register here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;