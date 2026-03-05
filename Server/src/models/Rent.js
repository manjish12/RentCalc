// models/Rent.js
import mongoose from 'mongoose';

const rentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  rent: {
    type: Number,
    required: true,
    default: 0
  },
  prevUnit: {
    type: Number,
    required: true,
    default: 0
  },
  currUnit: {
    type: Number,
    required: true,
    default: 0
  },
  electricityRate: {
    type: Number,
    required: true,
    default: 0
  },
  water: {
    type: Number,
    required: true,
    default: 0
  },
  internet: {
    type: Boolean,
    default: false
  },
  internetAmount: {
    type: Number,
    default: 0
  },
  waste: {
    type: Number,
    required: true,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'unpaid', 'partially_paid'],
    default: 'unpaid'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: 0
  },
  isSurplusAdjusted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

rentSchema.index({ userId: 1, year: -1, month: 1 });

const Rent = mongoose.model('Rent', rentSchema);
export default Rent;