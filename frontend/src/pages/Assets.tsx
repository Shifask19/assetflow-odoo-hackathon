import React, { useEffect, useState } from 'react';
import { Plus, Search, Package, Tag, X } from 'lucide-react';
import { assetsApi, categoriesApi, departmentsApi } from '../api/client';
import { Asset, AssetCategory, Department } from '../types';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUSES = ['Available', 'Allocated', 'Reserved', 'Under Maintenance', 'Lost', 'Retired', 'Disposed'];
const CONDITIONS = ['Good', 'Fair', 'Poor'];

export default function Assets() {
  const { isAssetManager } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetDetail, setAssetDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'details'|'history'>('details');

  const [form, setForm] = useState({
    name: '', category_id: '', serial_number: '', acquisition_date: '',
    acquisition_cost: '', condition: 'Good', location: '', department_id: '',
    is_bookable: false, notes: '', status: 'Available'
  });

  const load = () => {
    const params: any = {};
    if (search) params.search = search;
    if (filterCat) params.category = filterCat;
    if (filterStatus) params.status = filterStatus;
    if (filterDept) params.department = filterDept;
    assetsApi.getAll(params).then(r => setAssets(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    categoriesApi.getAll().then(r => setCategories(r.data)).catch(() => {});
    departmentsApi.getAll().then(r => setDepartments(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [search, filterCat, filterStatus, filterDept]);

  const openDetail = async (asset: Asset) => {
    setSelectedAsset(asset);
    setDetailTab('details');
    try {
      const [assetRes, histRes] = await Promise.all([
        assetsApi.getById(asset.id),
        assetsApi.getHistory(asset.id)
      ]);
      setAssetDetail({ ...assetRes.data, history: histRes.data });
    } catch { setAssetDetail(asset); }
  };

  const createAsset = async () => {
    if (!form.name.trim()) return toast.error('Asset name required');
    try {
      await assetsApi.create({
        ...form,
        acquisition_cost: form.acquisition_cost ? parseFloat(form.acquisition_cost) : null,
        is_bookable: form.is_bookable ? 1 : 0,
        category_id: form.category_id || null,
        department_id: form.department_id || null,
      });
      toast.success('Asset registered');
      setShowCreate(false);
      setForm({ name: '', category_id: '', serial_number: '', acquisition_date: '', acquisition_cost: '', condition: 'Good', location: '', department_id: '', is_bookable: false, notes: '', status: 'Available' });
      load();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by tag, name, serial..." className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {isAssetManager() && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Register Asset
          </button>
        )}
      </div>

      {/* Asset table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">{assets.length} assets</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-600 border-t-transparent" /></div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Package className="w-12 h-12 mb-2 opacity-30" />
            <p>No assets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{['Tag','Name','Category','Status','Condition','Location','Department','Added'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map(a => (
                  <tr key={a.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => openDetail(a)}>
                    <td className="px-4 py-3"><span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{a.asset_tag}</span></td>
                    <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                    <td className="px-4 py-3 text-slate-600">{a.category_name ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={a.condition} /></td>
                    <td className="px-4 py-3 text-slate-600">{a.location ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{a.department_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{format(new Date(a.created_at), 'MMM d, yyyy')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Register New Asset" size="lg"
        footer={<><button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={createAsset} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Register</button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Asset Name *</label>
            <input value={form.name} onChange={setF('name')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Dell Laptop Pro" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select value={form.category_id} onChange={setF('category_id')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">— Select —</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
            <input value={form.serial_number} onChange={setF('serial_number')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Date</label>
            <input type="date" value={form.acquisition_date} onChange={setF('acquisition_date')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Acquisition Cost</label>
            <input type="number" value={form.acquisition_cost} onChange={setF('acquisition_cost')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
            <select value={form.condition} onChange={setF('condition')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input value={form.location} onChange={setF('location')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select value={form.department_id} onChange={setF('department_id')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">— None —</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={setF('status')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <input type="checkbox" id="bookable" checked={form.is_bookable} onChange={e => setForm(f => ({ ...f, is_bookable: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="bookable" className="text-sm font-medium text-slate-700">Shared / Bookable Resource</label>
          </div>
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={setF('notes')} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" /></div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal isOpen={!!selectedAsset} onClose={() => { setSelectedAsset(null); setAssetDetail(null); }} title={`${selectedAsset?.asset_tag} – ${selectedAsset?.name}`} size="xl">
        <div className="flex gap-4 mb-4">
          {(['details','history'] as const).map(t => (
            <button key={t} onClick={() => setDetailTab(t)} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${detailTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t === 'details' ? 'Asset Details' : 'History'}
            </button>
          ))}
        </div>
        {detailTab === 'details' && assetDetail && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Tag', assetDetail.asset_tag], ['Status', null], ['Condition', null],
              ['Category', assetDetail.category_name], ['Serial No.', assetDetail.serial_number],
              ['Location', assetDetail.location], ['Department', assetDetail.department_name],
              ['Acquired', assetDetail.acquisition_date ? format(new Date(assetDetail.acquisition_date), 'MMM d, yyyy') : '—'],
              ['Cost', assetDetail.acquisition_cost ? `$${assetDetail.acquisition_cost.toLocaleString()}` : '—'],
              ['Bookable', assetDetail.is_bookable ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="text-xs font-medium text-slate-400 uppercase mb-1">{label}</div>
                {label === 'Status' ? <StatusBadge status={assetDetail.status} size="md" /> :
                 label === 'Condition' ? <StatusBadge status={assetDetail.condition} size="md" /> :
                 <div className="text-slate-800">{(value as string) ?? '—'}</div>}
              </div>
            ))}
            {assetDetail.notes && (
              <div className="col-span-2">
                <div className="text-xs font-medium text-slate-400 uppercase mb-1">Notes</div>
                <div className="text-slate-800">{assetDetail.notes}</div>
              </div>
            )}
          </div>
        )}
        {detailTab === 'history' && assetDetail?.history && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Allocation History</h4>
              {assetDetail.history.allocations?.length === 0 ? <p className="text-sm text-slate-400">No allocation records</p> :
              <div className="space-y-2">
                {assetDetail.history.allocations?.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <span>{a.employee_name} ({a.department_name ?? '—'})</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{format(new Date(a.created_at), 'MMM d, yyyy')}</span>
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                ))}
              </div>}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Maintenance History</h4>
              {assetDetail.history.maintenance?.length === 0 ? <p className="text-sm text-slate-400">No maintenance records</p> :
              <div className="space-y-2">
                {assetDetail.history.maintenance?.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <span>{m.issue_description}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <StatusBadge status={m.priority} /><StatusBadge status={m.status} />
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
