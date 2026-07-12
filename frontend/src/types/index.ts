export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'asset_manager' | 'department_head' | 'employee';
  department_id: string | null;
  department_name?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  head_id: string | null;
  head_name?: string;
  head_email?: string;
  parent_id: string | null;
  parent_name?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  custom_fields: string; // JSON string
  created_at: string;
}

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category_id: string | null;
  category_name?: string;
  serial_number: string | null;
  acquisition_date: string | null;
  acquisition_cost: number | null;
  condition: 'Good' | 'Fair' | 'Poor';
  location: string | null;
  status: 'Available' | 'Allocated' | 'Reserved' | 'Under Maintenance' | 'Lost' | 'Retired' | 'Disposed';
  department_id: string | null;
  department_name?: string;
  is_bookable: number;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface Allocation {
  id: string;
  asset_id: string;
  asset_name?: string;
  asset_tag?: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  department_id: string | null;
  department_name?: string;
  allocated_by: string;
  allocated_by_name?: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: 'Active' | 'Returned' | 'Transferred' | 'Overdue';
  condition_checkin_notes: string | null;
  created_at: string;
  returned_at: string | null;
}

export interface TransferRequest {
  id: string;
  asset_id: string;
  asset_name?: string;
  asset_tag?: string;
  requested_by: string;
  requested_by_name?: string;
  from_employee_id: string | null;
  from_employee_name?: string;
  to_employee_id: string | null;
  to_employee_name?: string;
  to_department_id: string | null;
  to_department_name?: string;
  status: 'Requested' | 'Approved' | 'Rejected';
  approved_by: string | null;
  approved_by_name?: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  asset_id: string;
  asset_name?: string;
  asset_tag?: string;
  booked_by: string;
  booked_by_name?: string;
  booked_by_email?: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  cancelled_by: string | null;
  created_at: string;
}

export interface MaintenanceRequest {
  id: string;
  asset_id: string;
  asset_name?: string;
  asset_tag?: string;
  raised_by: string;
  raised_by_name?: string;
  issue_description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Technician Assigned' | 'In Progress' | 'Resolved';
  approved_by: string | null;
  approved_by_name?: string;
  technician_id: string | null;
  technician_name?: string;
  technician_notes: string | null;
  photo_url: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AuditCycle {
  id: string;
  name: string;
  scope_department_id: string | null;
  scope_department_name?: string;
  scope_location: string | null;
  start_date: string;
  end_date: string;
  status: 'Open' | 'In Progress' | 'Closed';
  created_by: string;
  created_by_name?: string;
  created_at: string;
  total_items?: number;
  audited_items?: number;
}

export interface AuditItem {
  id: string;
  audit_cycle_id: string;
  asset_id: string;
  asset_name?: string;
  asset_tag?: string;
  location?: string;
  condition?: string;
  asset_status?: string;
  category_name?: string;
  auditor_id: string | null;
  auditor_name?: string;
  status: 'Pending' | 'Verified' | 'Missing' | 'Damaged';
  notes: string | null;
  audited_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  user_name?: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string;
  created_at: string;
}

export interface KPIData {
  kpis: {
    totalAssets: number;
    available: number;
    allocated: number;
    underMaintenance: number;
    maintenanceToday: number;
    activeBookings: number;
    pendingTransfers: number;
    overdueAllocations: number;
    upcomingReturns: number;
  };
  overdueList: Allocation[];
  recentActivity: ActivityLog[];
}
