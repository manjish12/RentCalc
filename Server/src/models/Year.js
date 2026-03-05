// models/Year.js
import mongoose from 'mongoose';

const yearSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  year: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Ensure an owner can't add the same year twice
yearSchema.index({ ownerId: 1, year: 1 }, { unique: true });

const Year = mongoose.model('Year', yearSchema);
export default Year;