import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext'; // Import SocketProvider
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import OwnerDashboard from './pages/OwnerDashboard';
import TenantDashboard from './pages/TenantDashboard';
import Complaint from './pages/Complaint'; // ✅ Import Complaint screen

import './index.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider> {/* Wrap routes with SocketProvider */}
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
                  <Route path="/complaint" element={<Complaint />} /> {/* ✅ Add this route */}

            <Route path="/" element={<ProtectedRoute />}>
              <Route index element={<DashboardRouter />} />
            </Route>
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

function DashboardRouter() {
  const user = JSON.parse(localStorage.getItem('rentcalc_user') || '{}');
  
  if (user.role === 'owner') {
    return <OwnerDashboard />;
  } else if (user.role === 'tenant') {
    return <TenantDashboard />;
  }
  
  return <Navigate to="/login" replace />;
}

export default App;