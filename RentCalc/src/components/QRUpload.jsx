import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiImage, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { usersAPI } from '../services/api';
import '../styles/QRUpload.css';

const QRUpload = ({ currentQR, onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Update preview when currentQR changes
  useEffect(() => {
    console.log('QRUpload received currentQR:', currentQR);
    if (currentQR) {
      setPreview(currentQR);
    }
  }, [currentQR]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Show preview and upload
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      setPreview(base64Data);

      try {
        setUploading(true);
        console.log('Uploading QR image...');
        
        const response = await usersAPI.uploadQR(base64Data);
        console.log('Upload response:', response.data);
        
        toast.success('QR code uploaded successfully!');
        
        // Call the success callback with the new URL
        if (onUploadSuccess) {
          onUploadSuccess(response.data.qrImageUrl);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(error.response?.data?.error || 'Failed to upload QR code');
        // Revert to previous QR on error
        setPreview(currentQR);
      } finally {
        setUploading(false);
      }
    };
    
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="qr-upload">
      <h3>Payment QR Code</h3>
      <p className="qr-description">
        Upload your payment QR code. Tenants will see this when making payments.
      </p>
      
      <div className="qr-preview">
        {preview ? (
          <img 
            src={preview} 
            alt="Payment QR Code" 
            onError={(e) => {
              console.error('Failed to load QR image');
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="qr-placeholder">
            <FiImage />
            <span>No QR code uploaded</span>
          </div>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        hidden
      />
      
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button 
          type="button"
          className="btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <FiUpload />
          {uploading ? 'Uploading...' : (preview ? 'Change QR Code' : 'Upload QR Code')}
        </button>
      </div>
      
      {preview && (
        <p style={{ marginTop: '12px', color: '#00b894', fontSize: '13px' }}>
          ✓ QR code is set and visible to tenants
        </p>
      )}
    </div>
  );
};

export default QRUpload;