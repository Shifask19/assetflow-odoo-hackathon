import React, { useEffect, useState } from 'react';
import { Plus, ArrowRightLeft, RotateCcw, Check, X, AlertTriangle } from 'lucide-react';
import { allocationsApi, assetsApi, employeesApi, departmentsApi } from '../api/client';
import { Allocation, TransferRequest, Asset, User, Department } from '../types';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type Tab = 'allocations' | 'transfers';

export default function Allocations() {
  const { isAssetManager, user } = useAuth();
  const [tab, setTab] = useState<Tab>('allocations');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Allocation modal
  const [showAllocate, setShowAllocate] = useState(false);
  const [allocForm, setAllocForm] = useState({ asset_id: '', employee_id: '', department_id: '', expected_return_date: '' });
  const [allocConflict, setAllocConflict] = useState<{ name: string; email: string } | null>(null);
  const [allocAssetName, setAllocAssetName] = useState('');

  // Return modal
  const [showReturn, setShowReturn] = useState<Allocation | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  // Transfer request — inline in tab
  const [transferForm, setTransferForm] = useState({
    asset_id: '', asset_label: '', from_employee_id: '', to_employee_id: '', to_department_id: '', notes: ''
  });
  const [transferConflict, setTransferConflict] = useState<string | null>(null);

  // Reject transfer
  const [rejectTransfer, setRejectTransfer] = useState<TransferRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      allocationsApi.getAll(),
      allocationsApi.getTransferRequests(),
    ]).then(([a, t]) => {
      setAllocations(a.data);
      setTransfers(t.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    assetsApi.getAll({ status: 'Available' }).then(r => setAssets(r.data)).catch(() => {});
    assetsApi.getAll().then(r => setAllAssets(r.data)).catch(() => {});
    employeesApi.getAll().then(r => setEmployees(r.data)).catch(() => {});
    departmentsApi.getAll().then(r => setDepartments(r.data)).catch(() => {});
  }, []);

  // When asset is selected in allocation form, check for existing allocation
  const handleAllocAssetChange = (assetId: string) => {
    setAllocForm(f => ({ ...f, asset_id: assetId }));
    setAllocConflict(null);
    setAllocAssetName('');
    if (!assetId) return;
    const asset = allAssets.find(a => a.id === assetId);
    if (asset) setAllocAssetName(asset.name);
    const existing = allocations.find(
      al => al.asset_id === assetId && (al.status === 'Active' || al.status === 'Overdue')
    );
    if (existing) {
      setAllocConflict({ name: existing.employee_name ?? 'Unknown', email: existing.employee_email ?? '' });
    }
  };

  // When asset is selected in transfer form
  const handleTransferAssetChange = (assetId: string) => {
    const asset = allAssets.find(a => a.id === assetId);
    setTransferForm(f => ({ ...f, asset_id: assetId, asset_label: asset ? `${asset.asset_tag} – ${asset.name}` : '' }));
    setTransferConflict(null);
    if (!assetId) return;
    const existing = allocations.find(
      al => al.asset_id === assetId && (al.status === 'Active' || al.status === 'Overdue')
    );
    if (existing) {
      setTransferConflict(`Already allocated to ${existing.employee_name} (${existing.department_name ?? 'No dept'})`);
      setTransferForm(f => ({ ...f, from_employee_id: existing.employee_id }));
    }
  };

  const createAllocation = async () => {
    if (!allocForm.asset_id || !allocForm.employee_id) return toast.error('Asset and employee required');
    try {
      await allocationsApi.create({
        ...allocForm,
        department_id: allocForm.department_id || null,
        expected_return_date: allocForm.expected_return_date || null,
      });
      toast.success('Asset allocated');
      setShowAllocate(false);
      setAllocForm({ asset_id: '', employee_id: '', department_id: '', expected_return_date: '' });
      setAllocConflict(null);
      load();
    } catch (e: any) {
      const err = e?.response?.data;
      if (err?.current_holder) {
        setAllocConflict({ name: err.current_holder.name, email: err.current_holder.email });
      }
      toast.error(err?.error ?? 'Error allocating asset');
    }
  };

  const returnAsset = async () => {
    if (!showReturn) return;
    try {
      await allocationsApi.return(showReturn.id, returnNotes || undefined);
      toast.success('Asset returned');
      setShowReturn(null);
      setReturnNotes('');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const createTransfer = async () => {
    if (!transferForm.asset_id) return toast.error('Asset is required');
    try {
      await allocationsApi.createTransferRequest({
        asset_id: transferForm.asset_id,
        from_employee_id: transferForm.from_employee_id || null,
        to_employee_id: transferForm.to_employee_id || null,
        to_department_id: transferForm.to_department_id || null,
        notes: transferForm.notes || null,
      });
      toast.success('Transfer request submitted');
      setTransferForm({ asset_id: '', asset_label: '', from_employee_id: '', to_employee_id: '', to_department_id: '', notes: '' });
      setTransferConflict(null);
      load();
      setTab('transfers');
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const approveTransfer = async (id: string) => {
    try {
      await allocationsApi.approveTransfer(id);
      toast.success('Transfer approved');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const rejectTransferReq = async () => {
    if (!rejectTransfer) return;
    try {
      await allocationsApi.rejectTransfer(rejectTransfer.id, rejectNotes || undefined);
      toast.success('Transfer rejected');
      setRejectTransfer(null);
      setRejectNotes('');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const pendingTransfers = transfers.filter(t => t.status === 'Requested').length;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 bg-white border border-slate-200 rounded-xl p-1.5 w-fit">
        {([
          { id: 'allocations', label: 'Allocations' },
          { id: 'transfers', label: 'Transfer Requests' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {label}
            {id === 'transfers' && pendingTransfers > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                {pendingTransfers}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ALLOCATIONS TAB ── */}
      {tab === 'allocations' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left: allocation table */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Allocations ({allocations.length})</h3>
              {isAssetManager() && (
                <button onClick={() => { setShowAllocate(true); setAllocConflict(null); setAllocForm({ asset_id: '', employee_id: '', department_id: '', expected_return_date: '' }); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> Allocate
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Asset', 'Employee', 'Department', 'Status', 'Expected Return', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allocations.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{a.asset_name}</div>
                          <div className="font-mono text-xs text-slate-400">{a.asset_tag}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800">{a.employee_name}</div>
                          <div className="text-xs text-slate-400">{a.employee_email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.department_name ?? '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {a.expected_return_date ? format(new Date(a.expected_return_date), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {['Active', 'Overdue'].includes(a.status) && isAssetManager() && (
                            <button onClick={() => { setShowReturn(a); setReturnNotes(''); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-medium">
                              <RotateCcw className="w-3.5 h-3.5" /> Return
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allocations.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <ArrowRightLeft className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">No allocations found</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Transfer Request inline form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              Transfer Request
            </h3>

            {/* Asset selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Asset</label>
              <select
                value={transferForm.asset_id}
                onChange={e => handleTransferAssetChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— Select Asset —</option>
                {allAssets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} – {a.name}</option>)}
              </select>
            </div>

            {/* Conflict banner */}
            {transferConflict && (
              <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-700">
                  <p className="font-semibold">{transferConflict}</p>
                  <p className="mt-0.5">Submit a transfer request below</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">From</label>
                <select value={transferForm.from_employee_id}
                  onChange={e => setTransferForm(f => ({ ...f, from_employee_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">— Employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">To</label>
                <select value={transferForm.to_employee_id}
                  onChange={e => setTransferForm(f => ({ ...f, to_employee_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">— Select Employee —</option>
                  {employees.filter(e => e.status === 'active').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Reason / Notes</label>
              <textarea
                value={transferForm.notes}
                onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Reason for transfer..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            <button onClick={createTransfer}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              Submit Request
            </button>

            {/* Allocation History (compact) */}
            {allocations.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Allocation History</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {allocations.slice(0, 10).map(a => (
                    <div key={a.id} className="text-xs text-slate-600 py-1 border-b border-slate-100 last:border-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mr-1">{a.asset_tag}</span>
                          <span className="font-medium text-slate-700">→ {a.employee_name}</span>
                          {a.department_name && <span className="text-slate-400"> · {a.department_name}</span>}
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      {a.condition_checkin_notes && (
                        <p className="text-slate-400 italic pl-1">condition: {a.condition_checkin_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TRANSFERS TAB ── */}
      {tab === 'transfers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Transfer Requests ({transfers.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Asset', 'From', 'To', 'Requested By', 'Notes', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{t.asset_name}</div>
                      <div className="font-mono text-xs text-slate-400">{t.asset_tag}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.from_employee_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{t.to_employee_name ?? t.to_department_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{t.requested_by_name}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate">{t.notes ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {format(new Date(t.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      {t.status === 'Requested' && isAssetManager() && (
                        <div className="flex gap-2">
                          <button onClick={() => approveTransfer(t.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-medium">
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button onClick={() => { setRejectTransfer(t); setRejectNotes(''); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium">
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transfers.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <ArrowRightLeft className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No transfer requests</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Allocate Modal */}
      <Modal isOpen={showAllocate} onClose={() => setShowAllocate(false)} title="Allocate Asset"
        footer={
          <>
            <button onClick={() => setShowAllocate(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={createAllocation} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Allocate</button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Asset *</label>
            <select value={allocForm.asset_id} onChange={e => handleAllocAssetChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">— Select Asset —</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} – {a.name}</option>)}
            </select>
          </div>

          {/* Conflict warning */}
          {allocConflict && (
            <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700">
                <p className="font-semibold">Already allocated to {allocConflict.name}</p>
                <p>{allocConflict.email}</p>
                <p className="mt-1">Submit a transfer request instead.</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={allocForm.employee_id} onChange={e => setAllocForm(f => ({ ...f, employee_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">— Select Employee —</option>
              {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select value={allocForm.department_id} onChange={e => setAllocForm(f => ({ ...f, department_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">— None —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expected Return Date</label>
            <input type="date" value={allocForm.expected_return_date} onChange={e => setAllocForm(f => ({ ...f, expected_return_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
      </Modal>

      {/* Return Modal */}
      <Modal isOpen={!!showReturn} onClose={() => setShowReturn(null)} title="Return Asset"
        footer={
          <>
            <button onClick={() => setShowReturn(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={returnAsset} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">Confirm Return</button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Returning <span className="font-semibold">{showReturn?.asset_name}</span> from{' '}
            <span className="font-semibold">{showReturn?.employee_name}</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Condition / Check-in Notes</label>
            <textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)} rows={3}
              placeholder="Note any damage, wear, or observations..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
        </div>
      </Modal>

      {/* Reject Transfer Modal */}
      <Modal isOpen={!!rejectTransfer} onClose={() => setRejectTransfer(null)} title="Reject Transfer Request"
        footer={
          <>
            <button onClick={() => setRejectTransfer(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={rejectTransferReq} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Reject</button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Rejecting transfer for <span className="font-semibold">{rejectTransfer?.asset_name}</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
            <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
