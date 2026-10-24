import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, registrationsAPI } from '../services/api';
import { LoadingSkeleton, EmptyState, InlineBanner } from '../components/ui/StateViews';
import { useToast } from '../components/ui/Toast';

export default function RosterCheckInPage() {
  const { id: eventId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [event, setEvent] = useState(null);
  const [roster, setRoster] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'checked'
  const [checkingInId, setCheckingInId] = useState(null);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  const loadRosterData = async () => {
    try {
      setIsLoading(true);
      const [eventData, rosterData] = await Promise.all([
        eventsAPI.getById(eventId),
        registrationsAPI.getRoster(eventId),
      ]);
      setEvent(eventData);
      setRoster(rosterData || []);
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to load roster.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRosterData();
  }, [eventId]);

  const handleCheckIn = async (regId) => {
    setCheckingInId(regId);
    setFeedbackNotice(null);

    const previousRoster = [...roster];
    const nowIso = new Date().toISOString();

    setRoster((prev) =>
      prev.map((r) =>
        r._id === regId
          ? { ...r, checkedIn: true, checkedInAt: nowIso }
          : r
      )
    );

    try {
      await registrationsAPI.checkIn(regId);
      const attendee = previousRoster.find((r) => r._id === regId)?.user?.name;
      toast.success(attendee ? `${attendee} is checked in.` : 'Attendee checked in.', {
        title: 'Successfully checked in',
      });
    } catch (err) {
      setRoster(previousRoster);
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to check in attendee.',
      });
    } finally {
      setCheckingInId(null);
    }
  };

  const metrics = useMemo(() => {
    const total = roster.length;
    const checked = roster.filter((r) => r.checkedIn).length;
    const pending = total - checked;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { total, checked, pending, rate };
  }, [roster]);

  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      if (filterStatus === 'pending' && item.checkedIn) return false;
      if (filterStatus === 'checked' && !item.checkedIn) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (item.user?.name || '').toLowerCase();
        const email = (item.user?.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }

      return true;
    });
  }, [roster, filterStatus, searchQuery]);

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      {feedbackNotice && (
        <InlineBanner
          type={feedbackNotice.type}
          message={feedbackNotice.message}
          onDismiss={() => setFeedbackNotice(null)}
        />
      )}

      {/* Top Header Row: Back link + Event Title + Live pill */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">
            {event?.title || 'Event Roster'}
          </h1>
        </div>

        <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
          {metrics.checked} / {metrics.total} Checked In
        </div>
      </div>

      {/* Controls: Search input + All | Pending | Checked In pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search attendee..."
 maxLength={100}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>

        <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1 self-start sm:self-center">
          {(['all', 'pending', 'checked']).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                filterStatus === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {status === 'checked' ? 'Checked In' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Clean White List Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton count={4} />
          </div>
        ) : filteredRoster.length === 0 ? (
          <EmptyState
            title="No attendees found"
            description={
              searchQuery.trim()
                ? 'No attendee matches your search term.'
                : 'No attendees in this status.'
            }
          />
        ) : (
          filteredRoster.map((item) => (
            <div
              key={item._id}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
            >
              {/* Left: Name + Email */}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  {item.user?.name || 'Attendee'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {item.user?.email || '--'}
                </p>
              </div>

              {/* Right: min-h-[44px] one-tap Check In pill button or green Checked In badge */}
              <div className="shrink-0">
                {item.checkedIn ? (
                  <span className="min-h-[44px] px-4 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Checked In</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={checkingInId === item._id}
                    onClick={() => handleCheckIn(item._id)}
                    className="min-h-[44px] px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {checkingInId === item._id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    <span>Check In</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
