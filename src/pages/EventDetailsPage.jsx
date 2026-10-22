import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Edit,
  Trash2,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Download,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, registrationsAPI, reportsAPI, adminAPI } from '../services/api';
import {
  formatEventDate,
  formatEventTime,
  isEventPast,
  isEventFull,
  getEventState,
} from '../utils/dateUtils';
import ConfirmModal from '../components/ui/ConfirmModal';
import { LoadingSkeleton, InlineBanner } from '../components/ui/StateViews';

export default function EventDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [event, setEvent] = useState(null);
  const [userRegistration, setUserRegistration] = useState(null);
  const [attendanceReport, setAttendanceReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);

  const fetchEventData = async () => {
    try {
      setIsLoading(true);
      const eventData = await eventsAPI.getById(id);
      setEvent(eventData);

      // Check registration status if user is logged in
      if (user?._id) {
        try {
          const userRegs = await registrationsAPI.getUserRegistrations(user._id);
          const currentReg = (userRegs || []).find((r) => {
            const regEventId = r.event?._id || r.event;
            return regEventId && regEventId.toString() === id.toString();
          });
          setUserRegistration(currentReg || null);
        } catch {
          setUserRegistration(null);
        }
      }

      // Check attendance report for owner/admin
      const isOwner = eventData.organizer && (
        eventData.organizer._id?.toString() === user?._id?.toString() ||
        eventData.organizer.toString() === user?._id?.toString()
      );
      const isAdmin = role === 'admin';

      if (isOwner || isAdmin) {
        try {
          const report = await reportsAPI.getAttendance(id);
          setAttendanceReport(report);
        } catch {
          setAttendanceReport(null);
        }
      }
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to load event details.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchEventData();
    }
  }, [id, user?._id]);

  const isOwner = useMemo(() => {
    if (!event || !user) return false;
    const orgId = event.organizer?._id || event.organizer;
    return orgId && orgId.toString() === user._id.toString();
  }, [event, user]);

  const isAdmin = role === 'admin';
  const canManage = isOwner || isAdmin;

  const eventPast = event ? isEventPast(event.date) : false;
  const eventFull = event ? isEventFull(event) : false;
  const eventState = event ? getEventState(event) : 'open';

  const registeredCount = event?.registeredCount || 0;
  const capacity = event?.capacity || 1;
  const seatsRemaining = Math.max(0, capacity - registeredCount);
  const progressPercent = Math.min(100, Math.round((registeredCount / capacity) * 100));

  // RSVP handler (Guarantees 2-click RSVP flow from Calendar)
  const handleRsvp = async () => {
    setIsActionLoading(true);
    setFeedbackNotice(null);
    try {
      await registrationsAPI.rsvp(event._id);
      setFeedbackNotice({
        type: 'success',
        message: "You're registered for this event!",
      });
      await fetchEventData();
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Unable to register for event.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Cancel RSVP handler
  const handleCancelRsvp = async () => {
    if (!userRegistration?._id) return;
    setIsActionLoading(true);
    setFeedbackNotice(null);
    try {
      await registrationsAPI.cancelRsvp(userRegistration._id);
      setFeedbackNotice({
        type: 'success',
        message: 'Your registration was cancelled.',
      });
      setShowCancelModal(false);
      await fetchEventData();
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to cancel registration.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Delete event handler
  const handleDeleteConfirm = async () => {
    if (!event?._id) return;
    setIsDeleting(true);
    setFeedbackNotice(null);
    try {
      if (isAdmin) {
        await adminAPI.deleteEvent(event._id);
      } else {
        await eventsAPI.delete(event._id);
      }
      navigate('/calendar', { replace: true });
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to delete event.',
      });
      setIsDeleting(false);
    }
  };

  const handleExportCsvBeforeDelete = async () => {
    if (!event?._id) return;
    try {
      setIsExportingCsv(true);
      await reportsAPI.exportRegistrants(event._id, 'csv');
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: `Export error: ${err.message}`,
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="w-full flex-1 p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Event Not Found</h2>
        <p className="text-sm text-slate-500">
          This event may have been removed or the link is incorrect.
        </p>
        <button
          type="button"
          onClick={() => navigate('/calendar')}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-sm hover:bg-slate-800 transition-all"
        >
          Return to Calendar
        </button>
      </div>
    );
  }

  // Format full day & date (e.g., Monday, October 19, 2026)
  const fullDateString = new Date(event.date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const timeString = formatEventTime(event.date);

  const canCancelRegistration = userRegistration && !userRegistration.checkedIn && !eventPast;

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {feedbackNotice && (
        <InlineBanner
          type={feedbackNotice.type}
          message={feedbackNotice.message}
          onDismiss={() => setFeedbackNotice(null)}
        />
      )}

      {/* 1. TOP NAVIGATION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Back button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Right: Quick action pill buttons for Organizer Owner / Admin */}
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/events/${event._id}/roster`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.99]"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Door Check-In</span>
            </Link>

            <Link
              to={`/reports?eventId=${event._id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-100 text-slate-700 text-xs font-semibold shadow-sm transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
              <span>Attendance Report</span>
            </Link>

            <Link
              to={`/events/${event._id}/edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-100 text-slate-700 text-xs font-semibold shadow-sm transition-all"
            >
              <Edit className="w-3.5 h-3.5 text-slate-400" />
              <span>Edit Event</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-red-50 border border-slate-100 text-red-600 text-xs font-semibold shadow-sm transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* 2-COLUMN BENTO LAYOUT (65% Left, 35% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 2. LEFT COLUMN (65% width — lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {eventPast ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Past Event
                </span>
              ) : eventFull ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Event is Full
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Open • {seatsRemaining} seats left
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {event.title}
            </h1>

            {/* Organizer badge */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold shrink-0">
                {event.organizer?.name ? event.organizer.name.charAt(0).toUpperCase() : 'O'}
              </div>
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-900">
                  {event.organizer?.name || 'Campus Organizer'}
                </span>
                {event.organizer?.email && (
                  <span className="text-slate-400 block sm:inline sm:ml-1">
                    ({event.organizer.email})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* About Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight mb-3">
                About this Event
              </h2>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {event.description}
              </div>
            </div>

            {/* Event Metadata */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
              {event.createdAt && (
                <span>
                  Created on{' '}
                  {new Date(event.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
              {event.updatedAt && (
                <span>
                  Last updated{' '}
                  {new Date(event.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. RIGHT COLUMN (35% width — lg:col-span-4) Sticky Logistics & Action Card */}
        <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 space-y-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-400">
              Logistics & RSVP
            </h3>

            {/* Date & Time Row */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <Calendar className="w-5 h-5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Date & Time
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {fullDateString}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeString}</span>
                </div>
              </div>
            </div>

            {/* Venue Row */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <MapPin className="w-5 h-5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Venue
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 break-words">
                  {event.venue}
                </div>
              </div>
            </div>

            {/* Capacity & Availability Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Capacity</span>
                <span className="font-bold text-slate-900">
                  {registeredCount} / {capacity} Registered ({progressPercent}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    eventFull ? 'bg-amber-500' : 'bg-slate-900'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="text-[11px] font-medium text-slate-500 flex justify-between">
                <span>{seatsRemaining} Seats Remaining</span>
                {eventFull && <span className="text-amber-700 font-bold uppercase">Full</span>}
              </div>
            </div>

            {/* Role-Specific Action Area */}
            {canManage ? (
              /* For Organizer (Owner) & Admin */
              <div className="pt-2 border-t border-slate-100 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-900" />
                    <span>Organizer Telemetry</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Registered</span>
                      <span className="text-sm font-bold text-slate-900">
                        {attendanceReport?.registered ?? registeredCount}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Checked In</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {attendanceReport?.checkedIn ?? 0}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Pending</span>
                      <span className="text-sm font-bold text-slate-600">
                        {attendanceReport?.noShows ?? registeredCount}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/events/${event._id}/roster`}
                  className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]"
                >
                  <span>Open Door Check-In Roster</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              /* For Members */
              <div className="pt-2 border-t border-slate-100 space-y-3">
                {role === 'organizer' ? (
                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    Organizer accounts can't RSVP to events. Use a member account to register.
                  </p>
                ) : userRegistration ? (
                  /* Already registered confirmation box */
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-900">
                          You're Registered
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800">
                        Registered on{' '}
                        {new Date(userRegistration.registeredAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <div className="text-xs font-medium pt-1 border-t border-emerald-200/60">
                        Status:{' '}
                        {userRegistration.checkedIn ? (
                          <span className="font-bold text-emerald-700">
                            ✓ Checked In at{' '}
                            {userRegistration.checkedInAt
                              ? formatEventTime(userRegistration.checkedInAt)
                              : ''}
                          </span>
                        ) : (
                          <span className="text-slate-600">Not Checked In Yet</span>
                        )}
                      </div>
                    </div>

                    {/* Cancel RSVP Button */}
                    {canCancelRegistration ? (
                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => setShowCancelModal(true)}
                        className="w-full h-10 rounded-2xl border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-semibold transition-all"
                      >
                        Cancel RSVP
                      </button>
                    ) : userRegistration.checkedIn ? (
                      <p className="text-[11px] text-slate-400 text-center">
                        Locked: Attendance is confirmed and cannot be cancelled.
                      </p>
                    ) : eventPast ? (
                      <p className="text-[11px] text-slate-400 text-center">
                        Event has already concluded.
                      </p>
                    ) : null}
                  </div>
                ) : eventPast ? (
                  /* Past Event Button */
                  <button
                    type="button"
                    disabled
                    className="w-full h-11 rounded-2xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed"
                  >
                    Event Has Ended
                  </button>
                ) : eventFull ? (
                  /* Full Event Button */
                  <button
                    type="button"
                    disabled
                    className="w-full h-11 rounded-2xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed"
                  >
                    Event is Full
                  </button>
                ) : (
                  /* Open Event RSVP Button (2-Click RSVP flow satisfying NFR-USE-03) */
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleRsvp}
                    className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>RSVP to Event</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel RSVP Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        title="Cancel RSVP"
        message={`Are you sure you want to cancel your RSVP for "${event.title}"? Your seat will be returned to the campus pool.`}
        confirmText="Cancel RSVP"
        cancelText="Keep Registration"
        isDestructive={true}
        isLoading={isActionLoading}
        onConfirm={handleCancelRsvp}
        onClose={() => setShowCancelModal(false)}
      />

      {/* Delete Event Confirmation Modal with FR-EVT-12 CSV export warning */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Event"
        message={`Are you sure you want to permanently delete "${event.title}"? All attendee registrations will be removed immediately.`}
        confirmText="Delete Event"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        warningAlert={
          <div className="flex items-center justify-between gap-2">
            <span>Download registrant data before deleting?</span>
            <button
              type="button"
              disabled={isExportingCsv}
              onClick={handleExportCsvBeforeDelete}
              className="text-xs font-semibold text-slate-900 underline hover:no-underline"
            >
              {isExportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        }
        onConfirm={handleDeleteConfirm}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
