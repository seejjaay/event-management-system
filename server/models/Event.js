import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    // Optional so events created before venues existed still load; the API requires it on create
    endDate: {
      type: Date,
      default: null,
    },
    // Denormalised name of the venue (kept in step when a venue is renamed) so display/search stay simple
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      default: null,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    registeredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Index for calendar date-range queries (FR-EVT-01, FR-CAL-01)
eventSchema.index({ date: 1 });
// Index for organizer's own events dashboard
eventSchema.index({ organizer: 1, date: 1 });
// Venue clash lookups
eventSchema.index({ venueId: 1, date: 1 });

export default mongoose.model('Event', eventSchema);