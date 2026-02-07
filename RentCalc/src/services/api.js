import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('rentcalc_user') || '{}');
    if (user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('rentcalc_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile')
};

export const usersAPI = {
  getUsers: () => api.get('/users'),
  getUser: (id) => api.get(`/users/${id}`),
  deleteUser: (id) => api.delete(`/users/${id}`),
  getQR: (id) => api.get(`/users/${id}/qr`),
  uploadQR: (imageBase64) => api.post('/users/qr', { imageBase64 })
};

export const rentsAPI = {
  getRents: (userId) => api.get(`/rents?userId=${userId}`),
  createRent: (data) => api.post('/rents', data),
  createBulkRents: (entries) => api.post('/rents/bulk', { entries }),
  updateRent: (id, data) => api.put(`/rents/${id}`, data),
  deleteRent: (id) => api.delete(`/rents/${id}`),
  applyBulkPayment: (data) => api.post('/rents/bulk-payment', data)
};

export const notificationsAPI = {
  getNotifications: () => api.get('/notifications'),
  createNotification: (data) => api.post('/notifications', data),
  markAllAsRead: () => api.put('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`)
};

export const uploadAPI = {
  uploadQRImage: (formData) => api.post('/upload/qr', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export default api;