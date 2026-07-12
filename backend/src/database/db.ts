import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '../../assetflow.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
    seedData();
  }
  return db;
}

function initializeSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
}

function seedData() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@assetflow.com');
  if (existing) return;

  const hash = bcrypt.hashSync('Admin@123', 10);

  // Departments
  const deptIT = uuidv4();
  const deptOps = uuidv4();
  const deptFac = uuidv4();

  db.prepare(`INSERT INTO departments (id, name, status) VALUES (?, ?, ?)`).run(deptIT, 'IT', 'active');
  db.prepare(`INSERT INTO departments (id, name, status) VALUES (?, ?, ?)`).run(deptOps, 'Operations', 'active');
  db.prepare(`INSERT INTO departments (id, name, status) VALUES (?, ?, ?)`).run(deptFac, 'Facilities', 'active');

  // Admin user
  const adminId = 'admin-seed-001';
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
    adminId, 'System Admin', 'admin@assetflow.com', hash, 'admin', 'active'
  );

  // Asset Manager
  const amId = uuidv4();
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    amId, 'Alex Manager', 'manager@assetflow.com', hash, 'asset_manager', deptIT, 'active'
  );

  // Dept Head
  const dhId = uuidv4();
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    dhId, 'Diana Head', 'dhead@assetflow.com', hash, 'department_head', deptOps, 'active'
  );

  // Employees
  const emp1Id = uuidv4();
  const emp2Id = uuidv4();
  const emp3Id = uuidv4();

  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    emp1Id, 'Bob Employee', 'bob@assetflow.com', hash, 'employee', deptIT, 'active'
  );
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    emp2Id, 'Carol Smith', 'carol@assetflow.com', hash, 'employee', deptOps, 'active'
  );
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    emp3Id, 'Dave Johnson', 'dave@assetflow.com', hash, 'employee', deptFac, 'active'
  );

  // Update dept heads
  db.prepare(`UPDATE departments SET head_id = ? WHERE id = ?`).run(dhId, deptOps);
  db.prepare(`UPDATE departments SET head_id = ? WHERE id = ?`).run(amId, deptIT);

  // Asset Categories
  const catElec = uuidv4();
  const catFurn = uuidv4();
  const catVeh = uuidv4();

  db.prepare(`INSERT INTO asset_categories (id, name, description, custom_fields) VALUES (?, ?, ?, ?)`).run(
    catElec, 'Electronics', 'Electronic devices and equipment', JSON.stringify([{key: 'Warranty', value: ''}, {key: 'Manufacturer', value: ''}])
  );
  db.prepare(`INSERT INTO asset_categories (id, name, description, custom_fields) VALUES (?, ?, ?, ?)`).run(
    catFurn, 'Furniture', 'Office furniture and fixtures', JSON.stringify([{key: 'Material', value: ''}])
  );
  db.prepare(`INSERT INTO asset_categories (id, name, description, custom_fields) VALUES (?, ?, ?, ?)`).run(
    catVeh, 'Vehicles', 'Company vehicles and transport', JSON.stringify([{key: 'License Plate', value: ''}, {key: 'Year', value: ''}])
  );

  // Assets
  const insertAsset = db.prepare(`INSERT INTO assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, status, department_id, is_bookable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const a1 = uuidv4(); insertAsset.run(a1, 'AF-0001', 'Dell Laptop Pro', catElec, 'SN-DELL-001', '2023-01-15', 1200, 'Good', 'IT Room 101', 'Allocated', deptIT, 0);
  const a2 = uuidv4(); insertAsset.run(a2, 'AF-0002', 'HP Monitor 27"', catElec, 'SN-HP-002', '2023-02-10', 350, 'Good', 'IT Room 101', 'Available', deptIT, 0);
  const a3 = uuidv4(); insertAsset.run(a3, 'AF-0003', 'Conference Room Projector', catElec, 'SN-PROJ-003', '2022-11-20', 800, 'Fair', 'Conference Room A', 'Available', deptOps, 1);
  const a4 = uuidv4(); insertAsset.run(a4, 'AF-0004', 'Office Chair Executive', catFurn, 'SN-CHAIR-004', '2023-03-05', 450, 'Good', 'Office Floor 2', 'Allocated', deptOps, 0);
  const a5 = uuidv4(); insertAsset.run(a5, 'AF-0005', 'Toyota Camry 2022', catVeh, 'SN-VEH-005', '2022-06-01', 25000, 'Good', 'Parking Bay A', 'Available', deptFac, 1);
  const a6 = uuidv4(); insertAsset.run(a6, 'AF-0006', 'MacBook Air M2', catElec, 'SN-MAC-006', '2023-08-12', 1500, 'Good', 'IT Room 102', 'Available', deptIT, 0);
  const a7 = uuidv4(); insertAsset.run(a7, 'AF-0007', 'Standing Desk', catFurn, 'SN-DESK-007', '2023-04-20', 600, 'Good', 'Office Floor 1', 'Under Maintenance', deptFac, 0);
  const a8 = uuidv4(); insertAsset.run(a8, 'AF-0008', 'iPad Pro 12.9"', catElec, 'SN-IPAD-008', '2023-07-30', 900, 'Good', 'Reception', 'Allocated', deptOps, 0);
  const a9 = uuidv4(); insertAsset.run(a9, 'AF-0009', 'Cisco IP Phone', catElec, 'SN-PHONE-009', '2022-12-01', 200, 'Fair', 'IT Room 101', 'Available', deptIT, 0);
  const a10 = uuidv4(); insertAsset.run(a10, 'AF-0010', 'Epson Printer A3', catElec, 'SN-PRINT-010', '2023-01-28', 500, 'Good', 'Print Room', 'Available', deptOps, 1);

  // Allocations
  const alloc1Id = uuidv4();
  const alloc2Id = uuidv4();
  const alloc3Id = uuidv4();

  // Active allocation
  db.prepare(`INSERT INTO allocations (id, asset_id, employee_id, department_id, allocated_by, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    alloc1Id, a1, emp1Id, deptIT, adminId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), 'Active'
  );
  // Active allocation
  db.prepare(`INSERT INTO allocations (id, asset_id, employee_id, department_id, allocated_by, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    alloc2Id, a4, emp2Id, deptOps, adminId, new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), 'Active'
  );
  // Overdue allocation (past due date)
  db.prepare(`INSERT INTO allocations (id, asset_id, employee_id, department_id, allocated_by, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    alloc3Id, a8, emp3Id, deptOps, adminId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), 'Overdue'
  );

  // Bookings
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  db.prepare(`INSERT INTO bookings (id, asset_id, booked_by, start_time, end_time, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), a3, emp1Id, tomorrow.toISOString(), new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(), 'Team Presentation', 'Upcoming'
  );
  db.prepare(`INSERT INTO bookings (id, asset_id, booked_by, start_time, end_time, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), a5, emp2Id, dayAfter.toISOString(), new Date(dayAfter.getTime() + 4 * 60 * 60 * 1000).toISOString(), 'Client Visit', 'Upcoming'
  );

  // Maintenance Requests
  db.prepare(`INSERT INTO maintenance_requests (id, asset_id, raised_by, issue_description, priority, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), a7, emp3Id, 'Desk motor not working, unable to adjust height', 'High', 'Approved'
  );
  db.prepare(`INSERT INTO maintenance_requests (id, asset_id, raised_by, issue_description, priority, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), a9, emp1Id, 'Phone display flickering and calls dropping', 'Medium', 'Pending'
  );

  console.log('Seeded admin: admin@assetflow.com / Admin@123');
  console.log('Seeded all sample data successfully');
}

export default getDb;
