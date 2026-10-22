import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, MapPin, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { registrationsAPI } from '../services/api';
import { formatEventTime, formatEventDate, isEventPast } from '../utils/dateUtils';
import ConfirmModal from '../components/ui/ConfirmModal';
import { LoadingSkeleton, EmptyState, InlineBanner } from '../components/ui/StateViews';

export default function MyRegistrationsPage() {
  const { user } = useAuth();

  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'all' | 'upcoming' | 'checked' | 'past'
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Cancellation Modal State
  const [cancellingRegistration, setCancellingRegistration] = useState(null);
  const [isCancelLoading, setIsCancelLoading] = useState(false);

  const loadRegistrations = async () => {
    if (!user?._id) return;
    try {
      setIsLoading(true);
      const data = await registrationsAPI.getUserRegistrations(user._id);
      setRegistrations(data || []);
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to load registrations.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, [user?._id]);

  const handleCancelRsvpConfirm = async () => {
    if (!cancellingRegistration?._id) return;
    setIsCancelLoading(true);
    setFeedbackNotice(null);
    try {
      await registrationsAPI.cancelRsvp(cancellingRegistration._id);
      setFeedbackNotice({
        type: 'success',
        message: 'Registration cancelled.',
      });
      setCancellingRegistration(null);
      await loadRegistrations();
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Unable to cancel registration.',
      });
    } finally {
      setIsCancelLoading(false);
    }
  };

  // Filtered registrations
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const event = reg.event || {};
      const eventDate = event.date ? new Date(event.date) : null;
      const isPast = eventDate ? isEventPast(eventDate) : false;

      // Tab filter
      if (activeTab === 'upcoming') {
        if (reg.checkedIn || isPast) return false;
      } else if (activeTab === 'checked') {
        if (!reg.checkedIn) return false;
      } else if (activeTab === 'past') {
        if (!isPast) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (event.title || '').toLowerCase().includes(q);
        const venueMatch = (event.venue || '').toLowerCase().includes(q);
        const orgMatch = (event.organizer?.name || '').toLowerCase().includes(q);
        if (!titleMatch && !venueMatch && !orgMatch) return false;
      }

      return true;
    });
  }, [registrations, activeTab, searchQuery]);

  // Tab counts
  const counts = useMemo(() => {
    let upcoming = 0;
    let checked = 0;
    let past = 0;

    registrations.forEach((reg) => {
      const eventDate = reg.event?.date ? new Date(reg.event.date) : null;
      const isPast = eventDate ? isEventPast(eventDate) : false;

      if (!reg.checkedIn && !isPast) upcoming++;
      if (reg.checkedIn) checked++;
      if (isPast) past++;
    });

    return { all: registrations.length, upcoming, checked, past };
  }, [registrations]);

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {feedbackNotice && (
        <InlineBanner
          type={feedbackNotice.type}
          message={feedbackNotice.message}
          onDismiss={() => setFeedbackNotice(null)}
        />
      )}

      {/* Header: Title */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          My RSVPs
        </h1>
      </div>

      {/* Search Input & Filter Pills Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your registered events..."
 maxLength={100}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>

        {/* Filter pills: All, Upcoming, Checked In, Past */}
        <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1 overflow-x-auto self-start sm:self-auto">
          {[
            { id: 'all', label: `All (${counts.all})` },
            { id: 'upcoming', label: `Upcoming (${counts.upcoming})` },
            { id: 'checked', label: `Checked In (${counts.checked})` },
            { id: 'past', label: `Past (${counts.past})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton count={3} />
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <EmptyState
            title={
              searchQuery
                ? 'No matching registered events'
                : activeTab === 'upcoming'
                ? 'No upcoming RSVPs'
                : activeTab === 'checked'
                ? 'No check-in records yet'
                : 'No past registered events'
            }
            description={
              searchQuery
                ? 'Try adjusting your search query.'
                : activeTab === 'upcoming'
                ? 'Browse the calendar to RSVP for upcoming campus events.'
                : 'Events you attend will appear here.'
            }
          />
        ) : (
          filteredRegistrations.map((reg) => {
            const event = reg.event || {};
            const eventId = event._id || reg.event;
            const eventDate = event.date ? new Date(event.date) : null;
            const isPast = eventDate ? isEventPast(eventDate) : false;
            const canCancel = !reg.checkedIn && !isPast;

            const registrationDateStr = reg.createdAt
              ? new Date(reg.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : null;

            return (
              <div
                key={reg._id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                {/* Left: Soft rounded square date badge + Clickable Event Title + Time • Venue • Organizer */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex flex-col items-center justify-center shrink-0 text-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {eventDate ? eventDate.toLocaleDateString(undefined, { month: 'short' }) : 'EVT'}
                    </span>
                    <span className="text-base font-bold leading-none text-slate-900">
                      {eventDate ? eventDate.getDate() : '--'}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/events/${eventId}`}
                      className="text-sm font-bold text-slate-900 hover:text-slate-700 truncate block transition-colors"
                    >
                      {event.title || 'Untitled Event'}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {event.date ? formatEventTime(event.date) : ''}
                      {event.venue ? ` • ${event.venue}` : ''}
                      {event.organizer?.name ? ` • Organized by ${event.organizer.name}` : ''}
                    </p>
                  </div>
                </div>

                {/* Middle: Registration timestamp */}
                {registrationDateStr && (
                  <div className="hidden md:flex flex-col text-right shrink-0">
                    <span className="text-[11px] font-medium text-slate-400">
                      RSVP'd
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {registrationDateStr}
                    </span>
                  </div>
                )}

                {/* Right: Status badge + View Event link + Cancel button */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {reg.checkedIn ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>
                        Checked In
                        {reg.checkedInAt ? ` • ${formatEventTime(reg.checkedInAt)}` : ''}
                      </span>
                    </span>
                  ) : isPast ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                      Concluded
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      Registered
                    </span>
                  )}

                  <Link
                    to={`/events/${eventId}`}
                    className="text-xs font-semibold text-slate-900 hover:text-slate-600 px-2 py-1 rounded-lg transition-colors"
                  >
                    View Event
                  </Link>

                  {canCancel ? (
                    <button
                      type="button"
                      onClick={() => setCancellingRegistration(reg)}
                      className="px-3 py-1 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      Cancel RSVP
                    </button>
                  ) : reg.checkedIn ? (
                    <span
                      className="text-[11px] text-slate-400 italic flex items-center gap-1"
                      title="Locked after check-in"
                    >
                      <Lock className="w-3 h-3 text-slate-300" />
                      <span>Locked</span>
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cancel RSVP Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(cancellingRegistration)}
        title="Cancel RSVP"
        message={`Are you sure you want to cancel your RSVP for "${cancellingRegistration?.event?.title || 'this event'}"? Your seat will be returned to the attendee pool.`}
        confirmText="Cancel RSVP"
        cancelText="Keep Registration"
        isDestructive={true}
        isLoading={isCancelLoading}
        onConfirm={handleCancelRsvpConfirm}
        onClose={() => setCancellingRegistration(null)}
      />
    </div>
  );
}
