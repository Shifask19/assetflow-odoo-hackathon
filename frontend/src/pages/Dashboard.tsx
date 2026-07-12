import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, CheckCircle, Wrench, Calendar, ArrowRightLeft,
  Clock, AlertTriangle, Plus, BookOpen, Activity
} from 'lucide-react';
import { reportsApi } from '../api/client';
import { KPIData } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import StatusBadge from '../components/ui/StatusBadge';

function KPICard({
  label, value, sub, icon, color, bg
}: {
  label: string; value: number | string; sub?: string;
  icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={`${bg} rounded-xl p-3 flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-sm font-medium text-slate-600 leading-tight">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_ASSET: 'registered asset',
  UPDATE_ASSET: 'updated asset',
  ALLOCATE_ASSET: 'allocated asset',
  RETURN_ASSET: 'returned asset',
  CREATE_BOOKING: 'created booking',
  CANCEL_BOOKING: 'cancelled booking',
  RAISE_MAINTENANCE: 'raised maintenance request',
  APPROVE_MAINTENANCE: 'approved maintenance',
  RESOLVE_MAINTENANCE: 'resolved maintenance',
  CREATE_TRANSFER_REQUEST: 'submitted transfer request',
  APPROVE_TRANSFER: 'approved transfer',
  REJECT_TRANSFER: 'rejected transfer',
  LOGIN: 'logged in',
  SIGNUP: 'signed up',
  CREATE_DEPARTMENT: 'created department',
  UPDATE_DEPARTMENT: 'updated department',
  CREATE_CATEGORY: 'created category',
  UPDATE_ROLE: 'updated user role',
  CLOSE_AUDIT_CYCLE: 'closed audit cycle',
  CREATE_AUDIT_CYCLE: 'created audit cycle',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    reportsApi.getKpiDashboard()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Today's Overview</h2>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <KPICard
          label="Available" value={kpis?.available ?? 0}
          sub={`of ${kpis?.totalAssets ?? 0} total`}
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          color="text-green-700" bg="bg-green-50"
        />
        <KPICard
          label="Allocated" value={kpis?.allocated ?? 0}
          icon={<Package className="w-5 h-5 text-blue-600" />}
          color="text-blue-700" bg="bg-blue-50"
        />
        <KPICard
          label="Under Maintenance" value={kpis?.underMaintenance ?? 0}
          icon={<Wrench className="w-5 h-5 text-orange-500" />}
          color="text-orange-700" bg="bg-orange-50"
        />
        <KPICard
          label="Active Bookings" value={kpis?.activeBookings ?? 0}
          icon={<Calendar className="w-5 h-5 text-purple-600" />}
          color="text-purple-700" bg="bg-purple-50"
        />
        <KPICard
          label="Pending Transfers" value={kpis?.pendingTransfers ?? 0}
          icon={<ArrowRightLeft className="w-5 h-5 text-indigo-600" />}
          color="text-indigo-700" bg="bg-indigo-50"
        />
        <KPICard
          label="Upcoming Returns" value={kpis?.upcomingReturns ?? 0}
          sub={kpis?.overdueAllocations ? `${kpis.overdueAllocations} overdue` : undefined}
          icon={<Clock className="w-5 h-5 text-teal-600" />}
          color="text-teal-700" bg="bg-teal-50"
        />
      </div>

      {/* Overdue alert banner */}
      {data?.overdueList && data.overdueList.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-red-800">
              {data.overdueList.length} asset{data.overdueList.length > 1 ? 's' : ''} overdue for return
            </span>
            <span className="text-red-600 text-sm ml-2">— flagged for follow-up</span>
          </div>
          <button
            onClick={() => navigate('/allocations')}
            className="text-xs font-medium text-red-700 hover:text-red-900 underline whitespace-nowrap"
          >
            View all
          </button>
        </div>
      )}

      {/* Overdue list (compact) */}
      {data?.overdueList && data.overdueList.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-slate-800">Overdue Returns</span>
          </div>
          <div className="divide-y divide-slate-100">
            {data.overdueList.slice(0, 5).map(a => (
              <div key={a.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mr-2">{a.asset_tag}</span>
                  <span className="font-medium text-slate-800">{a.asset_name}</span>
                  <span className="text-slate-500 ml-2">— {a.employee_name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <StatusBadge status="Overdue" />
                  <span>Due {a.expected_return_date ? format(new Date(a.expected_return_date), 'MMM d') : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate('/assets')}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Register Asset
        </button>
        <button
          onClick={() => navigate('/bookings')}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <BookOpen className="w-4 h-4" /> Book Resource
        </button>
        <button
          onClick={() => navigate('/maintenance')}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Wrench className="w-4 h-4" /> Raise Request
        </button>
      </div>

      {/* Recent Activity */}
      {data?.recentActivity && data.recentActivity.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentActivity.slice(0, 10).map(log => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0 mt-0.5">
                  {log.user_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{log.user_name ?? 'System'}</span>
                    {' '}
                    <span className="text-slate-500">{ACTION_LABELS[log.action] ?? log.action.toLowerCase().replace(/_/g, ' ')}</span>
                    {' '}
                    <span className="font-medium text-slate-600">{log.entity_type}</span>
                  </p>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
