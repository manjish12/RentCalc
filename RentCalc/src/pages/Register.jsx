import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiKey, FiUserPlus, FiEye, FiEyeOff } from 'react-icons/fi';
import '../styles/Auth.css';

const Register = () => {
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', role: 'tenant', ownerCode: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return alert("Passwords do not match!");
    if (form.role === 'tenant' && !form.ownerCode) return;

    setLoading(true);
    await register({
      name: form.name, email: form.email, password: form.password,
      role: form.role, ownerCode: form.role === 'tenant' ? form.ownerCode : undefined
    });
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h1>RentCalc</h1>
          <p>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name"><FiUser /> Full Name</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Full Name" required />
          </div>

          <div className="form-group">
            <label htmlFor="email"><FiMail /> Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email" required />
          </div>

          <div className="form-group">
            <label htmlFor="password"><FiLock /> Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Password"
                required
                minLength={6}
              />
              <button type="button" className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword"><FiLock /> Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
                required
              />
              <button type="button" className="password-toggle-icon" onClick={() => setShowConfirm(!showConfirm)} tabIndex="-1">
                {showConfirm ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>User Type</label>
            <div className="role-select">
              <label className={`role-option ${form.role === 'owner' ? 'active' : ''}`}>
                <input type="radio" name="role" value="owner" checked={form.role === 'owner'} onChange={handleChange} /> Owner
              </label>
              <label className={`role-option ${form.role === 'tenant' ? 'active' : ''}`}>
                <input type="radio" name="role" value="tenant" checked={form.role === 'tenant'} onChange={handleChange} /> Tenant
              </label>
            </div>
          </div>

          {form.role === 'tenant' && (
            <div className="form-group">
              <label htmlFor="ownerCode"><FiKey /> Owner Code</label>
              <input type="text" name="ownerCode" value={form.ownerCode} onChange={handleChange} placeholder="Owner Code" required />
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            <FiUserPlus /> {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;