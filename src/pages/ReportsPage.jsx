import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ChevronDown, CheckCircle2, Clock, Search, Users, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, reportsAPI, registrationsAPI } from '../services/api';
import { formatEventTime, formatEventDateTime } from '../utils/dateUtils';
import { LoadingSkeleton, EmptyState, InlineBanner } from '../components/ui/StateViews';
import { useToast } from '../components/ui/Toast';

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEventId = searchParams.get('eventId');

  const { user, role } = useAuth();
  const toast = useToast();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || '');
  const [attendanceReport, setAttendanceReport] = useState(null);
  const [roster, setRoster] = useState([]);

  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Filters for registrants table
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'checked' | 'pending'
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setIsLoadingEvents(true);
        const params = role === 'admin' ? {} : { organizer: user?._id };
        const data = await eventsAPI.getAll(params);
        setEvents(data || []);

        if (!selectedEventId && data && data.length > 0) {
          setSelectedEventId(data[0]._id);
        }
      } catch (err) {
        setFeedbackNotice({
          type: 'error',
          message: err.message || 'Failed to load events.',
        });
      } finally {
        setIsLoadingEvents(false);
      }
    };

    if (user?._id) {
      loadEvents();
    }
  }, [user?._id, role]);

  useEffect(() => {
    if (!selectedEventId) return;

    const loadEventAuditData = async () => {
      try {
        setIsLoadingReport(true);
        setFeedbackNotice(null);

        const [reportData, rosterData] = await Promise.all([
          reportsAPI.getAttendance(selectedEventId),
          registrationsAPI.getRoster(selectedEventId),
        ]);

        setAttendanceReport(reportData);
        setRoster(rosterData || []);
      } catch (err) {
        setFeedbackNotice({
          type: 'error',
          message: err.message || 'Failed to load report data.',
        });
      } finally {
        setIsLoadingReport(false);
      }
    };

    loadEventAuditData();
  }, [selectedEventId]);

  const handleExport = async (format) => {
    if (!selectedEventId) return;
    setIsExporting(true);
    setFeedbackNotice(null);
    try {
      const filename = await reportsAPI.exportRegistrants(selectedEventId, format);
      toast.success(`Saved ${filename || format.toUpperCase()}.`, { title: 'Successfully exported' });
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || `Failed to export ${format.toUpperCase()}.`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedEvent = events.find((e) => e._id === selectedEventId);

  // 5 required metrics per FR-RPT-01:
  // 1. Total Capacity
  const totalCapacity = attendanceReport?.capacity ?? selectedEvent?.capacity ?? 0;
  // 2. Registered
  const registered = attendanceReport?.registered ?? attendanceReport?.totalRegistrations ?? roster.length;
  // 3. Checked In
  const checkedIn = attendanceReport?.checkedIn ?? attendanceReport?.checkedInCount ?? roster.filter((r) => r.checkedIn).length;
  // 4. No-Shows
  const noShows = attendanceReport?.noShows ?? attendanceReport?.noShowCount ?? Math.max(0, registered - checkedIn);
  // 5. Attendance Rate (%)
  const attendanceRate = registered > 0
    ? (attendanceReport?.attendanceRate !== undefined
        ? Number(attendanceReport.attendanceRate).toFixed(1)
        : ((checkedIn / registered) * 100).toFixed(1))
    : '0.0';

  const remainingSeats = Math.max(0, totalCapacity - registered);

  // Filter roster by status and search query
  const filteredRoster = useMemo(() => {
    return roster.filter((r) => {
      if (statusFilter === 'checked' && !r.checkedIn) return false;
      if (statusFilter === 'pending' && r.checkedIn) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (r.user?.name || '').toLowerCase().includes(q);
        const emailMatch = (r.user?.email || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }

      return true;
    });
  }, [roster, statusFilter, searchQuery]);

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {feedbackNotice && (
        <InlineBanner
          type={feedbackNotice.type}
          message={feedbackNotice.message}
          onDismiss={() => setFeedbackNotice(null)}
        />
      )}

      {/* Top Row: Title + Event Selector on left, Export buttons on right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Reports
          </h1>
          {events.length > 0 && (
            <div className="relative">
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setSearchParams({ eventId: e.target.value });
                }}
                className="appearance-none h-10 pl-3.5 pr-8 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                {events.map((evt) => (
                  <option key={evt._id} value={evt._id}>
                    {evt.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5 pointer-events-none" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!selectedEventId || isExporting}
            onClick={() => handleExport('csv')}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700 shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            disabled={!selectedEventId || isExporting}
            onClick={() => handleExport('json')}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700 shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {isLoadingEvents || isLoadingReport ? (
        <LoadingSkeleton variant="table" count={3} />
      ) : !selectedEvent ? (
        <EmptyState title="No events found" description="Create an event first to see attendance reports." />
      ) : (
        <>
          {/* Bento Summary: Capacity Overview card clearly labeling all 5 FR-RPT-01 metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Card: Ring Chart + Attendance Rate + Checked In vs No-Shows */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 sm:p-8 flex flex-col justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Attendance Rate (%)
              </span>

              <div className="flex items-center gap-6 my-4">
                {/* SVG Ring Chart */}
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500 transition-all duration-500"
                      strokeDasharray={`${Math.min(100, Math.round(Number(attendanceRate)))}, 100`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-slate-900">
                    {attendanceRate}%
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Checked In</span>
                      <span>{checkedIn}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${registered > 0 ? (checkedIn / registered) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>No-Shows / Pending</span>
                      <span>{noShows}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-slate-300 rounded-full"
                        style={{
                          width: `${registered > 0 ? (noShows / registered) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                {checkedIn} of {registered} registered attendees checked in
              </div>
            </div>

            {/* Right Card: Capacity Overview (FR-RPT-01) clearly labeling all 5 metrics */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 sm:p-8 flex flex-col justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Capacity Overview (FR-RPT-01)
              </span>

              {/* 5 metrics grid: Total Capacity, Registered, Checked In, No-Shows, Attendance Rate (%) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-auto py-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Total Capacity
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-0.5 block">
                    {totalCapacity}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Registered
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-0.5 block">
                    {registered}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center">
                  <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
                    Checked In
                  </span>
                  <span className="text-xl font-bold text-emerald-700 mt-0.5 block">
                    {checkedIn}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    No-Shows
                  </span>
                  <span className="text-xl font-bold text-slate-700 mt-0.5 block">
                    {noShows}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Attendance Rate (%)
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-0.5 block">
                    {attendanceRate}%
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                {remainingSeats > 0 ? `${remainingSeats} spots still open` : 'Event capacity reached'}
              </div>
            </div>
          </div>

          {/* Below: Registrants List Card with Search & 5 Columns */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] overflow-hidden">
            {/* Table Header Controls: Search input on left, Filter pills on right */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search registrant by name or email..."
 maxLength={100}
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900 transition-all"
                />
              </div>

              {/* Filter pills: All, Checked In, No-Show / Pending */}
              <div className="inline-flex items-center bg-slate-50 rounded-2xl border border-slate-100 p-1 self-start sm:self-center">
                {[
                  { id: 'all', label: `All (${roster.length})` },
                  { id: 'checked', label: `Checked In (${checkedIn})` },
                  { id: 'pending', label: `No-Show / Pending (${noShows})` },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusFilter(s.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      statusFilter === s.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5-Column Table matching CSV Export (FR-RPT-04): Full Name, Email, Registered At, Status, Checked In At */}
            {filteredRoster.length === 0 ? (
              <EmptyState
                title="No registrants found"
                description={
                  searchQuery
                    ? 'No attendee matches your search query.'
                    : 'No attendees match this filter.'
                }
              />
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                {/* 5 Column Labels */}
                <div className="px-6 py-3.5 bg-slate-50/50 grid grid-cols-12 text-xs font-semibold text-slate-400 min-w-[650px]">
                  <div className="col-span-3">Full Name</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-2">Registered At</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Checked In At</div>
                </div>

                {filteredRoster.map((item) => (
                  <div
                    key={item._id}
                    className="px-6 py-4 grid grid-cols-12 items-center text-xs hover:bg-slate-50/50 transition-colors min-w-[650px]"
                  >
                    {/* 1. Full Name */}
                    <div className="col-span-3 font-semibold text-slate-900 truncate pr-2">
                      {item.user?.name || 'Attendee'}
                    </div>

                    {/* 2. Email */}
                    <div className="col-span-3 text-slate-500 truncate pr-2">
                      {item.user?.email || '--'}
                    </div>

                    {/* 3. Registered At */}
                    <div className="col-span-2 text-slate-600 truncate pr-2">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '--'}
                    </div>

                    {/* 4. Status */}
                    <div className="col-span-2">
                      {item.checkedIn ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Checked In
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Pending / No-Show
                        </span>
                      )}
                    </div>

                    {/* 5. Checked In At */}
                    <div className="col-span-2 text-right text-slate-600 font-medium">
                      {item.checkedInAt ? formatEventTime(item.checkedInAt) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
