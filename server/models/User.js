import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // npm install bcryptjs

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,         // ← Index: unique email lookup
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,        // ← Never returned in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'organizer', 'member'],
      default: 'member',    // ← FR-AUTH-02: public signup always creates member
    },
    isActive: {
      type: Boolean,
      default: true,        // ← FR-AUTH-06: deactivated users get 403 on login
    },
  },
  { timestamps: true }      // ← adds createdAt, updatedAt automatically
);

// FR-SEC-01: Hash password before save (10 salt rounds)
// Mongoose 9: async hooks don't receive `next`; just return/throw.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Instance method for password comparison
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Index for role-based admin queries (NFR-PER-01)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

export default mongoose.model('User', userSchema);