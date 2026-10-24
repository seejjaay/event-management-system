import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  Users,
  Edit,
  Trash2,
  BarChart3,
  ArrowRight,
  Sparkles,
  Download,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, reportsAPI } from '../services/api';
import {
  formatEventDateTime,
  formatEventDate,
  formatEventTime,
  formatEventTimeRange,
  isEventPast,
  isEventFull,
} from '../utils/dateUtils';
import ConfirmModal from '../components/ui/ConfirmModal';
import { LoadingSkeleton, EmptyState, InlineBanner } from '../components/ui/StateViews';
import { useToast } from '../components/ui/Toast';
import { matchesEventSearch } from '../utils/search';

export default function OrganizerDashboardPage() {
  const { user, role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'full' | 'past'
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Deletion modal state
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const loadOrganizerEvents = async () => {
    if (!user?._id) return;
    try {
      setIsLoading(true);
      const params = role === 'admin' ? {} : { organizer: user._id };
      const data = await eventsAPI.getAll(params);
      setEvents(data || []);
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to load events.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizerEvents();
  }, [user?._id, role]);

  // Metrics
  const kpiMetrics = useMemo(() => {
    const totalEvents = events.length;
    const totalRsvps = events.reduce((sum, e) => sum + (e.registeredCount || 0), 0);
    const totalCapacity = events.reduce((sum, e) => sum + (e.capacity || 0), 0);
    const capacityPercent = totalCapacity > 0 ? Math.round((totalRsvps / totalCapacity) * 100) : 0;

    return {
      totalEvents,
      totalRsvps,
      totalCapacity,
      capacityPercent,
    };
  }, [events]);

  // Upcoming next event
  const upcomingNextEvent = useMemo(() => {
    const upcoming = events
      .filter((e) => !isEventPast(e.date))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [events]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const isPast = isEventPast(evt.date);
      const isFull = isEventFull(evt);

      // Status pill filter
      if (statusFilter === 'open') {
        if (isPast || isFull) return false;
      } else if (statusFilter === 'full') {
        if (isPast || !isFull) return false;
      } else if (statusFilter === 'past') {
        if (!isPast) return false;
      }

      // Search filter
      if (searchQuery.trim() && !matchesEventSearch(evt, searchQuery)) return false;

      return true;
    });
  }, [events, statusFilter, searchQuery]);

  const handleDeleteConfirm = async () => {
    if (!deletingEvent?._id) return;
    setIsDeleting(true);
    setFeedbackNotice(null);
    try {
      await eventsAPI.delete(deletingEvent._id);
      toast.success(`"${deletingEvent.title}" was deleted.`, { title: 'Event deleted' });
      setDeletingEvent(null);
      await loadOrganizerEvents();
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to delete event.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCsvFirst = async () => {
    if (!deletingEvent?._id) return;
    try {
      setIsExportingCsv(true);
      await reportsAPI.exportRegistrants(deletingEvent._id, 'csv');
      toast.success(`Registrants for "${deletingEvent.title}" exported as CSV.`, { title: 'Successfully exported' });
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: `Export error: ${err.message}`,
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {feedbackNotice && (
        <InlineBanner
          type={feedbackNotice.type}
          message={feedbackNotice.message}
          onDismiss={() => setFeedbackNotice(null)}
        />
      )}

      {/* Top Bento Row: 2 Cards (like DEVit) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Left Hero Card: Indigo gradient */}
        <div className="bg-gradient-to-br from-[#312e81] via-[#1e1b4b] to-[#0f172a] text-white-fixed rounded-3xl p-6 sm:p-8 border border-[#312e81]/40 shadow-sm flex flex-col justify-between min-h-[220px]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#c7d2fe]">
              Total Registrations
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight mt-1 text-white-fixed">
              {kpiMetrics.totalRsvps}
            </div>
          </div>
          <div className="flex items-center gap-6 pt-4 border-t border-[#3730a3]/40 text-xs sm:text-sm text-[#c7d2fe]">
            <div>
              <span className="opacity-75">Hosted Events:</span>{' '}
              <span className="font-bold text-white-fixed">{kpiMetrics.totalEvents}</span>
            </div>
            <div>
              <span className="opacity-75">Seats Filled:</span>{' '}
              <span className="font-bold text-white-fixed">{kpiMetrics.capacityPercent}%</span>
            </div>
          </div>
        </div>

        {/* Right Summary Card: Upcoming Next */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 sm:p-8 flex flex-col justify-between min-h-[220px]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Upcoming Next
            </span>
            {upcomingNextEvent ? (
              <div className="mt-2 space-y-2">
                <Link
                  to={`/events/${upcomingNextEvent._id}`}
                  className="text-base sm:text-lg font-bold text-slate-900 hover:text-indigo-600 transition-colors truncate block"
                >
                  {upcomingNextEvent.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {formatEventDate(upcomingNextEvent.date, { month: 'short', day: 'numeric', year: 'numeric' })} • {formatEventTimeRange(upcomingNextEvent.date, upcomingNextEvent.endDate)} • {upcomingNextEvent.venue}
                </p>

                {/* Registered / Capacity Progress Bar */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
                    <span>
                      {upcomingNextEvent.registeredCount || 0} / {upcomingNextEvent.capacity} Registered
                    </span>
                    <span>
                      {Math.max(0, upcomingNextEvent.capacity - (upcomingNextEvent.registeredCount || 0))} seats left
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((upcomingNextEvent.registeredCount || 0) / upcomingNextEvent.capacity) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">
                No upcoming events scheduled.
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-2">
            {upcomingNextEvent ? (
              <div className="flex items-center gap-2.5 flex-wrap">
                <Link
                  to={`/events/${upcomingNextEvent._id}`}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-all shadow-sm"
                >
                  View Details
                </Link>
                <Link
                  to={`/events/${upcomingNextEvent._id}/roster`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm active:scale-[0.99]"
                >
                  <span>Door Check-In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <Link
                to="/events/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
              >
                <span>Create Event</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Below: My Events Section */}
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            My Events
          </h2>
        </div>

        {/* Search input & Filter pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search my events by title, venue or date..."
 maxLength={100}
              className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>

          {/* Status Filter Pills: All | Open | Full | Past */}
          <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1 overflow-x-auto self-start sm:self-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Open' },
              { id: 'full', label: 'Full' },
              { id: 'past', label: 'Past' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clean White Event List Container */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] divide-y divide-slate-100 overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <LoadingSkeleton count={3} />
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              title="No events found"
              description={
                searchQuery
                  ? 'No events match your search term.'
                  : "You haven't scheduled any events matching this filter."
              }
              actionText="New Event"
              onAction={() => navigate('/events/new')}
            />
          ) : (
            filteredEvents.map((evt) => {
              const regCount = evt.registeredCount || 0;
              const cap = evt.capacity || 1;
              const isFull = isEventFull(evt);
              const isPast = isEventPast(evt.date);
              const seatsLeft = Math.max(0, cap - regCount);
              const progressPct = Math.min(100, Math.round((regCount / cap) * 100));

              return (
                <div
                  key={evt._id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  {/* Left: Soft icon square + Clickable Event Title + Single metadata line */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                      <Calendar className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/events/${evt._id}`}
                        className="text-sm font-bold text-slate-900 hover:text-indigo-600 truncate block transition-colors"
                      >
                        {evt.title}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {formatEventDate(evt.date, { month: 'short', day: 'numeric', year: 'numeric' })} • {formatEventTimeRange(evt.date, evt.endDate)} • {evt.venue}
                      </p>
                    </div>
                  </div>

                  {/* Middle: Capacity Bar (6 / 40 Registered • 34 left) */}
                  <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                    <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 min-w-[210px]">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                          <span>{regCount} / {cap} Registered</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            {isPast ? 'Past' : isFull ? 'Full' : `${seatsLeft} left`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isFull ? 'bg-amber-500' : 'bg-slate-900'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Clear labeled compact action buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    <Link
                      to={`/events/${evt._id}/roster`}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm"
                    >
                      Check-In
                    </Link>

                    <Link
                      to={`/reports?eventId=${evt._id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
                      title="Attendance Report"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Report</span>
                    </Link>

                    <Link
                      to={`/events/${evt._id}/edit`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
                      title="Edit Event"
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setDeletingEvent(evt)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Event Confirmation Modal with CSV backup reminder */}
      <ConfirmModal
        isOpen={Boolean(deletingEvent)}
        title="Delete Event"
        message={`Are you sure you want to permanently delete "${deletingEvent?.title}"? All attendee registrations will be removed.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        warningAlert={
          <div className="flex items-center justify-between gap-2">
            <span>Download registrant data before deleting?</span>
            <button
              type="button"
              disabled={isExportingCsv}
              onClick={handleExportCsvFirst}
              className="text-xs font-semibold text-slate-900 underline hover:no-underline"
            >
              {isExportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        }
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingEvent(null)}
      />
    </div>
  );
}
