import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, MapPin, Users, Loader2 } from 'lucide-react';
import { formatEventDate, formatEventTime, getEventState } from '../../utils/dateUtils';
import ConfirmModal from '../ui/ConfirmModal';

export default function EventDetailsDrawer({
  event,
  isOpen,
  onClose,
  user,
  role,
  isRegistered = false,
  userRegistration = null,
  onRsvp,
  onCancelRsvp,
  isRsvpLoading = false,
}) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [renderedEvent, setRenderedEvent] = useState(event);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (isOpen && event) {
      setRenderedEvent(event);
      const frame = requestAnimationFrame(() => setIsMounted(true));
      return () => cancelAnimationFrame(frame);
    } else {
      setIsMounted(false);
      const timer = setTimeout(() => {
        setRenderedEvent(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, event]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!renderedEvent && !isOpen) return null;
  const currentEvent = renderedEvent || event;
  if (!currentEvent) return null;

  const eventState = getEventState(currentEvent);
  const registeredCount = currentEvent.registeredCount || 0;
  const capacity = currentEvent.capacity || 1;
  const seatsRemaining = Math.max(0, capacity - registeredCount);
  const progressPercent = Math.min(100, Math.round((registeredCount / capacity) * 100));

  const handleCancelConfirm = () => {
    const regId = userRegistration?._id;
    if (regId && onCancelRsvp) {
      onCancelRsvp(regId);
    }
    setShowCancelModal(false);
  };

  const isCancellationDisabled = userRegistration?.checkedIn || eventState === 'past';

  return (
    <>
      {/* Universal Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 transition-opacity duration-200 cursor-pointer ${
          isMounted && isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer */}
      <aside
        className={`fixed top-0 right-0 h-screen w-full sm:w-[440px] bg-white border-l border-slate-100 z-50 flex flex-col shadow-2xl transition-transform duration-200 ease-in-out ${
          isMounted && isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Event Details"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
              {currentEvent.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Organized by {currentEvent.organizer?.name || 'Campus Organization'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Date & Venue */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-slate-700">
              <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-medium">
                {formatEventDate(currentEvent.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {formatEventTime(currentEvent.date)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-medium">{currentEvent.venue}</span>
            </div>
          </div>

          {/* Clean Capacity Progress Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {registeredCount} / {capacity} Registered ({seatsRemaining} left)
                </span>
              </div>
              <span className="text-slate-500">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              About
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {currentEvent.description}
            </p>
          </div>
        </div>

        {/* Drawer Footer Action */}
        <div className="p-6 border-t border-slate-100 bg-white">
          {role === 'organizer' ? (
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Organizer accounts can't RSVP to events. Use a member account to register.
            </p>
          ) : isRegistered ? (
            <button
              type="button"
              disabled={isRsvpLoading || isCancellationDisabled}
              onClick={() => setShowCancelModal(true)}
              className="w-full h-12 rounded-2xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRsvpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{isCancellationDisabled ? 'Registration Locked' : 'Cancel RSVP'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isRsvpLoading || eventState !== 'open'}
              onClick={() => onRsvp && onRsvp(currentEvent._id)}
              className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${
                eventState === 'open'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white active:scale-[0.99]'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              } disabled:opacity-50`}
            >
              {isRsvpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>
                {eventState === 'past'
                  ? 'Event Concluded'
                  : eventState === 'full'
                  ? 'Event Full'
                  : 'RSVP'}
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        title="Cancel RSVP"
        message={`Are you sure you want to cancel your RSVP for "${currentEvent.title}"? Your seat will be released.`}
        confirmText="Cancel RSVP"
        cancelText="Keep RSVP"
        isDestructive={true}
        onConfirm={handleCancelConfirm}
        onClose={() => setShowCancelModal(false)}
      />
    </>
  );
}
