import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, trim: true },
  role: { type: String, enum: ['owner', 'tenant'], required: true },
  ownerCode: { type: String, unique: true, sparse: true },
  linkedOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  qrImageUrl: { type: String, default: null },
  mustChangePassword: { type: Boolean, default: false },
  pushToken: { type: String, default: null },
  
  // --- PASSWORD HISTORY SCHEMA ---
  passwordHistory: [{
    hash: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: String // "Self" or "Owner Name (Owner)"
  }]
}, {
  timestamps: true
});

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.statics.generateOwnerCode = async function() {
  let code;
  let exists = true;
  while (exists) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    exists = await this.findOne({ ownerCode: code });
  }
  return code;
};

const User = mongoose.model('User', userSchema);
export default User;