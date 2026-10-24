import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, Plus, Search, Edit, Trash2, X, Loader2 } from 'lucide-react';
import { venuesAPI, isMockMode } from '../services/api';
import ConfirmModal from '../components/ui/ConfirmModal';
import { LoadingSkeleton, EmptyState, InlineBanner } from '../components/ui/StateViews';
import { useToast } from '../components/ui/Toast';
import useDialog from '../hooks/useDialog';
import { checkVenue, checkCapacity, checkDescription, collapseSpaces, LIMITS } from '../utils/validators';
import { matchesTokens } from '../utils/search';

const EMPTY_FORM = { name: '', capacity: '', description: '' };

export default function AdminVenuesPage() {
  const toast = useToast();

  const [venues, setVenues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Create / edit modal (editing === null means "new venue")
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [deleting, setDeleting] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formDialogRef = useDialog({
    isOpen: isFormOpen,
    onClose: () => setIsFormOpen(false),
    canClose: !isSaving,
  });

  const loadVenues = useCallback(async () => {
    try {
      setIsLoading(true);
      setVenues((await venuesAPI.getAll({ all: true })) || []);
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Failed to load venues.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  const visibleVenues = useMemo(
    () =>
      venues.filter((v) => {
        if (statusFilter === 'active' && !v.isActive) return false;
        if (statusFilter === 'inactive' && v.isActive) return false;
        return matchesTokens(searchQuery, [v.name, v.description]);
      }),
    [venues, searchQuery, statusFilter]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (venue) => {
    setEditing(venue);
    setForm({
      name: venue.name,
      capacity: venue.capacity ? String(venue.capacity) : '',
      description: venue.description || '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const validate = () => {
    const errors = {};
    const nameErr = checkVenue(form.name);
    if (nameErr) errors.name = nameErr.replace(/^Venue/, 'Venue name');
    if (String(form.capacity).trim()) {
      const capErr = checkCapacity(form.capacity);
      if (capErr) errors.capacity = capErr;
    }
    const descErr = checkDescription(form.description, { required: false });
    if (descErr) errors.description = descErr;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: collapseSpaces(form.name),
      capacity: String(form.capacity).trim() ? parseInt(form.capacity, 10) : null,
      description: form.description.trim(),
    };

    setIsSaving(true);
    try {
      if (editing) {
        await venuesAPI.update(editing._id, payload);
        toast.success(`${payload.name} was updated.`, { title: 'Changes saved' });
      } else {
        await venuesAPI.create(payload);
        toast.success(`${payload.name} can now be booked.`, { title: 'Venue added' });
      }
      setIsFormOpen(false);
      await loadVenues();
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length) setFormErrors(err.errors);
      else setFormErrors({ name: err.message || 'Failed to save venue.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (venue) => {
    setNotice(null);
    try {
      await venuesAPI.update(venue._id, { isActive: !venue.isActive });
      toast.success(`${venue.name} is now ${venue.isActive ? 'unavailable for new bookings' : 'available for booking'}.`, {
        title: 'Changes saved',
      });
      await loadVenues();
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Failed to update venue.' });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    setNotice(null);
    try {
      await venuesAPI.delete(deleting._id);
      toast.success(`${deleting.name} was removed.`, { title: 'Venue deleted' });
      setDeleting(null);
      await loadVenues();
    } catch (err) {
      setDeleting(null);
      setNotice({ type: 'error', message: err.message || 'Failed to delete venue.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {isMockMode && (
        <InlineBanner
          type="info"
          message="Venue management is not available in mock mode. The list below is read-only and built from the venues already used by events. Switch to the live backend to add or edit venues."
        />
      )}
      {notice && (
        <InlineBanner type={notice.type} message={notice.message} onDismiss={() => setNotice(null)} />
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Venues</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Only active venues can be picked when creating or editing an event.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={isMockMode}
          className="h-10 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.99]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Venue</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search venues..."
            maxLength={100}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>
        <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1 self-start lg:self-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton variant="table" count={5} />
          </div>
        ) : visibleVenues.length === 0 ? (
          <EmptyState
            title={venues.length === 0 ? 'No venues yet' : 'No venues found'}
            description={
              venues.length === 0
                ? 'Add the venues that organizers are allowed to book.'
                : 'No venues match your search or filter.'
            }
            actionText={venues.length === 0 && !isMockMode ? 'New Venue' : undefined}
            onAction={venues.length === 0 && !isMockMode ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="px-6 py-3.5 bg-slate-50/50 border-b border-slate-100 grid grid-cols-12 text-xs font-semibold text-slate-400 min-w-[700px]">
              <div className="col-span-4">Venue</div>
              <div className="col-span-2">Seats</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Events</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-slate-100">
              {visibleVenues.map((v) => (
                <div
                  key={v._id}
                  className="px-6 py-4 grid grid-cols-12 items-center text-xs hover:bg-slate-50/50 transition-colors min-w-[700px]"
                >
                  <div className="col-span-4 min-w-0 pr-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-900 truncate">{v.name}</span>
                    </div>
                    {v.description && (
                      <span className="text-slate-400 truncate block mt-0.5 pl-5">{v.description}</span>
                    )}
                  </div>

                  <div className="col-span-2 text-slate-600 font-medium">
                    {v.capacity ? v.capacity : <span className="text-slate-400">No limit</span>}
                  </div>

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(v)}
                      disabled={isMockMode}
                      className={`disabled:cursor-not-allowed inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                        v.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                      }`}
                      title={v.isActive ? 'Click to make unavailable for new bookings' : 'Click to make available'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${v.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>{v.isActive ? 'Active' : 'Inactive'}</span>
                    </button>
                  </div>

                  <div className="col-span-2 text-slate-600 font-medium">{v.eventCount ?? 0}</div>

                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(v)}
                      disabled={isMockMode}
                      className="disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors"
                      title="Edit venue"
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(v)}
                      disabled={isMockMode || (v.eventCount ?? 0) > 0}
                      className="p-1.5 rounded-xl text-slate-400 enabled:hover:text-red-600 enabled:hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={(v.eventCount ?? 0) > 0 ? 'Used by events: deactivate it instead' : 'Delete venue'}
                      aria-label="Delete venue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {isFormOpen && (
        <div
          ref={formDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="venue-form-title"
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isSaving && setIsFormOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.08)] p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 id="venue-form-title" className="text-lg font-bold text-slate-900">
                {editing ? 'Edit Venue' : 'New Venue'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label="Close"
                className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="venue-name">
                  Name
                </label>
                <input
                  id="venue-name"
                  type="text"
                  required
                  value={form.name}
                  maxLength={LIMITS.VENUE_MAX}
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. University Gymnasium"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900"
                />
                {formErrors.name && <p role="alert" className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                {editing && editing.eventCount > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Renaming also updates the {editing.eventCount} event{editing.eventCount === 1 ? '' : 's'} held here.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="venue-capacity">
                  Seating capacity <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="venue-capacity"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={LIMITS.CAPACITY_MAX}
                  step="1"
                  value={form.capacity}
                  onKeyDown={(e) => {
                    if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Leave empty for no limit"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900"
                />
                {formErrors.capacity && <p role="alert" className="text-xs text-red-600 mt-1">{formErrors.capacity}</p>}
                <p className="text-[11px] text-slate-500 mt-1">Events held here can't have more seats than this.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="venue-description">
                  Notes <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="venue-description"
                  rows={3}
                  value={form.description}
                  maxLength={LIMITS.DESCRIPTION_MAX}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Location, facilities, access notes..."
                  className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 resize-y"
                />
                {formErrors.description && <p role="alert" className="text-xs text-red-600 mt-1">{formErrors.description}</p>}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editing ? 'Save Venue' : 'Add Venue'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleting)}
        title="Delete Venue"
        message={`Delete "${deleting?.name}"? Organizers will no longer be able to book it. This can't be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
