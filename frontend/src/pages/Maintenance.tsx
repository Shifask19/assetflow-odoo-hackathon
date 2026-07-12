import React, { useEffect, useState } from 'react';
import { Plus, Wrench, Check, X, UserCheck, Play, Info } from 'lucide-react';
import { maintenanceApi, assetsApi, employeesApi } from '../api/client';
import { MaintenanceRequest, Asset, User } from '../types';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

const PRIORITY_BORDER: Record<string, string> = {
  Low: 'border-l-slate-400',
  Medium: 'border-l-blue-400',
  High: 'border-l-orange-400',
  Critical: 'border-l-red-500',
};

type KanbanColumn = {
  status: MaintenanceRequest['status'];
  label: string;
  color: string;
  bg: string;
};

const COLUMNS: KanbanColumn[] = [
  { status: 'Pending', label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  { status: 'Approved', label: 'Approved', color: 'text-green-700', bg: 'bg-green-50' },
  { status: 'Technician Assigned', label: 'Technician Assigned', color: 'text-blue-700', bg: 'bg-blue-50' },
  { status: 'In Progress', label: 'In Progress', color: 'text-orange-700', bg: 'bg-orange-50' },
  { status: 'Resolved', label: 'Resolved', color: 'text-teal-700', bg: 'bg-teal-50' },
];

export default function Maintenance() {
  const { isAssetManager, user } = useAuth();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedReq, setSelectedReq] = useState<MaintenanceRequest | null>(null);
  const [assignTarget, setAssignTarget] = useState<MaintenanceRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MaintenanceRequest | null>(null);
  const [resolveTarget, setResolveTarget] = useState<MaintenanceRequest | null>(null);

  const [form, setForm] = useState({ asset_id: '', issue_description: '', priority: 'Medium' });
  const [technicianId, setTechnicianId] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');

  const load = () => {
    setLoading(true);
    maintenanceApi.getAll()
      .then(r => setRequests(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    assetsApi.getAll().then(r => setAssets(r.data)).catch(() => {});
    employeesApi.getAll().then(r => setEmployees(r.data)).catch(() => {});
  }, []);

  const createRequest = async () => {
    if (!form.asset_id || !form.issue_description.trim()) return toast.error('Asset and description required');
    try {
      await maintenanceApi.create(form);
      toast.success('Maintenance request submitted');
      setShowCreate(false);
      setForm({ asset_id: '', issue_description: '', priority: 'Medium' });
      load();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const approve = async (id: string) => {
    try { await maintenanceApi.approve(id); toast.success('Request approved'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    try { await maintenanceApi.reject(rejectTarget.id, rejectNotes || undefined); toast.success('Rejected'); setRejectTarget(null); setRejectNotes(''); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const assign = async () => {
    if (!assignTarget || !technicianId) return toast.error('Select a technician');
    try { await maintenanceApi.assign(assignTarget.id, technicianId); toast.success('Technician assigned'); setAssignTarget(null); setTechnicianId(''); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const progress = async (id: string) => {
    try { await maintenanceApi.progress(id); toast.success('Marked In Progress'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const resolve = async () => {
    if (!resolveTarget) return;
    try { await maintenanceApi.resolve(resolveTarget.id, resolveNotes || undefined); toast.success('Resolved'); setResolveTarget(null); setResolveNotes(''); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const isTechnician = (req: MaintenanceRequest) => req.technician_id === user?.id;

  // Group by status
  const byStatus: Record<string, MaintenanceRequest[]> = {};
  COLUMNS.forEach(c => { byStatus[c.status] = []; });
  requests.forEach(r => {
    if (byStatus[r.status]) byStatus[r.status].push(r);
    // Rejected goes into a separate bucket but we still show it in list
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 bg-white border border-slate-200 rounded-xl p-1.5">
          <button onClick={() => setView('kanban')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'kanban' ? 'bg-orange-500 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            Kanban
          </button>
          <button onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-orange-500 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            List
          </button>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Raise Request
        </button>
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-500 italic">
        Approving a card moves the asset to Under Maintenance; resolving it marks return to Available.
      </p>

      {/* ── KANBAN ── */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map(col => (
            <div key={col.status} className="flex-shrink-0 w-56 flex flex-col">
              {/* Column header */}
              <div className={`${col.bg} rounded-t-xl px-3 py-2.5 flex items-center justify-between`}>
                <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                <span className={`text-xs font-bold ${col.color} bg-white rounded-full w-5 h-5 flex items-center justify-center`}>
                  {byStatus[col.status]?.length ?? 0}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 bg-slate-100 rounded-b-xl p-2 space-y-2 min-h-[200px]">
                {loading ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="animate-spin rounded-full h-5 w-5 border-4 border-orange-500 border-t-transparent" />
                  </div>
                ) : (byStatus[col.status] ?? []).map(req => (
                  <div key={req.id}
                    className={`bg-white rounded-lg border-l-4 ${PRIORITY_BORDER[req.priority]} shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow`}
                    onClick={() => setSelectedReq(req)}>
                    {/* Asset */}
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-slate-400">{req.asset_tag}</p>
                        <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{req.asset_name}</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_COLORS[req.priority]}`}>
                        {req.priority}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{req.issue_description}</p>

                    {req.technician_name && (
                      <p className="text-xs text-blue-600 mb-1.5">👷 {req.technician_name}</p>
                    )}

                    <p className="text-xs text-slate-400">{format(new Date(req.created_at), 'MMM d, yyyy')}</p>

                    {/* Action buttons — stop propagation */}
                    <div className="flex flex-wrap gap-1 mt-2" onClick={e => e.stopPropagation()}>
                      {req.status === 'Pending' && isAssetManager() && (
                        <>
                          <button onClick={() => approve(req.id)}
                            className="flex items-center gap-0.5 px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-medium">
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button onClick={() => { setRejectTarget(req); setRejectNotes(''); }}
                            className="flex items-center gap-0.5 px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-medium">
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                      {req.status === 'Approved' && isAssetManager() && (
                        <button onClick={() => { setAssignTarget(req); setTechnicianId(''); }}
                          className="flex items-center gap-0.5 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium">
                          <UserCheck className="w-3 h-3" /> Assign
                        </button>
                      )}
                      {req.status === 'Technician Assigned' && (isTechnician(req) || isAssetManager()) && (
                        <button onClick={() => progress(req.id)}
                          className="flex items-center gap-0.5 px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-medium">
                          <Play className="w-3 h-3" /> Start
                        </button>
                      )}
                      {req.status === 'In Progress' && (isTechnician(req) || isAssetManager()) && (
                        <button onClick={() => { setResolveTarget(req); setResolveNotes(''); }}
                          className="flex items-center gap-0.5 px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded text-xs font-medium">
                          <Check className="w-3 h-3" /> Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {(byStatus[col.status] ?? []).length === 0 && !loading && (
                  <div className="flex items-center justify-center h-20 text-slate-400">
                    <p className="text-xs">No items</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Rejected column (separate, smaller) */}
          {requests.filter(r => r.status === 'Rejected').length > 0 && (
            <div className="flex-shrink-0 w-48 flex flex-col">
              <div className="bg-red-50 rounded-t-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-red-600">Rejected</span>
                <span className="text-xs font-bold text-red-600 bg-white rounded-full w-5 h-5 flex items-center justify-center">
                  {requests.filter(r => r.status === 'Rejected').length}
                </span>
              </div>
              <div className="flex-1 bg-slate-100 rounded-b-xl p-2 space-y-2 min-h-[100px]">
                {requests.filter(r => r.status === 'Rejected').map(req => (
                  <div key={req.id} className="bg-white rounded-lg border-l-4 border-l-red-300 p-3 cursor-pointer hover:shadow-sm"
                    onClick={() => setSelectedReq(req)}>
                    <p className="text-xs font-mono text-slate-400">{req.asset_tag}</p>
                    <p className="text-sm font-semibold text-slate-700 truncate">{req.asset_name}</p>
                    <p className="text-xs text-slate-400 mt-1">{format(new Date(req.created_at), 'MMM d')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Maintenance Requests ({requests.length})</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-6 w-6 border-4 border-orange-500 border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Asset', 'Issue', 'Priority', 'Status', 'Raised By', 'Technician', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedReq(r)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{r.asset_name}</div>
                        <div className="font-mono text-xs text-slate-400">{r.asset_tag}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">{r.issue_description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-slate-600">{r.raised_by_name}</td>
                      <td className="px-4 py-3 text-slate-600">{r.technician_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5 flex-wrap">
                          {r.status === 'Pending' && isAssetManager() && (
                            <>
                              <button onClick={() => approve(r.id)} className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-medium"><Check className="w-3 h-3" /> Approve</button>
                              <button onClick={() => { setRejectTarget(r); setRejectNotes(''); }} className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-medium"><X className="w-3 h-3" /> Reject</button>
                            </>
                          )}
                          {r.status === 'Approved' && isAssetManager() && (
                            <button onClick={() => { setAssignTarget(r); setTechnicianId(''); }} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium"><UserCheck className="w-3 h-3" /> Assign</button>
                          )}
                          {r.status === 'Technician Assigned' && (isTechnician(r) || isAssetManager()) && (
                            <button onClick={() => progress(r.id)} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-medium"><Play className="w-3 h-3" /> Start</button>
                          )}
                          {r.status === 'In Progress' && (isTechnician(r) || isAssetManager()) && (
                            <button onClick={() => { setResolveTarget(r); setResolveNotes(''); }} className="flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded text-xs font-medium"><Check className="w-3 h-3" /> Resolve</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {requests.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Wrench className="w-12 h-12 mb-2 opacity-30" />
                  <p>No maintenance requests</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Raise Maintenance Request"
        footer={<><button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={createRequest} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">Submit</button></>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Asset *</label>
            <select value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
              <option value="">— Select Asset —</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} – {a.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Issue Description *</label>
            <textarea value={form.issue_description} onChange={e => setForm(f => ({ ...f, issue_description: e.target.value }))} rows={4}
              placeholder="Describe the issue in detail..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none" /></div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedReq} onClose={() => setSelectedReq(null)} title="Request Details" size="lg">
        {selectedReq && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Asset', `${selectedReq.asset_tag} – ${selectedReq.asset_name}`],
                ['Status', null], ['Priority', null],
                ['Raised By', selectedReq.raised_by_name],
                ['Approved By', selectedReq.approved_by_name ?? '—'],
                ['Technician', selectedReq.technician_name ?? '—'],
                ['Created', format(new Date(selectedReq.created_at), 'MMM d, yyyy HH:mm')],
                ['Resolved', selectedReq.resolved_at ? format(new Date(selectedReq.resolved_at), 'MMM d, yyyy HH:mm') : '—'],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div className="text-xs font-medium text-slate-400 uppercase mb-1">{label}</div>
                  {label === 'Status' ? <StatusBadge status={selectedReq.status} size="md" /> :
                   label === 'Priority' ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[selectedReq.priority]}`}>{selectedReq.priority}</span> :
                   <div className="text-slate-800">{value as string}</div>}
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase mb-1">Issue Description</div>
              <div className="text-slate-800 bg-slate-50 rounded-lg p-3">{selectedReq.issue_description}</div>
            </div>
            {selectedReq.technician_notes && (
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase mb-1">Technician Notes</div>
                <div className="text-slate-800 bg-slate-50 rounded-lg p-3">{selectedReq.technician_notes}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={!!assignTarget} onClose={() => setAssignTarget(null)} title="Assign Technician"
        footer={<><button onClick={() => setAssignTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={assign} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Assign</button></>}>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Technician *</label>
          <select value={technicianId} onChange={e => setTechnicianId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">— Select —</option>
            {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
          </select></div>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Request"
        footer={<><button onClick={() => setRejectTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={reject} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Reject</button></>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Rejecting request for <span className="font-semibold">{rejectTarget?.asset_name}</span>.</p>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
            <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none" /></div>
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal isOpen={!!resolveTarget} onClose={() => setResolveTarget(null)} title="Resolve Maintenance"
        footer={<><button onClick={() => setResolveTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={resolve} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">Mark Resolved</button></>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Resolving maintenance for <span className="font-semibold">{resolveTarget?.asset_name}</span>.</p>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Technician Notes</label>
            <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} rows={3}
              placeholder="Describe what was done..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none" /></div>
        </div>
      </Modal>
    </div>
  );
}
