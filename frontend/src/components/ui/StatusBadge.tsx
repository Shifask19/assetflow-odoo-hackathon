import React from 'react';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; dot?: string }> = {
  // Asset statuses
  Available: { bg: 'bg-green-100', text: 'text-green-800' },
  Allocated: { bg: 'bg-blue-100', text: 'text-blue-800' },
  Reserved: { bg: 'bg-purple-100', text: 'text-purple-800' },
  'Under Maintenance': { bg: 'bg-orange-100', text: 'text-orange-800' },
  Lost: { bg: 'bg-red-100', text: 'text-red-800' },
  Retired: { bg: 'bg-gray-100', text: 'text-gray-800' },
  Disposed: { bg: 'bg-gray-100', text: 'text-gray-600' },
  // Allocation statuses
  Active: { bg: 'bg-green-100', text: 'text-green-800' },
  Returned: { bg: 'bg-gray-100', text: 'text-gray-700' },
  Transferred: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Overdue: { bg: 'bg-red-100', text: 'text-red-800', dot: 'animate-pulse' },
  // Transfer
  Requested: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  Approved: { bg: 'bg-green-100', text: 'text-green-800' },
  Rejected: { bg: 'bg-red-100', text: 'text-red-800' },
  // Booking
  Upcoming: { bg: 'bg-blue-100', text: 'text-blue-800' },
  Ongoing: { bg: 'bg-green-100', text: 'text-green-800' },
  Completed: { bg: 'bg-gray-100', text: 'text-gray-700' },
  Cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
  // Maintenance
  Pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  'Technician Assigned': { bg: 'bg-blue-100', text: 'text-blue-800' },
  'In Progress': { bg: 'bg-orange-100', text: 'text-orange-800' },
  Resolved: { bg: 'bg-green-100', text: 'text-green-800' },
  // Audit
  Open: { bg: 'bg-blue-100', text: 'text-blue-800' },
  'In Progress': { bg: 'bg-orange-100', text: 'text-orange-800' },
  Closed: { bg: 'bg-gray-100', text: 'text-gray-800' },
  // Conditions
  Good: { bg: 'bg-green-100', text: 'text-green-800' },
  Fair: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  Poor: { bg: 'bg-red-100', text: 'text-red-800' },
  // Priority
  Low: { bg: 'bg-green-100', text: 'text-green-800' },
  Medium: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  High: { bg: 'bg-orange-100', text: 'text-orange-800' },
  Critical: { bg: 'bg-red-100', text: 'text-red-900' },
  // Audit item
  Verified: { bg: 'bg-green-100', text: 'text-green-800' },
  Missing: { bg: 'bg-red-100', text: 'text-red-800' },
  Damaged: { bg: 'bg-orange-100', text: 'text-orange-800' },
  // User status
  active: { bg: 'bg-green-100', text: 'text-green-800' },
  inactive: { bg: 'bg-red-100', text: 'text-red-800' },
};

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-full ${config.bg} ${config.text} ${sizeClass}`}>
      {config.dot && <span className={`w-1.5 h-1.5 rounded-full bg-current ${config.dot}`} />}
      {status}
    </span>
  );
}
