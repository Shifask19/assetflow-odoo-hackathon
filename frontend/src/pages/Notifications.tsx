import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Package, Wrench, Calendar, ArrowRightLeft, ClipboardList, Info } from 'lucide-react';
import { notificationsApi } from '../api/client';
import { Notification } from '../types';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const typeConfig: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  allocation: {
    icon: <Package className="w-4 h-4 text-blue-600" />,
    bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700'
  },
  success: {
    icon: <CheckCheck className="w-4 h-4 text-green-600" />,
    bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700'
  },
  warning: {
    icon: <Bell className="w-4 h-4 text-amber-600" />,
    bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700'
  },
  maintenance: {
    icon: <Wrench className="w-4 h-4 text-orange-600" />,
    bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700'
  },
  booking: {
    icon: <Calendar className="w-4 h-4 text-purple-600" />,
    bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700'
  },
  transfer_request: {
    icon: <ArrowRightLeft className="w-4 h-4 text-indigo-600" />,
    bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700'
  },
  audit_cycle: {
    icon: <ClipboardList className="w-4 h-4 text-teal-600" />,
    bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700'
  },
  info: {
    icon: <Info className="w-4 h-4 text-slate-600" />,
    bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600'
  },
};

function getConfig(type: string) {
  return typeConfig[type] ?? typeConfig['info'];
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = () => {
    notificationsApi.getAll()
      .then(r => setNotifications(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      );
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      toast.success('All notifications marked as read');
    } catch { toast.error('Error'); }
  };

  const visible = filter === 'unread'
    ? notifications.filter(n => n.is_read === 0)
    : notifications;

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 bg-white border border-slate-200 rounded-xl p-1.5">
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-7 w-7 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center h-64 text-slate-400">
          <Bell className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-sm mt-1">You're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(n => {
            const cfg = getConfig(n.reference_type ?? n.type);
            const isUnread = n.is_read === 0;
            return (
              <div
                key={n.id}
                onClick={() => { if (isUnread) markRead(n.id); }}
                className={`flex gap-4 px-5 py-4 rounded-xl border transition-all cursor-pointer
                  ${isUnread
                    ? `${cfg.bg} ${cfg.border} shadow-sm hover:shadow`
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
              >
                {/* Icon */}
                <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isUnread ? 'bg-white shadow-sm' : 'bg-slate-100'
                }`}>
                  {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-sm font-semibold leading-snug ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
                      )}
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm mt-0.5 ${isUnread ? 'text-slate-700' : 'text-slate-500'}`}>
                    {n.message}
                  </p>
                  {n.reference_type && (
                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                      {n.reference_type.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
