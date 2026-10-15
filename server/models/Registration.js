import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Prevent double-registration (FR-REG-04 uniqueness)
registrationSchema.index({ user: 1, event: 1 }, { unique: true });
// Fast roster lookup by event
registrationSchema.index({ event: 1 });
// Fast user registrations lookup
registrationSchema.index({ user: 1 });

export default mongoose.model('Registration', registrationSchema);