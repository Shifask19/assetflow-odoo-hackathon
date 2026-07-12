import React, { useEffect, useState } from 'react';
import { Plus, Calendar, X, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { bookingsApi, assetsApi } from '../api/client';
import { Booking, Asset } from '../types';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  format, startOfDay, addDays, isSameDay, parseISO, addHours, startOfHour
} from 'date-fns';

// Hour slots to display (8am – 8pm)
const HOUR_START = 8;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function timeLabel(h: number) {
  if (h === 12) return '12:00';
  return h < 12 ? `${h}:00` : `${h - 12}:00`;
}

function getSlotBookings(bookings: Booking[], hour: number, date: Date) {
  return bookings.filter(b => {
    const start = parseISO(b.start_time);
    const end = parseISO(b.end_time);
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    return b.status !== 'Cancelled' && start < slotEnd && end > slotStart;
  });
}

export default function Bookings() {
  const { isAssetManager, user } = useAuth();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookableAssets, setBookableAssets] = useState<Asset[]>([]);
  const [allBookableAssets, setAllBookableAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetBookings, setAssetBookings] = useState<Booking[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [prefillHour, setPrefillHour] = useState<number | null>(null);

  const [form, setForm] = useState({ asset_id: '', start_time: '', end_time: '', purpose: '' });
  const [conflictInfo, setConflictInfo] = useState<any>(null);

  const load = () => {
    setLoading(true);
    bookingsApi.getAll()
      .then(r => setBookings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    assetsApi.getAll().then(r => {
      const bookable = r.data.filter((a: Asset) => a.is_bookable === 1);
      setAllBookableAssets(bookable);
      setBookableAssets(bookable);
      if (bookable.length > 0) {
        setSelectedAsset(bookable[0]);
      }
    }).catch(() => {});
  }, []);

  // When asset selection changes, fetch that asset's bookings
  useEffect(() => {
    if (!selectedAsset) return;
    bookingsApi.getCalendar(selectedAsset.id).then(r => setAssetBookings(r.data)).catch(() => {});
  }, [selectedAsset]);

  // Also refresh when bookings change
  useEffect(() => {
    if (!selectedAsset) return;
    const filtered = bookings.filter(b => b.asset_id === selectedAsset.id && b.status !== 'Cancelled' && b.status !== 'Completed');
    setAssetBookings(filtered);
  }, [bookings, selectedAsset]);

  const openBookSlot = (hour: number) => {
    if (!selectedAsset) return;
    const start = new Date(selectedDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(hour + 1, 0, 0, 0);
    setForm({
      asset_id: selectedAsset.id,
      start_time: format(start, "yyyy-MM-dd'T'HH:mm"),
      end_time: format(end, "yyyy-MM-dd'T'HH:mm"),
      purpose: ''
    });
    setConflictInfo(null);
    setShowCreate(true);
  };

  const createBooking = async () => {
    if (!form.asset_id || !form.start_time || !form.end_time)
      return toast.error('Asset, start and end time are required');
    if (new Date(form.start_time) >= new Date(form.end_time))
      return toast.error('End time must be after start time');
    try {
      await bookingsApi.create({
        asset_id: form.asset_id,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        purpose: form.purpose || null,
      });
      toast.success('Booking confirmed');
      setShowCreate(false);
      setConflictInfo(null);
      setForm({ asset_id: '', start_time: '', end_time: '', purpose: '' });
      load();
    } catch (e: any) {
      const conflict = e?.response?.data?.conflict;
      if (conflict) {
        setConflictInfo(conflict);
        toast.error(`Slot already booked by ${conflict.booked_by}`);
      } else {
        toast.error(e?.response?.data?.error ?? 'Error creating booking');
      }
    }
  };

  const cancelBooking = async () => {
    if (!cancelTarget) return;
    try {
      await bookingsApi.cancel(cancelTarget.id);
      toast.success('Booking cancelled');
      setCancelTarget(null);
      load();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const canCancel = (b: Booking) =>
    !['Cancelled', 'Completed'].includes(b.status) &&
    (b.booked_by === user?.id || isAssetManager());

  // Build hour->bookings map for the selected day
  const dayBookingsMap: Record<number, Booking[]> = {};
  HOURS.forEach(h => {
    dayBookingsMap[h] = getSlotBookings(assetBookings, h, selectedDate);
  });

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 bg-white border border-slate-200 rounded-xl p-1.5">
          <button onClick={() => setView('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'calendar' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            Calendar
          </button>
          <button onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            List
          </button>
        </div>
        <button onClick={() => { setForm({ asset_id: selectedAsset?.id ?? '', start_time: '', end_time: '', purpose: '' }); setConflictInfo(null); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 font-medium">
          <Plus className="w-4 h-4" /> Book Resource
        </button>
      </div>

      {/* ── CALENDAR VIEW ── */}
      {view === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Asset selector sidebar */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase">Resource</p>
            </div>
            <div className="divide-y divide-slate-100">
              {allBookableAssets.map(a => (
                <button key={a.id} onClick={() => setSelectedAsset(a)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    selectedAsset?.id === a.id ? 'bg-purple-50 border-r-2 border-purple-600' : 'hover:bg-slate-50'
                  }`}>
                  <div className="font-medium text-slate-800">{a.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{a.location ?? 'No location'}</div>
                </button>
              ))}
              {allBookableAssets.length === 0 && (
                <div className="px-4 py-6 text-xs text-slate-400 text-center">No bookable assets</div>
              )}
            </div>
          </div>

          {/* Calendar */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Date nav */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  {selectedAsset ? selectedAsset.name : 'Select a resource'}
                </p>
                <p className="text-sm font-semibold text-slate-800">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedDate(d => addDays(d, -1))}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedDate(startOfDay(new Date()))}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50">
                  Today
                </button>
                <button onClick={() => setSelectedDate(d => addDays(d, 1))}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Time slots */}
            <div className="overflow-y-auto max-h-[520px]">
              {HOURS.map(hour => {
                const slotBookings = dayBookingsMap[hour];
                const isBooked = slotBookings.length > 0;
                const isPast = new Date() > new Date(selectedDate.getTime() + (hour + 1) * 3600000 - selectedDate.getHours() * 3600000);

                return (
                  <div key={hour} className="flex items-stretch border-b border-slate-100 last:border-0 group">
                    {/* Hour label */}
                    <div className="w-16 flex-shrink-0 px-3 py-3 text-xs text-slate-400 font-medium border-r border-slate-100 bg-slate-50">
                      {timeLabel(hour)}
                    </div>

                    {/* Slot content */}
                    <div className="flex-1 min-h-[52px] relative">
                      {isBooked ? (
                        slotBookings.map(b => (
                          <div key={b.id} className="mx-2 my-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-xs flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{b.purpose ?? 'Booked'}</p>
                              <p className="opacity-80 mt-0.5">
                                {format(parseISO(b.start_time), 'HH:mm')} to {format(parseISO(b.end_time), 'HH:mm')} · {b.booked_by_name}
                              </p>
                            </div>
                            {canCancel(b) && (
                              <button onClick={() => setCancelTarget(b)}
                                className="flex-shrink-0 p-1 hover:bg-blue-600 rounded">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        !isPast && selectedAsset && (
                          <button onClick={() => openBookSlot(hour)}
                            className="w-full h-full min-h-[52px] text-left px-4 py-2 text-xs text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-colors">
                            + Book this slot
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">All Bookings ({bookings.length})</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-6 w-6 border-4 border-purple-600 border-t-transparent" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Calendar className="w-12 h-12 mb-2 opacity-30" />
              <p>No bookings found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Asset', 'Booked By', 'Start', 'End', 'Purpose', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{b.asset_name}</div>
                        <div className="font-mono text-xs text-slate-400">{b.asset_tag}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.booked_by_name}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{format(parseISO(b.start_time), 'MMM d, HH:mm')}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{format(parseISO(b.end_time), 'MMM d, HH:mm')}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{b.purpose ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3">
                        {canCancel(b) && (
                          <button onClick={() => setCancelTarget(b)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium">
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Booking Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setConflictInfo(null); }} title="Book a Resource"
        footer={
          <>
            <button onClick={() => { setShowCreate(false); setConflictInfo(null); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={createBooking} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Confirm Booking</button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bookable Resource *</label>
            <select value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none">
              <option value="">— Select Resource —</option>
              {allBookableAssets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} – {a.name} ({a.location ?? 'No location'})</option>)}
            </select>
          </div>

          {/* Conflict banner */}
          {conflictInfo && (
            <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700">
                <p className="font-semibold">
                  Requested {conflictInfo.start_time ? format(parseISO(conflictInfo.start_time), 'HH:mm') : ''} to{' '}
                  {conflictInfo.end_time ? format(parseISO(conflictInfo.end_time), 'HH:mm') : ''} — conflict — slot is unavailable
                </p>
                <p className="mt-0.5">Booked by: {conflictInfo.booked_by} · {conflictInfo.purpose ?? 'No purpose stated'}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
              <input type="datetime-local" value={form.start_time} onChange={e => { setForm(f => ({ ...f, start_time: e.target.value })); setConflictInfo(null); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
              <input type="datetime-local" value={form.end_time} onChange={e => { setForm(f => ({ ...f, end_time: e.target.value })); setConflictInfo(null); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
            <input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              placeholder="e.g. Team presentation, Client meeting..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel Booking"
        footer={
          <>
            <button onClick={() => setCancelTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Keep Booking</button>
            <button onClick={cancelBooking} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Cancel Booking</button>
          </>
        }>
        <p className="text-sm text-slate-600">
          Cancel booking for <span className="font-semibold">{cancelTarget?.asset_name}</span> on{' '}
          {cancelTarget && format(parseISO(cancelTarget.start_time), 'MMM d, yyyy HH:mm')}?
        </p>
      </Modal>
    </div>
  );
}
