import React, { useEffect, useState } from 'react';
import { Plus, ClipboardList, Users, Lock, AlertTriangle, CheckSquare, Flag } from 'lucide-react';
import { auditsApi, departmentsApi, employeesApi } from '../api/client';
import { AuditCycle, AuditItem, Department, User } from '../types';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ITEM_STATUSES = ['Pending', 'Verified', 'Missing', 'Damaged'] as const;

const ITEM_STATUS_COLORS: Record<string, string> = {
  Verified: 'bg-green-100 text-green-700 border-green-300',
  Missing: 'bg-red-100 text-red-700 border-red-300',
  Damaged: 'bg-orange-100 text-orange-700 border-orange-300',
  Pending: 'bg-slate-100 text-slate-600 border-slate-300',
};

export default function Audits() {
  const { isAssetManager } = useAuth();
  const [view, setView] = useState<'list' | 'items'>('list');
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<AuditCycle | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showAuditors, setShowAuditors] = useState<AuditCycle | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState<AuditCycle | null>(null);
  const [updateItem, setUpdateItem] = useState<AuditItem | null>(null);
  const [showReport, setShowReport] = useState<any>(null);

  const [form, setForm] = useState({ name: '', scope_department_id: '', scope_location: '', start_date: '', end_date: '' });
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [itemUpdateForm, setItemUpdateForm] = useState({ status: 'Verified', notes: '' });

  const loadCycles = () => {
    setLoading(true);
    auditsApi.getAll().then(r => setCycles(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCycles();
    departmentsApi.getAll().then(r => setDepartments(r.data)).catch(() => {});
    employeesApi.getAll().then(r => setEmployees(r.data)).catch(() => {});
  }, []);

  const openItems = async (cycle: AuditCycle) => {
    setSelectedCycle(cycle);
    setView('items');
    setItemsLoading(true);
    try {
      const res = await auditsApi.getItems(cycle.id);
      setItems(res.data);
    } catch { toast.error('Failed to load audit items'); }
    finally { setItemsLoading(false); }
  };

  const createCycle = async () => {
    if (!form.name.trim() || !form.start_date || !form.end_date) return toast.error('Name, start and end date required');
    try {
      await auditsApi.create({ name: form.name, scope_department_id: form.scope_department_id || null, scope_location: form.scope_location || null, start_date: form.start_date, end_date: form.end_date });
      toast.success('Audit cycle created');
      setShowCreate(false);
      setForm({ name: '', scope_department_id: '', scope_location: '', start_date: '', end_date: '' });
      loadCycles();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const assignAuditors = async () => {
    if (!showAuditors) return;
    try {
      await auditsApi.assignAuditors(showAuditors.id, selectedAuditors);
      toast.success(`${selectedAuditors.length} auditor(s) assigned`);
      setShowAuditors(null); setSelectedAuditors([]); loadCycles();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const closeCycle = async () => {
    if (!showCloseConfirm) return;
    try {
      const res = await auditsApi.close(showCloseConfirm.id);
      toast.success(`Cycle closed — ${res.data.summary.missing_assets} missing, ${res.data.summary.damaged_assets} damaged`);
      setShowCloseConfirm(null); loadCycles();
      if (selectedCycle?.id === showCloseConfirm.id) setSelectedCycle(prev => prev ? { ...prev, status: 'Closed' } : null);
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const saveItemUpdate = async () => {
    if (!updateItem || !selectedCycle) return;
    try {
      await auditsApi.updateItem(selectedCycle.id, updateItem.id, itemUpdateForm);
      toast.success('Item updated');
      setUpdateItem(null);
      const res = await auditsApi.getItems(selectedCycle.id);
      setItems(res.data);
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const fetchReport = async (cycle: AuditCycle) => {
    try { const res = await auditsApi.getReport(cycle.id); setShowReport(res.data); }
    catch { toast.error('Failed to load report'); }
  };

  const flaggedCount = items.filter(i => i.status === 'Missing' || i.status === 'Damaged').length;
  const verifiedCount = items.filter(i => i.status === 'Verified').length;
  const pendingCount = items.filter(i => i.status === 'Pending').length;

  return (
    <div className="space-y-4">
      {/* ── CYCLE LIST ── */}
      {view === 'list' && (
        <>
          <div className="flex items-center justify-between">
            <div />
            {isAssetManager() && (
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium">
                <Plus className="w-4 h-4" /> New Audit Cycle
              </button>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Audit Cycles ({cycles.length})</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-600 border-t-transparent" /></div>
            ) : cycles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400"><ClipboardList className="w-12 h-12 mb-2 opacity-30" /><p>No audit cycles yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>{['Name','Dept Scope','Start','End','Status','Progress','Actions'].map(h =>
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cycles.map(c => {
                      const pct = c.total_items && c.total_items > 0 ? Math.round(((c.audited_items ?? 0) / c.total_items) * 100) : 0;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                          <td className="px-4 py-3 text-slate-600">{c.scope_department_name ?? 'All'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{format(new Date(c.start_date), 'MMM d, yyyy')}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{format(new Date(c.end_date), 'MMM d, yyyy')}</td>
                          <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                          <td className="px-4 py-3 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-500">{c.audited_items ?? 0}/{c.total_items ?? 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 flex-wrap">
                              <button onClick={() => openItems(c)} className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium">
                                Start Audit
                              </button>
                              {isAssetManager() && c.status !== 'Closed' && (
                                <>
                                  <button onClick={() => { setShowAuditors(c); setSelectedAuditors([]); }} className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-medium flex items-center gap-1"><Users className="w-3 h-3" /> Auditors</button>
                                  <button onClick={() => setShowCloseConfirm(c)} className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-medium flex items-center gap-1"><Lock className="w-3 h-3" /> Close</button>
                                </>
                              )}
                              {c.status === 'Closed' && (
                                <button onClick={() => fetchReport(c)} className="px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-medium">Report</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ITEMS VIEW ── */}
      {view === 'items' && selectedCycle && (
        <div className="space-y-4">
          {/* Back + header */}
          <div className="flex items-center gap-3">
            <button onClick={() => { setView('list'); setSelectedCycle(null); setItems([]); }}
              className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              ← Back to Cycles
            </button>
            <div>
              <h2 className="font-semibold text-slate-900">{selectedCycle.name}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <StatusBadge status={selectedCycle.status} />
                <span>{format(new Date(selectedCycle.start_date), 'MMM d')} – {format(new Date(selectedCycle.end_date), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: items.length, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'Verified', value: verifiedCount, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Pending', value: pendingCount, color: 'text-yellow-700', bg: 'bg-yellow-50' },
              { label: 'Flagged', value: flaggedCount, color: 'text-red-700', bg: 'bg-red-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} border border-slate-200 rounded-xl px-4 py-3`}>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Discrepancy banner */}
          {flaggedCount > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="font-semibold text-red-800">
                {flaggedCount} asset{flaggedCount > 1 ? 's' : ''} flagged — discrepancy report generated automatically
              </span>
            </div>
          )}

          {/* Items table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Audit Checklist ({items.length})</h3>
              {selectedCycle.status !== 'Closed' && isAssetManager() && (
                <button onClick={() => setShowCloseConfirm(selectedCycle)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium">
                  <Lock className="w-3 h-3" /> Close Cycle
                </button>
              )}
            </div>
            {itemsLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Asset', 'Reported Location', 'Condition', 'Verification', 'Auditor', 'Notes', 'Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-slate-400">{item.asset_tag}</div>
                          <div className="font-medium text-slate-800">{item.asset_name}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.location ?? '—'}</td>
                        <td className="px-4 py-3">
                          {item.condition ? <StatusBadge status={item.condition} /> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ITEM_STATUS_COLORS[item.status]}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{item.auditor_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px] truncate">{item.notes ?? '—'}</td>
                        <td className="px-4 py-3">
                          {selectedCycle.status !== 'Closed' && (
                            <button
                              onClick={() => { setUpdateItem(item); setItemUpdateForm({ status: item.status, notes: item.notes ?? '' }); }}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium">
                              <CheckSquare className="w-3 h-3" /> Update
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <ClipboardList className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">No items in this audit</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Create Cycle */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Audit Cycle"
        footer={<><button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={createCycle} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Create</button></>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Cycle Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Q3 2026 Full Audit"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Scope: Department</label>
            <select value={form.scope_department_id} onChange={e => setForm(f => ({ ...f, scope_department_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">— All Departments —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Scope: Location</label>
            <input value={form.scope_location} onChange={e => setForm(f => ({ ...f, scope_location: e.target.value }))} placeholder="Optional — e.g. IT Room 101"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          </div>
        </div>
      </Modal>

      {/* Assign Auditors */}
      <Modal isOpen={!!showAuditors} onClose={() => setShowAuditors(null)} title="Assign Auditors" size="lg"
        footer={<><button onClick={() => setShowAuditors(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={assignAuditors} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Assign {selectedAuditors.length > 0 ? `(${selectedAuditors.length})` : ''}</button></>}>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {employees.filter(e => e.status === 'active').map(emp => (
            <label key={emp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selectedAuditors.includes(emp.id)}
                onChange={() => setSelectedAuditors(prev => prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id])}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{emp.name}</div>
                <div className="text-xs text-slate-500">{emp.email} · {emp.department_name ?? 'No dept'}</div>
              </div>
            </label>
          ))}
        </div>
      </Modal>

      {/* Update Item */}
      <Modal isOpen={!!updateItem} onClose={() => setUpdateItem(null)} title={`Update: ${updateItem?.asset_name}`}
        footer={<><button onClick={() => setUpdateItem(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={saveItemUpdate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button></>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-2">Verification Status</label>
            <div className="grid grid-cols-2 gap-2">
              {ITEM_STATUSES.map(s => (
                <button key={s} onClick={() => setItemUpdateForm(f => ({ ...f, status: s }))}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${itemUpdateForm.status === s ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={itemUpdateForm.notes} onChange={e => setItemUpdateForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              placeholder="Observation notes..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" /></div>
        </div>
      </Modal>

      {/* Close Cycle Confirm */}
      <Modal isOpen={!!showCloseConfirm} onClose={() => setShowCloseConfirm(null)} title="Close Audit Cycle"
        footer={<><button onClick={() => setShowCloseConfirm(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={closeCycle} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Close Cycle</button></>}>
        <div className="space-y-2 text-sm text-slate-600">
          <p>Closing <span className="font-semibold">{showCloseConfirm?.name}</span> will:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Lock the cycle — no further updates</li>
            <li>Mark <b>Missing</b> assets as <span className="text-red-600 font-medium">Lost</span></li>
            <li>Mark <b>Damaged</b> assets with <span className="text-orange-600 font-medium">Poor</span> condition</li>
          </ul>
          <p className="font-medium text-red-700 pt-1">This cannot be undone.</p>
        </div>
      </Modal>

      {/* Report Modal */}
      <Modal isOpen={!!showReport} onClose={() => setShowReport(null)} title="Audit Report" size="xl">
        {showReport && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: showReport.summary.total, color: 'text-slate-700', bg: 'bg-slate-50' },
                { label: 'Verified', value: showReport.summary.verified, color: 'text-green-700', bg: 'bg-green-50' },
                { label: 'Missing', value: showReport.summary.missing, color: 'text-red-700', bg: 'bg-red-50' },
                { label: 'Damaged', value: showReport.summary.damaged, color: 'text-orange-700', bg: 'bg-orange-50' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} border border-slate-200 rounded-xl px-4 py-3`}>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {(['Missing', 'Damaged', 'Pending', 'Verified'] as const).map(status => {
              const filtered = showReport.items.filter((i: any) => i.status === status);
              if (filtered.length === 0) return null;
              return (
                <div key={status}>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <StatusBadge status={status} /> <span>({filtered.length})</span>
                  </h4>
                  <div className="space-y-1">
                    {filtered.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                        <span className="font-medium">{item.asset_tag} – {item.asset_name}</span>
                        <span className="text-slate-500 text-xs">{item.location ?? '—'} · {item.auditor_name ?? 'No auditor'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
