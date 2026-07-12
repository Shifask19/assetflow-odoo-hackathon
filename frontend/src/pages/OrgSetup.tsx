import React, { useEffect, useState } from 'react';
import { Building2, Tag, Users, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { departmentsApi, categoriesApi, employeesApi } from '../api/client';
import { Department, AssetCategory, User } from '../types';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import toast from 'react-hot-toast';

type Tab = 'departments' | 'categories' | 'employees';

const ROLES = ['employee', 'asset_manager', 'department_head', 'admin'];
const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  asset_manager: 'Asset Manager',
  department_head: 'Department Head',
  admin: 'Admin',
};

export default function OrgSetup() {
  const [tab, setTab] = useState<Tab>('departments');

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2 bg-white border border-slate-200 rounded-xl p-1.5 w-fit">
        {([
          { id: 'departments', label: 'Departments', icon: Building2 },
          { id: 'categories', label: 'Asset Categories', icon: Tag },
          { id: 'employees', label: 'Employee Directory', icon: Users },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'employees' && <EmployeesTab />}
    </div>
  );
}

/* ── DEPARTMENTS ── */
function DepartmentsTab() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', head_id: '', parent_id: '', status: 'active' });

  const load = () => {
    departmentsApi.getAll().then(r => setDepts(r.data)).catch(() => {});
    employeesApi.getAll().then(r => setEmployees(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', head_id: '', parent_id: '', status: 'active' }); setShowModal(true); };
  const openEdit = (d: Department) => { setEditing(d); setForm({ name: d.name, head_id: d.head_id ?? '', parent_id: d.parent_id ?? '', status: d.status }); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name required');
    try {
      const payload = { name: form.name, head_id: form.head_id || null, parent_id: form.parent_id || null, status: form.status };
      if (editing) { await departmentsApi.update(editing.id, payload); toast.success('Department updated'); }
      else { await departmentsApi.create(payload); toast.success('Department created'); }
      setShowModal(false); load();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const deactivate = async (d: Department) => {
    try {
      await departmentsApi.update(d.id, { status: d.status === 'active' ? 'inactive' : 'active' });
      toast.success('Updated'); load();
    } catch { toast.error('Error'); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Departments ({depts.length})</h3>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>{['Name','Head','Parent','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {depts.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                <td className="px-4 py-3 text-slate-600">{d.head_name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{d.parent_name ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deactivate(d)} className="p-1.5 hover:bg-amber-50 text-slate-500 hover:text-amber-600 rounded">
                      {d.status === 'active' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Department' : 'New Department'}
        footer={<><button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button></>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Department Head</label>
            <select value={form.head_id} onChange={e => setForm(f => ({ ...f, head_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">— None —</option>
              {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Parent Department</label>
            <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">— None —</option>
              {depts.filter(d => d.id !== editing?.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select></div>
        </div>
      </Modal>
    </div>
  );
}

/* ── CATEGORIES ── */
function CategoriesTab() {
  const [cats, setCats] = useState<AssetCategory[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AssetCategory | null>(null);
  const [form, setForm] = useState({ name: '', description: '', fields: [] as {key:string;value:string}[] });

  const load = () => categoriesApi.getAll().then(r => setCats(r.data)).catch(() => {});
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', fields: [] }); setShowModal(true); };
  const openEdit = (c: AssetCategory) => {
    let fields: {key:string;value:string}[] = [];
    try { fields = JSON.parse(c.custom_fields) ?? []; } catch {}
    setEditing(c); setForm({ name: c.name, description: c.description ?? '', fields }); setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name required');
    try {
      const payload = { name: form.name, description: form.description, custom_fields: JSON.stringify(form.fields) };
      if (editing) { await categoriesApi.update(editing.id, payload); toast.success('Category updated'); }
      else { await categoriesApi.create(payload); toast.success('Category created'); }
      setShowModal(false); load();
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const remove = async (c: AssetCategory) => {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try { await categoriesApi.delete(c.id); toast.success('Deleted'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const addField = () => setForm(f => ({ ...f, fields: [...f.fields, {key:'',value:''}] }));
  const removeField = (i: number) => setForm(f => ({ ...f, fields: f.fields.filter((_, idx) => idx !== i) }));
  const updateField = (i: number, k: 'key'|'value', v: string) => setForm(f => ({ ...f, fields: f.fields.map((fld,idx) => idx===i ? {...fld,[k]:v} : fld) }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Asset Categories ({cats.length})</h3>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> Add</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>{['Name','Description','Custom Fields','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cats.map(c => {
              let fields: {key:string}[] = [];
              try { fields = JSON.parse(c.custom_fields) ?? []; } catch {}
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.description ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{fields.map(f => f.key).filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(c)} className="p-1.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'New Category'} size="lg"
        footer={<><button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button><button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button></>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-slate-700">Custom Fields</label>
              <button onClick={addField} className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add Field</button></div>
            {form.fields.map((field, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input placeholder="Field name" value={field.key} onChange={e => updateField(i,'key',e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input placeholder="Default value" value={field.value} onChange={e => updateField(i,'value',e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <button onClick={() => removeField(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── EMPLOYEES ── */
function EmployeesTab() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [search, setSearch] = useState('');

  const load = () => {
    employeesApi.getAll().then(r => setEmployees(r.data)).catch(() => {});
    departmentsApi.getAll().then(r => setDepts(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const setRole = async (emp: User, role: string) => {
    try { await employeesApi.updateRole(emp.id, role); toast.success('Role updated'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const setStatus = async (emp: User) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    try { await employeesApi.updateStatus(emp.id, newStatus); toast.success('Status updated'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const setDept = async (emp: User, dept_id: string) => {
    try { await employeesApi.update(emp.id, { department_id: dept_id || null }); toast.success('Department updated'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'Error'); }
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-900">Employee Directory ({employees.length})</h3>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..." className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>{['Name','Email','Department','Role','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-xs">
                      {emp.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-800">{emp.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{emp.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={emp.department_id ?? ''}
                    onChange={e => setDept(emp, e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">— None —</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={emp.role}
                    onChange={e => setRole(emp, e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                <td className="px-4 py-3">
                  <button onClick={() => setStatus(emp)} className="p-1.5 hover:bg-amber-50 text-slate-500 hover:text-amber-600 rounded">
                    {emp.status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
