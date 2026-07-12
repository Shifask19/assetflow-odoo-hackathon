import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { reportsApi } from '../api/client';
import { AlertTriangle, TrendingUp, Wrench, Building2, Calendar, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { format } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'utilization' | 'maintenance' | 'departments' | 'bookings' | 'due'>('utilization');
  const [utilData, setUtilData] = useState<any[]>([]);
  const [maintData, setMaintData] = useState<any[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [dueData, setDueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      reportsApi.getUtilization(),
      reportsApi.getMaintenanceFrequency(),
      reportsApi.getDepartmentAllocation(),
      reportsApi.getBookingHeatmap(),
      reportsApi.getDueMaintenance(),
    ]).then(([u, m, d, h, due]) => {
      setUtilData(u.data);
      setMaintData(m.data);
      setDeptData(d.data);
      setHeatmapData(h.data);
      setDueData(due.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  // Build heatmap grid: day x hour → count
  const heatGrid: Record<string, Record<number, number>> = {};
  DAY_NAMES.forEach(d => { heatGrid[d] = {}; });
  heatmapData.forEach((row: any) => {
    const day = DAY_NAMES[parseInt(row.day_of_week, 10)];
    heatGrid[day][row.hour] = (heatGrid[day][row.hour] ?? 0) + row.count;
  });
  const maxHeat = Math.max(...heatmapData.map((r: any) => r.count), 1);

  const tabs = [
    { id: 'utilization', label: 'Asset Utilization', icon: TrendingUp },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'bookings', label: 'Booking Heatmap', icon: Calendar },
    { id: 'due', label: 'Due Maintenance', icon: AlertTriangle },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap bg-white border border-slate-200 rounded-xl p-1.5 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        <button onClick={loadAll} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* UTILIZATION */}
          {activeTab === 'utilization' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Stacked bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">Asset Status by Category</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={utilData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="allocated" name="Allocated" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="available" name="Available" stackId="a" fill="#10b981" />
                      <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie chart */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">Total Assets by Category</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={utilData}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {utilData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-700">Category Breakdown</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Category', 'Total', 'Allocated', 'Available', 'Maintenance', 'Utilization %'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {utilData.map((row: any) => {
                        const util = row.total > 0 ? Math.round((row.allocated / row.total) * 100) : 0;
                        return (
                          <tr key={row.category} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{row.category ?? 'Uncategorized'}</td>
                            <td className="px-4 py-3 text-slate-600">{row.total}</td>
                            <td className="px-4 py-3"><span className="text-blue-700 font-medium">{row.allocated}</span></td>
                            <td className="px-4 py-3"><span className="text-green-700 font-medium">{row.available}</span></td>
                            <td className="px-4 py-3"><span className="text-amber-700 font-medium">{row.maintenance}</span></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${util}%` }} />
                                </div>
                                <span className="text-xs text-slate-600">{util}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MAINTENANCE FREQUENCY */}
          {activeTab === 'maintenance' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Top Assets by Maintenance Count</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={maintData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="asset_name" type="category" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="critical" name="Critical" stackId="a" fill="#ef4444" />
                    <Bar dataKey="high" name="High" stackId="a" fill="#f97316" />
                    <Bar dataKey="resolved" name="Resolved" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-700">Maintenance Frequency Detail</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Asset', 'Tag', 'Total', 'Critical', 'High', 'Resolved'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {maintData.map((row: any) => (
                        <tr key={row.asset_tag} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{row.asset_name}</td>
                          <td className="px-4 py-3"><span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{row.asset_tag}</span></td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{row.maintenance_count}</td>
                          <td className="px-4 py-3"><span className="text-red-700 font-medium">{row.critical}</span></td>
                          <td className="px-4 py-3"><span className="text-orange-700 font-medium">{row.high}</span></td>
                          <td className="px-4 py-3"><span className="text-green-700 font-medium">{row.resolved}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {maintData.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                      <p className="text-sm">No maintenance data yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DEPARTMENT ALLOCATION */}
          {activeTab === 'departments' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Assets per Department</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={deptData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="allocated" name="Allocated" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="available" name="Available" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-700">Department Summary</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Department', 'Total Assets', 'Allocated', 'Available', 'Portfolio Value'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deptData.map((row: any) => (
                        <tr key={row.department} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{row.department}</td>
                          <td className="px-4 py-3 text-slate-700">{row.total_assets}</td>
                          <td className="px-4 py-3"><span className="text-blue-700 font-medium">{row.allocated}</span></td>
                          <td className="px-4 py-3"><span className="text-green-700 font-medium">{row.available}</span></td>
                          <td className="px-4 py-3 text-slate-700">
                            {row.total_value > 0 ? `$${Number(row.total_value).toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BOOKING HEATMAP */}
          {activeTab === 'bookings' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-1">Booking Heatmap (Last 30 Days)</h3>
              <p className="text-xs text-slate-500 mb-5">Darker cells indicate more bookings at that day/hour combination</p>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse min-w-full">
                  <thead>
                    <tr>
                      <th className="w-12 text-slate-400 text-right pr-3 font-normal pb-2">Hour →</th>
                      {HOURS.map(h => (
                        <th key={h} className="w-8 text-center text-slate-400 font-normal pb-2 rotate-45 origin-bottom-left whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_NAMES.map(day => (
                      <tr key={day}>
                        <td className="text-right pr-3 font-medium text-slate-600 py-0.5 w-12">{day}</td>
                        {Array.from({ length: 24 }, (_, hour) => {
                          const count = heatGrid[day][hour] ?? 0;
                          const intensity = count > 0 ? Math.round((count / maxHeat) * 9) + 1 : 0;
                          const bg = count === 0 ? 'bg-slate-100' :
                            intensity <= 2 ? 'bg-blue-100' :
                            intensity <= 4 ? 'bg-blue-200' :
                            intensity <= 6 ? 'bg-blue-400' :
                            intensity <= 8 ? 'bg-blue-600' : 'bg-blue-800';
                          return (
                            <td key={hour} title={`${day} ${hour}:00 – ${count} booking(s)`}
                              className={`w-8 h-7 ${bg} border border-white rounded-sm cursor-default`}
                            />
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                  <span>Low</span>
                  {['bg-slate-100', 'bg-blue-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600', 'bg-blue-800'].map((c, i) => (
                    <div key={i} className={`w-5 h-5 rounded ${c} border border-white`} />
                  ))}
                  <span>High</span>
                </div>
              </div>
            </div>
          )}

          {/* DUE MAINTENANCE */}
          {activeTab === 'due' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800">
                Assets that have never been serviced or haven't had maintenance in over 90 days.
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-700">
                    {dueData.length} asset(s) due for maintenance
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Tag', 'Asset', 'Category', 'Location', 'Status', 'Condition', 'Last Serviced'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dueData.map((row: any) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{row.asset_tag}</span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                          <td className="px-4 py-3 text-slate-600">{row.category_name ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{row.location ?? '—'}</td>
                          <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                          <td className="px-4 py-3"><StatusBadge status={row.condition} /></td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {row.last_maintenance
                              ? format(new Date(row.last_maintenance), 'MMM d, yyyy')
                              : <span className="text-red-600 font-medium">Never</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dueData.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                      <p className="text-sm">All assets are up to date</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
