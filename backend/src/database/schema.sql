-- AssetFlow Database Schema

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  head_id TEXT,
  parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin', 'asset_manager', 'department_head', 'employee')),
  department_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS asset_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  custom_fields TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  asset_tag TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT,
  serial_number TEXT,
  acquisition_date TEXT,
  acquisition_cost REAL,
  condition TEXT NOT NULL DEFAULT 'Good' CHECK(condition IN ('Good', 'Fair', 'Poor')),
  location TEXT,
  status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available', 'Allocated', 'Reserved', 'Under Maintenance', 'Lost', 'Retired', 'Disposed')),
  department_id TEXT,
  is_bookable INTEGER NOT NULL DEFAULT 0,
  photo_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES asset_categories(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  department_id TEXT,
  allocated_by TEXT NOT NULL,
  expected_return_date TEXT,
  actual_return_date TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Returned', 'Transferred', 'Overdue')),
  condition_checkin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  returned_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  FOREIGN KEY (employee_id) REFERENCES users(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (allocated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transfer_requests (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  from_employee_id TEXT,
  to_employee_id TEXT,
  to_department_id TEXT,
  status TEXT NOT NULL DEFAULT 'Requested' CHECK(status IN ('Requested', 'Approved', 'Rejected')),
  approved_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (from_employee_id) REFERENCES users(id),
  FOREIGN KEY (to_employee_id) REFERENCES users(id),
  FOREIGN KEY (to_department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  booked_by TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK(status IN ('Upcoming', 'Ongoing', 'Completed', 'Cancelled')),
  cancelled_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  FOREIGN KEY (booked_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  raised_by TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Technician Assigned', 'In Progress', 'Resolved')),
  approved_by TEXT,
  technician_id TEXT,
  technician_notes TEXT,
  photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  FOREIGN KEY (raised_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (technician_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_cycles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope_department_id TEXT,
  scope_location TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Closed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (scope_department_id) REFERENCES departments(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_cycle_auditors (
  audit_cycle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (audit_cycle_id, user_id),
  FOREIGN KEY (audit_cycle_id) REFERENCES audit_cycles(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_items (
  id TEXT PRIMARY KEY,
  audit_cycle_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  auditor_id TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Verified', 'Missing', 'Damaged')),
  notes TEXT,
  audited_at TEXT,
  FOREIGN KEY (audit_cycle_id) REFERENCES audit_cycles(id),
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  FOREIGN KEY (auditor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  reference_id TEXT,
  reference_type TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
