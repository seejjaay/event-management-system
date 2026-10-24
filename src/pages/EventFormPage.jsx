import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Loader2 } from 'lucide-react';
import useGoBack from '../hooks/useGoBack';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, venuesAPI } from '../services/api';
import { formatEventDate, formatEventTimeRange } from '../utils/dateUtils';
import { InlineBanner, LoadingSkeleton } from '../components/ui/StateViews';
import { useToast } from '../components/ui/Toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import {
  checkEventTitle,
  checkDescription,
  checkEventDate,
  checkEventEnd,
  checkCapacity,
  collapseSpaces,
  LIMITS,
} from '../utils/validators';

const HOUR_MS = 3600 * 1000;

/** "2026-10-24T09:00" in local time, as <input type="datetime-local"> expects */
const toLocalInput = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const inputClass =
  'w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900';

export default function EventFormPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { goBack } = useGoBack();
  const { user } = useAuth();
  const toast = useToast();

  // Form Fields
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [venueId, setVenueId] = useState('');
  const [capacity, setCapacity] = useState(40);
  const [description, setDescription] = useState('');

  const [venues, setVenues] = useState([]);
  const [initialEvent, setInitialEvent] = useState(null);
  const [baseline, setBaseline] = useState(null); // field values as loaded, for edit-mode dirty check
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [overlapConflict, setOverlapConflict] = useState(null); // the organizer's own overlapping event, awaiting a yes/no

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        const [venueList, data] = await Promise.all([
          venuesAPI.getAll(),
          isEditMode ? eventsAPI.getById(id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setVenues(venueList || []);

        if (data) {
          const start = new Date(data.date);
          // events saved before end times existed: show start + the assumed default length
          const end = data.endDate ? new Date(data.endDate) : new Date(start.getTime() + LIMITS.DEFAULT_EVENT_HOURS * HOUR_MS);
          // Events saved before venues existed have no venueId: match them to a venue by name
          const byName = (venueList || []).find(
            (v) => v.name.toLowerCase() === String(data.venue || '').trim().toLowerCase()
          );
          const vid = data.venueId?._id || data.venueId || byName?._id || '';

          setInitialEvent(data);
          setTitle(data.title || '');
          setVenueId(vid);
          setCapacity(data.capacity || 40);
          setDescription(data.description || '');
          setDate(toLocalInput(start));
          setEndDate(toLocalInput(end));
          setBaseline({
            title: data.title || '',
            venueId: vid,
            capacity: String(data.capacity || 40),
            description: data.description || '',
            date: toLocalInput(start),
            endDate: toLocalInput(end),
          });
        } else {
          const start = new Date();
          start.setDate(start.getDate() + 7);
          start.setHours(9, 0, 0, 0);
          setDate(toLocalInput(start));
          setEndDate(toLocalInput(new Date(start.getTime() + LIMITS.DEFAULT_EVENT_HOURS * HOUR_MS)));
        }
      } catch (err) {
        if (!cancelled) setGeneralError(err.message || 'Failed to load the form.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, isEditMode]);

  // Bookable venues, plus the event's current venue if it has since been deactivated
  const venueOptions = useMemo(() => {
    if (venueId && initialEvent && !venues.some((v) => v._id === venueId)) {
      return [...venues, { _id: venueId, name: `${initialEvent.venue} (no longer bookable)`, capacity: null }];
    }
    return venues;
  }, [venues, venueId, initialEvent]);
  const selectedVenue = venueOptions.find((v) => v._id === venueId) || null;

  const clearError = (key) => {
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: null }));
  };

  // Moving the start keeps the event's length, so the end follows along
  const handleStartChange = (value) => {
    const oldStart = new Date(date).getTime();
    const oldEnd = new Date(endDate).getTime();
    const length = oldEnd > oldStart ? oldEnd - oldStart : LIMITS.DEFAULT_EVENT_HOURS * HOUR_MS;
    setDate(value);
    const newStart = new Date(value).getTime();
    if (!Number.isNaN(newStart)) setEndDate(toLocalInput(new Date(newStart + length)));
    clearError('date');
    clearError('endDate');
  };

  const isDirty =
    !isEditMode ||
    !baseline ||
    title !== baseline.title ||
    venueId !== baseline.venueId ||
    String(capacity) !== baseline.capacity ||
    description !== baseline.description ||
    date !== baseline.date ||
    endDate !== baseline.endDate;

  const changedFields = !isEditMode || !baseline
    ? []
    : [
        title !== baseline.title && 'title',
        (date !== baseline.date || endDate !== baseline.endDate) && 'date & time',
        String(capacity) !== baseline.capacity && 'capacity',
        venueId !== baseline.venueId && 'venue',
        description !== baseline.description && 'description',
      ].filter(Boolean);

  const validateForm = () => {
    const errors = {};

    const titleErr = checkEventTitle(title);
    const descriptionErr = checkDescription(description);
    // Editing may keep an event's existing date, so only new events must be in the future
    const dateErr = checkEventDate(date, { requireFuture: !isEditMode });
    const endErr = checkEventEnd(date, endDate);
    let capacityErr = checkCapacity(capacity);
    if (!capacityErr && isEditMode && initialEvent && parseInt(capacity, 10) < (initialEvent.registeredCount || 0)) {
      capacityErr = `Cannot reduce capacity below registered count (${initialEvent.registeredCount})`;
    }
    if (!capacityErr && selectedVenue?.capacity && parseInt(capacity, 10) > selectedVenue.capacity) {
      capacityErr = `${selectedVenue.name} seats at most ${selectedVenue.capacity}`;
    }

    if (titleErr) errors.title = titleErr;
    if (!venueId) errors.venueId = 'Please choose a venue';
    if (descriptionErr) errors.description = descriptionErr;
    if (dateErr) errors.date = dateErr;
    if (endErr) errors.endDate = endErr;
    if (capacityErr) errors.capacity = capacityErr;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!isDirty || !validateForm()) return;

    // Editing a live event can affect people who already registered, so confirm first
    if (isEditMode) {
      setShowSaveConfirm(true);
      return;
    }
    await doSave();
  };

  const clashMessage = (conflict) =>
    `${conflict.venue} is booked for "${conflict.title}" on ${formatEventDate(conflict.date, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })}, ${formatEventTimeRange(conflict.date, conflict.endDate)}. Pick another time or venue.`;

  const doSave = async (extra = {}) => {
    setIsSubmitting(true);
    try {
      const payload = {
        title: collapseSpaces(title),
        venueId,
        venue: selectedVenue?.name, // only used by mock mode; the API takes the name from venueId
        description: description.trim(),
        capacity: parseInt(capacity, 10),
        date: new Date(date).toISOString(),
        endDate: new Date(endDate).toISOString(),
        ...extra,
      };

      if (isEditMode) {
        await eventsAPI.update(id, payload);
        toast.success(`"${payload.title}" was updated.`, { title: 'Changes saved' });
      } else {
        await eventsAPI.create(payload);
        toast.success(`"${payload.title}" is now on the calendar.`, { title: 'Event added' });
      }

      goBack('/organizer');
    } catch (err) {
      if (err.code === 'VENUE_CLASH' && err.conflict) {
        setFieldErrors((prev) => ({ ...prev, venueId: clashMessage(err.conflict) }));
        setGeneralError('That venue is already booked at that time.');
      } else if (err.code === 'ORGANIZER_OVERLAP' && err.conflict) {
        setOverlapConflict(err.conflict);
      } else if (err.status === 409) {
        setGeneralError(err.message || 'Capacity conflict.');
        setFieldErrors((prev) => ({
          ...prev,
          capacity: err.message,
        }));
      } else if (err.status === 400 && err.errors) {
        setFieldErrors(err.errors);
        setGeneralError('Please fix the indicated validation errors.');
      } else {
        setGeneralError(err.message || 'Failed to save event.');
      }
    } finally {
      setIsSubmitting(false);
      setShowSaveConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto w-full">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Top Header: Title */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {isEditMode ? 'Edit Event' : 'Create Event'}
          </h1>
        </div>
      </div>

      {generalError && (
        <InlineBanner
          type="error"
          message={generalError}
          onDismiss={() => setGeneralError('')}
        />
      )}

      {/* Grid: Form on left, Preview on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Card (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="event-form-1">
                  Title
                </label>
                <span className={`text-[11px] ${title.length > 150 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                  {title.length} / 150
                </span>
              </div>
              <input id="event-form-1"
                type="text"
                required
                maxLength={LIMITS.TITLE_MAX}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearError('title');
                }}
                placeholder="e.g. Intro to Web Development"
                className={`${inputClass} px-4 placeholder:text-slate-400`}
              />
              {fieldErrors.title && (
                <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="event-form-2">
                  Starts
                </label>
                <input id="event-form-2"
                  type="datetime-local"
                  required
                  min={isEditMode ? undefined : toLocalInput(new Date())}
                  value={date}
                  onChange={(e) => handleStartChange(e.target.value)}
                  className={inputClass}
                />
                {fieldErrors.date && (
                  <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="event-form-end">
                  Ends
                </label>
                <input id="event-form-end"
                  type="datetime-local"
                  required
                  min={date || undefined}
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    clearError('endDate');
                  }}
                  className={inputClass}
                />
                {fieldErrors.endDate && (
                  <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.endDate}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="event-form-4">
                  Venue
                </label>
                <select id="event-form-4"
                  required
                  value={venueId}
                  onChange={(e) => {
                    setVenueId(e.target.value);
                    clearError('venueId');
                    clearError('capacity');
                  }}
                  disabled={venueOptions.length === 0}
                  className={`${inputClass} cursor-pointer disabled:opacity-60`}
                >
                  <option value="">{venueOptions.length === 0 ? 'No venues available' : 'Choose a venue…'}</option>
                  {venueOptions.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name}{v.capacity ? ` (seats ${v.capacity})` : ''}
                    </option>
                  ))}
                </select>
                {venueOptions.length === 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {user?.role === 'admin' ? (
                      <>No venues yet. <Link to="/admin/venues" className="font-semibold underline">Add one</Link>.</>
                    ) : (
                      'Ask an admin to add the venues that can be booked.'
                    )}
                  </p>
                )}
                {fieldErrors.venueId && (
                  <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.venueId}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="event-form-3">
                  Capacity
                </label>
                <input id="event-form-3"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={selectedVenue?.capacity || LIMITS.CAPACITY_MAX}
                  step="1"
                  required
                  value={capacity}
                  onKeyDown={(e) => {
                    // whole numbers only: block exponent, sign and decimal point
                    if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => {
                    setCapacity(e.target.value);
                    clearError('capacity');
                  }}
                  className={`${inputClass} px-4`}
                />
                {selectedVenue?.capacity && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {selectedVenue.name} seats up to {selectedVenue.capacity}.
                  </p>
                )}
                {isEditMode && initialEvent && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Current registrations: <span className="font-semibold text-slate-800">{initialEvent.registeredCount || 0}</span> (Capacity cannot be set lower than {initialEvent.registeredCount || 0})
                  </p>
                )}
                {fieldErrors.capacity && (
                  <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.capacity}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="event-description">
                  Description
                </label>
                <span className={`text-[11px] ${description.length > LIMITS.DESCRIPTION_MAX ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                  {description.length} / {LIMITS.DESCRIPTION_MAX}
                </span>
              </div>
              <textarea
                id="event-description"
                rows={5}
                required
                maxLength={LIMITS.DESCRIPTION_MAX}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearError('description');
                }}
                placeholder="Detailed information about the event..."
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400 resize-y"
              />
              {fieldErrors.description && (
                <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => goBack('/organizer')}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isDirty}
                title={!isDirty ? 'No changes to save' : undefined}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditMode ? 'Save Changes' : 'Create Event'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Card (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 space-y-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Live Preview
          </span>

          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 break-words">
              {title.trim() || 'Untitled Event'}
            </h3>
            <p className="text-xs text-slate-500">
              Organized by {user?.name || 'You'}
            </p>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {date ? `${formatEventDate(date, { month: 'short', day: 'numeric', year: 'numeric' })} • ${formatEventTimeRange(date, endDate)}` : 'Date & time not set'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{selectedVenue?.name || 'Venue not set'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Capacity: {capacity || 0} seats</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Description
              </span>
              <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-6 leading-relaxed">
                {description.trim() || 'No description provided yet.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showSaveConfirm}
        title="Save changes?"
        message={`You're about to update "${initialEvent?.title || 'this event'}" (${changedFields.join(', ')}). Anyone already registered will see the new details. Are you sure?`}
        confirmText="Yes, save changes"
        cancelText="Keep editing"
        isDestructive={false}
        isLoading={isSubmitting}
        onConfirm={() => doSave()}
        onClose={() => setShowSaveConfirm(false)}
      />

      <ConfirmModal
        isOpen={Boolean(overlapConflict)}
        title="You have another event at this time"
        message={
          overlapConflict
            ? `You're already running "${overlapConflict.title}" on ${formatEventDate(overlapConflict.date, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}, ${formatEventTimeRange(overlapConflict.date, overlapConflict.endDate)}. Save this one anyway?`
            : ''
        }
        confirmText="Save anyway"
        cancelText="Go back"
        isDestructive={false}
        isLoading={isSubmitting}
        onConfirm={async () => {
          setOverlapConflict(null);
          await doSave({ allowOverlap: true });
        }}
        onClose={() => setOverlapConflict(null)}
      />
    </div>
  );
}
