import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Trash2,
  Calendar,
  Download,
  BarChart3,
  Edit,
  QrCode,
  Users,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminAPI, reportsAPI } from '../services/api';
import {
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

export default function AdminEventsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganizer, setSelectedOrganizer] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'full' | 'past'
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Deletion State
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const fetchAllEvents = async () => {
    try {
      setIsLoading(true);
      const data = await adminAPI.getEvents();
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
    fetchAllEvents();
  }, []);

  // Unique organizers for filter dropdown
  const organizers = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const orgId = e.organizer?._id || e.organizer;
      if (orgId) {
        const idStr = orgId.toString();
        if (!map.has(idStr)) {
          map.set(idStr, e.organizer?.name || e.organizer?.email || 'Organizer');
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Search query
      if (searchQuery.trim() && !matchesEventSearch(evt, searchQuery)) return false;

      // Organizer filter
      if (selectedOrganizer !== 'all') {
        const orgId = evt.organizer?._id?.toString() || evt.organizer?.toString();
        if (orgId !== selectedOrganizer) return false;
      }

      // Status filter
      const isPast = isEventPast(evt.date);
      const isFull = isEventFull(evt);

      if (statusFilter === 'open') {
        if (isPast || isFull) return false;
      } else if (statusFilter === 'full') {
        if (isPast || !isFull) return false;
      } else if (statusFilter === 'past') {
        if (!isPast) return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedOrganizer, statusFilter]);

  const handleDeleteConfirm = async () => {
    if (!deletingEvent?._id) return;
    setIsDeleting(true);
    setFeedbackNotice(null);

    try {
      await adminAPI.deleteEvent(deletingEvent._id);
      toast.success(`"${deletingEvent.title}" was deleted.`, { title: 'Event deleted' });
      setDeletingEvent(null);
      await fetchAllEvents();
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

      {/* Header Row: All Events */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          All Events
        </h1>
      </div>

      {/* Controls: Search input + Organizer filter dropdown + Status pills */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, venue, organizer or date..."
 maxLength={100}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
          {/* Organizer Filter Dropdown */}
          {organizers.length > 0 && (
            <div className="relative">
              <select
                value={selectedOrganizer}
                onChange={(e) => setSelectedOrganizer(e.target.value)}
                className="appearance-none h-10 pl-3.5 pr-8 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                <option value="all">All Organizers</option>
                {organizers.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5 pointer-events-none" />
            </div>
          )}

          {/* Status Filter Pills: All | Open | Full | Past */}
          <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Open' },
              { id: 'full', label: 'Full' },
              { id: 'past', label: 'Past' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  statusFilter === s.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clean Single Table Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton variant="table" count={5} />
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="No events found"
            description="No campus events match your current filter."
          />
        ) : (
          <div>
            {/* Table Header */}
            <div className="px-6 py-3.5 bg-slate-50/50 border-b border-slate-100 grid grid-cols-12 text-xs font-semibold text-slate-400 min-w-[760px]">
              <div className="col-span-3">Event</div>
              <div className="col-span-2">Organizer</div>
              <div className="col-span-2">Date & Venue</div>
              <div className="col-span-2">Capacity</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {filteredEvents.map((evt) => {
                const regCount = evt.registeredCount || 0;
                const cap = evt.capacity || 1;
                const isFull = isEventFull(evt);
                const isPast = isEventPast(evt.date);
                const seatsLeft = Math.max(0, cap - regCount);
                const progressPct = Math.min(100, Math.round((regCount / cap) * 100));

                return (
                  <div
                    key={evt._id}
                    className="px-6 py-4 grid grid-cols-12 items-center text-xs hover:bg-slate-50/50 transition-colors min-w-[760px]"
                  >
                    {/* 1. Clickable Event Title (/events/:id) */}
                    <div className="col-span-3 pr-3 min-w-0">
                      <Link
                        to={`/events/${evt._id}`}
                        className="font-bold text-slate-900 hover:text-indigo-600 truncate block transition-colors"
                      >
                        {evt.title}
                      </Link>
                      <span className="text-slate-400 truncate block mt-0.5 text-[11px]">
                        ID: {evt._id.slice(-6)}
                      </span>
                    </div>

                    {/* 2. Organizer Name & Email */}
                    <div className="col-span-2 pr-2 min-w-0">
                      <span className="font-semibold text-slate-800 truncate block">
                        {evt.organizer?.name || 'Unknown'}
                      </span>
                      <span className="text-slate-400 truncate block mt-0.5 text-[11px]">
                        {evt.organizer?.email || '--'}
                      </span>
                    </div>

                    {/* 3. Date & Venue */}
                    <div className="col-span-2 pr-2 text-slate-600 min-w-0">
                      <div className="font-semibold text-slate-800 truncate">
                        {formatEventDate(evt.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-slate-400 mt-0.5 truncate text-[11px]">
                        {formatEventTimeRange(evt.date, evt.endDate)} • {evt.venue}
                      </div>
                    </div>

                    {/* 4. Capacity Bar (6 / 40) */}
                    <div className="col-span-2 pr-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>{regCount} / {cap}</span>
                        <span className="text-[10px] text-slate-400">
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

                    {/* 5. Labeled Action Buttons: Roster, Report, Edit, Delete */}
                    <div className="col-span-3 flex items-center justify-end gap-1.5">
                      <Link
                        to={`/events/${evt._id}/roster`}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
                        title="Door Check-In Roster"
                      >
                        Roster
                      </Link>

                      <Link
                        to={`/reports?eventId=${evt._id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
                        title="Attendance Report"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Report</span>
                      </Link>

                      <Link
                        to={`/events/${evt._id}/edit`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
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
              })}
            </div>
          </div>
        )}
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
