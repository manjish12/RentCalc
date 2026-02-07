import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiKey, FiUserPlus } from 'react-icons/fi';
import '../styles/Auth.css';

const Register = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'tenant',
    ownerCode: ''
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      return;
    }

    if (form.role === 'tenant' && !form.ownerCode) {
      return;
    }

    setLoading(true);
    
    const result = await register({
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      ownerCode: form.role === 'tenant' ? form.ownerCode : undefined
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
            <label htmlFor="name">
              <FiUser /> Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              <FiMail /> Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <FiLock /> Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Create a password"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              <FiLock /> Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
            />
          </div>

          <div className="form-group">
            <label>User Type</label>
            <div className="role-select">
              <label className={`role-option ${form.role === 'owner' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="owner"
                  checked={form.role === 'owner'}
                  onChange={handleChange}
                />
                Owner
              </label>
              <label className={`role-option ${form.role === 'tenant' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="tenant"
                  checked={form.role === 'tenant'}
                  onChange={handleChange}
                />
                Tenant
              </label>
            </div>
          </div>

          {form.role === 'tenant' && (
            <div className="form-group">
              <label htmlFor="ownerCode">
                <FiKey /> Owner Code
              </label>
              <input
                type="text"
                id="ownerCode"
                name="ownerCode"
                value={form.ownerCode}
                onChange={handleChange}
                placeholder="Enter owner's code"
                required
              />
              <small className="form-hint">
                Get this code from your property owner
              </small>
            </div>
          )}

          <button 
            type="submit" 
            className="auth-btn"
            disabled={loading}
          >
            <FiUserPlus />
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;