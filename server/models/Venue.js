import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true,
      maxlength: [200, 'Venue name cannot exceed 200 characters'],
    },
    // lowercased + space-collapsed name; the unique index lives here so "Gym" and "gym " collide
    nameKey: {
      type: String,
      required: true,
      unique: true,
    },
    capacity: {
      type: Number,
      min: [1, 'Capacity must be at least 1'],
      default: null, // null = no seating limit configured
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true, // inactive venues stay on existing events but can't be picked for new bookings
    },
  },
  { timestamps: true }
);

export default mongoose.model('Venue', venueSchema);
