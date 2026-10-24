import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  ArrowRight,
  Calendar as CalendarIcon,
  MapPin,
  User as UserIcon,
  Users,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, registrationsAPI } from '../services/api';
import { formatEventTime, formatEventTimeRange, getEventState, isEventPast, isEventFull } from '../utils/dateUtils';
import { LoadingSkeleton, InlineBanner, EmptyState } from '../components/ui/StateViews';
import JumpPicker from '../components/calendar/JumpPicker';
import { matchesEventSearch } from '../utils/search';

export default function EventCalendarPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'list'
  const [events, setEvents] = useState([]);
  const [userRegistrations, setUserRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [allEvents, setAllEvents] = useState(null); // every event, loaded the first time a search is typed
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'open' | 'full' | 'my' | 'past'

  const loadCalendarData = async () => {
    try {
      setIsLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const fromDate = new Date(year, month - 1, 1).toISOString();
      const toDate = new Date(year, month + 2, 0).toISOString();

      const [eventsData, regsData] = await Promise.all([
        eventsAPI.getAll({ from: fromDate, to: toDate }),
        user?._id ? registrationsAPI.getUserRegistrations(user._id).catch(() => []) : Promise.resolve([]),
      ]);

      setEvents(eventsData || []);
      setUserRegistrations(regsData || []);
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
    loadCalendarData();
  }, [currentDate.getFullYear(), currentDate.getMonth(), user?._id]);

  // Week view steps a week at a time; month and list views step a month
  const shiftPeriod = (dir) => {
    if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + dir * 7);
      setCurrentDate(next);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));
    }
  };
  const goToPrev = () => shiftPeriod(-1);
  const goToNext = () => shiftPeriod(1);

  const handleJump = (date) => {
    setCurrentDate(date);
    setShowPicker(false);
  };

  const isSearching = searchQuery.trim().length > 0;

  // A search looks across every date, not just the month on screen
  useEffect(() => {
    if (!isSearching || allEvents) return;
    setIsSearchLoading(true);
    eventsAPI
      .getAll({})
      .then((data) => setAllEvents(data || []))
      .catch((err) =>
        setFeedbackNotice({ type: 'error', message: err.message || 'Failed to search events.' })
      )
      .finally(() => setIsSearchLoading(false));
  }, [isSearching, allEvents]);

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const userRegistrationMap = useMemo(() => {
    const map = new Map();
    userRegistrations.forEach((reg) => {
      const eventId = reg.event?._id || reg.event;
      if (eventId) {
        map.set(eventId.toString(), reg);
      }
    });
    return map;
  }, [userRegistrations]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const source = isSearching ? allEvents || events : events;
    return source.filter((evt) => {
      if (isSearching && !matchesEventSearch(evt, searchQuery)) return false;

      // Filter pills
      const isPast = isEventPast(evt.date);
      const isFull = isEventFull(evt);

      if (activeFilter === 'open') {
        if (isPast || isFull) return false;
      } else if (activeFilter === 'full') {
        if (isPast || !isFull) return false;
      } else if (activeFilter === 'past') {
        if (!isPast) return false;
      } else if (activeFilter === 'my') {
        if (role === 'organizer') {
          const isOwner =
            evt.organizer?._id?.toString() === user?._id?.toString() ||
            evt.organizer?.toString() === user?._id?.toString();
          if (!isOwner) return false;
        } else {
          // Member / Admin: My RSVPs
          if (!userRegistrationMap.has(evt._id)) return false;
        }
      }

      return true;
    });
  }, [events, allEvents, isSearching, searchQuery, activeFilter, user, role, userRegistrationMap]);

  // List view shows only the month on screen (the fetch window also holds the neighbouring months)
  const listEvents = useMemo(() => {
    if (isSearching) return filteredEvents;
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    return filteredEvents.filter((evt) => {
      const d = new Date(evt.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [filteredEvents, isSearching, currentDate]);

  // Search results grouped by month, oldest first
  const resultGroups = useMemo(() => {
    if (!isSearching) return [];
    const groups = new Map();
    [...filteredEvents]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((evt) => {
        const d = new Date(evt.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
            events: [],
          });
        }
        groups.get(key).events.push(evt);
      });
    return [...groups.values()];
  }, [filteredEvents, isSearching]);

  // Month days matrix
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({
        dayNumber: d,
        date: new Date(year, month - 1, d),
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        dayNumber: d,
        date: new Date(year, month, d),
        isCurrentMonth: true,
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        dayNumber: d,
        date: new Date(year, month + 1, d),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Week days
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const firstDay = new Date(curr);
    firstDay.setDate(curr.getDate() - day);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const monthYearLabel = useMemo(() => {
    if (viewMode !== 'week') {
      return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const first = weekDays[0];
    const last = weekDays[6];
    const sameMonth = first.getMonth() === last.getMonth();
    const sameYear = first.getFullYear() === last.getFullYear();
    const start = first.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
    const end = last.toLocaleDateString(undefined, {
      ...(sameMonth ? {} : { month: 'short' }),
      day: 'numeric',
      year: 'numeric',
    });
    return `${start} – ${end}`;
  }, [viewMode, currentDate, weekDays]);

  const getEventsForDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth();
    const d = dateObj.getDate();

    return filteredEvents.filter((evt) => {
      const ed = new Date(evt.date);
      return ed.getFullYear() === y && ed.getMonth() === m && ed.getDate() === d;
    });
  };

  const getEventBadgeClass = (evt) => {
    const state = getEventState(evt);
    if (state === 'past') {
      return 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200';
    }
    if (state === 'full') {
      return 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100';
    }
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100';
  };

  const handleEventClick = (eventId) => {
    navigate(`/events/${eventId}`);
  };

  const renderListRow = (evt) => {
        const isRegistered = userRegistrationMap.has(evt._id);
        const regCount = evt.registeredCount || 0;
        const cap = evt.capacity || 1;
        const isFull = isEventFull(evt);
        const isPast = isEventPast(evt.date);
        const seatsLeft = Math.max(0, cap - regCount);

        return (
          <div
            key={evt._id}
            onClick={() => handleEventClick(evt._id)}
            className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex flex-col items-center justify-center text-slate-800 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {new Date(evt.date).toLocaleDateString(undefined, { month: 'short' })}
                </span>
                <span className="text-base font-bold leading-none text-slate-900">
                  {new Date(evt.date).getDate()}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {evt.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {formatEventTimeRange(evt.date, evt.endDate)} • {evt.venue}
                  {evt.organizer?.name ? ` • by ${evt.organizer.name}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              {isRegistered && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Registered
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {regCount} / {cap} • {isFull ? 'Full' : `${seatsLeft} seats left`}
              </span>
              <span className="text-xs font-bold text-slate-900 hover:text-slate-700 inline-flex items-center gap-1 ml-1">
                View Details →
              </span>
            </div>
          </div>
        );
  };

  const myPillLabel = role === 'organizer' ? 'My Events' : 'My RSVPs';

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {feedbackNotice && (
        <InlineBanner
          type={feedbackNotice.type}
          message={feedbackNotice.message}
          onDismiss={() => setFeedbackNotice(null)}
        />
      )}

      {/* Top row: Calendar on left, Controls on right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Calendar
        </h1>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Navigation Pill: [ < Month Year > ] */}
          <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1">
            <button
              type="button"
              onClick={goToPrev}
              aria-label={viewMode === 'week' ? 'Previous week' : 'Previous month'}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={showPicker}
                title="Jump to a month or date"
                className="h-8 px-3 rounded-xl text-xs font-semibold text-slate-800 min-w-[130px] inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors"
              >
                <span>{monthYearLabel}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showPicker && (
                <JumpPicker
                  value={currentDate}
                  onSelect={handleJump}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>
            <button
              type="button"
              onClick={goToNext}
              aria-label={viewMode === 'week' ? 'Next week' : 'Next month'}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={goToToday}
            className="h-10 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-100 text-slate-700 text-xs font-semibold shadow-sm transition-all"
          >
            Today
          </button>

          {/* View Mode Segmented Pill */}
          <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1">
            {(['month', 'week', 'list']).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                  viewMode === mode
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* UNIFIED FILTER & SEARCH TOOLBAR (Single clean row below Calendar header) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, venue, organizer or date…"
 maxLength={100}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>

        {/* Right: Filter pills */}
        <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1 overflow-x-auto self-start md:self-auto">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'open', label: 'Open Seats' },
            { id: 'full', label: 'Full' },
            { id: 'my', label: myPillLabel },
            { id: 'past', label: 'Past' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setActiveFilter(pill.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === pill.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Calendar Viewport Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
        {isSearching && isSearchLoading && !allEvents ? (
          <div className="p-8">
            <LoadingSkeleton variant="calendar-month" />
          </div>
        ) : isSearching ? (
          <div>
            <div className="px-6 py-3.5 bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'result' : 'results'} for “{searchQuery.trim()}” across all dates
            </div>
            {resultGroups.length === 0 ? (
              <EmptyState
                title="No events found"
                description="Nothing matches that search. Try a month, a venue or an organizer."
              />
            ) : (
              resultGroups.map((g) => (
                <div key={g.key}>
                  <div className="px-6 py-2 bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {g.label}
                  </div>
                  <div className="divide-y divide-slate-100">{g.events.map(renderListRow)}</div>
                </div>
              ))
            )}
          </div>
        ) : isLoading ? (
          <div className="p-8">
            <LoadingSkeleton variant="calendar-month" />
          </div>
        ) : viewMode === 'month' ? (
          <div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-100 text-center py-3 bg-slate-50/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-xs font-semibold text-slate-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {calendarDays.map((cell, index) => {
                const dayEvents = getEventsForDate(cell.date);
                const isToday =
                  cell.date.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={index}
                    className={`min-h-[125px] p-2 flex flex-col justify-start transition-colors ${
                      cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-slate-900 text-white font-bold'
                            : cell.isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                    </div>

                    {/* Richer Event pills */}
                    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[95px]">
                      {dayEvents.map((evt) => {
                        const isRegistered = userRegistrationMap.has(evt._id);
                        const isFull = isEventFull(evt);
                        const isPast = isEventPast(evt.date);
                        const seatsLeft = Math.max(0, (evt.capacity || 0) - (evt.registeredCount || 0));

                        return (
                          <button
                            key={evt._id}
                            type="button"
                            onClick={() => handleEventClick(evt._id)}
                            className={`w-full text-left px-2 py-1.5 rounded-xl text-[11px] font-medium transition-all shadow-xs ${getEventBadgeClass(
                              evt
                            )}`}
                            title={`${formatEventTime(evt.date)} • ${evt.title} (${isFull ? 'Full' : `${seatsLeft} seats left`})`}
                          >
                            <div className="flex items-center justify-between gap-1 leading-tight">
                              <span className="font-semibold text-[10px] shrink-0">
                                {formatEventTime(evt.date)}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isRegistered && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block"
                                    title="You are registered"
                                  />
                                )}
                                <span className="text-[9px] opacity-75 font-semibold">
                                  {isPast ? 'Past' : isFull ? 'Full' : `${seatsLeft} left`}
                                </span>
                              </div>
                            </div>
                            <div className="font-bold truncate mt-0.5 text-slate-900">
                              {evt.title}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'week' ? (
          <div>
            {/* Week header */}
            <div className="grid grid-cols-7 border-b border-slate-100 text-center py-3 bg-slate-50/50">
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-400">
                      {d.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span
                      className={`text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-slate-900 text-white font-bold' : 'text-slate-700'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Week grid */}
            <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[420px]">
              {weekDays.map((d, i) => {
                const dayEvents = getEventsForDate(d);
                return (
                  <div key={i} className="p-2 space-y-2 flex flex-col">
                    {dayEvents.map((evt) => {
                      const isRegistered = userRegistrationMap.has(evt._id);
                      const isFull = isEventFull(evt);
                      const isPast = isEventPast(evt.date);
                      const regCount = evt.registeredCount || 0;
                      const cap = evt.capacity || 1;
                      const seatsLeft = Math.max(0, cap - regCount);

                      return (
                        <div
                          key={evt._id}
                          onClick={() => handleEventClick(evt._id)}
                          className={`w-full text-left p-2.5 rounded-2xl text-xs font-medium transition-all cursor-pointer border ${getEventBadgeClass(
                            evt
                          )}`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-semibold">
                            <span>{formatEventTimeRange(evt.date, evt.endDate)}</span>
                            {isRegistered && (
                              <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white-fixed text-[9px] font-bold">
                                RSVP'd
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-slate-900 truncate mt-1">
                            {evt.title}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {evt.venue}
                          </div>
                          {evt.organizer?.name && (
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              by {evt.organizer.name}
                            </div>
                          )}
                          <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-slate-700">
                              {regCount} / {cap} ({seatsLeft} left)
                            </span>
                            <span className="text-slate-900 font-bold inline-flex items-center gap-0.5">
                              Details →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="divide-y divide-slate-100">
            {listEvents.length === 0 ? (
              <EmptyState
                title="No events scheduled"
                description={
                  searchQuery || activeFilter !== 'all'
                    ? 'No events match your current search or filter.'
                    : 'No events found for this period.'
                }
              />
            ) : (
              listEvents.map(renderListRow)
            )}
          </div>
        )}

        {/* BOTTOM STATUS LEGEND (FR-EVT-06) */}
        <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-center sm:justify-start gap-4 sm:gap-6 flex-wrap text-xs font-medium text-slate-600">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-700 font-medium">Open Upcoming</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-700 font-medium">Full Capacity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-slate-700 font-medium">Past Event</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <span className="text-slate-700 font-medium">Registered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
