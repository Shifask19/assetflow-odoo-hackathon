import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../../api/client';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/assets': 'Asset Directory',
  '/allocations': 'Asset Allocations',
  '/bookings': 'Resource Bookings',
  '/maintenance': 'Maintenance',
  '/audits': 'Audit Cycles',
  '/reports': 'Reports & Analytics',
  '/notifications': 'Notifications',
  '/org-setup': 'Organisation Setup',
};

export default function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? 'AssetFlow';
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    notificationsApi.getUnreadCount()
      .then(res => setUnread(res.data.count ?? 0))
      .catch(() => {});

    const interval = setInterval(() => {
      notificationsApi.getUnreadCount()
        .then(res => setUnread(res.data.count ?? 0))
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [location.pathname]);

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
      <h1 className="text-lg font-semibold text-slate-900 ml-10 lg:ml-0">{title}</h1>
      <Link to="/notifications" className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </header>
  );
}
