/**
 * db.ts — sql.js wrapper that mimics the better-sqlite3 synchronous API.
 * Routes use: db.prepare(sql).get(...params), .run(...params), .all(...params)
 * This wrapper translates those calls to sql.js Database.
 */
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '../../assetflow.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// ──────────────────────────────────────────────────────────
// Compatibility shim: wraps sql.js to look like better-sqlite3
// ──────────────────────────────────────────────────────────
class Statement {
  private db: SqlJsDatabase;
  private sql: string;

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  /** Returns the first row as an object, or undefined */
  get(...params: any[]): any {
    const flat = params.flat();
    const results = this.db.exec(this.sql, flat);
    if (!results.length || !results[0].values.length) return undefined;
    const { columns, values } = results[0];
    return this._toObj(columns, values[0]);
  }

  /** Returns all rows as an array of objects */
  all(...params: any[]): any[] {
    const flat = params.flat();
    const results = this.db.exec(this.sql, flat);
    if (!results.length) return [];
    const { columns, values } = results[0];
    return values.map(row => this._toObj(columns, row));
  }

  /** Executes a write statement (INSERT / UPDATE / DELETE) */
  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const flat = params.flat();
    this.db.run(this.sql, flat);
    const changes = (this.db as any).getRowsModified?.() ?? 0;
    return { changes, lastInsertRowid: 0 };
  }

  private _toObj(columns: string[], row: any[]): Record<string, any> {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  }
}

class CompatDb {
  private _db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this._db = db;
  }

  prepare(sql: string): Statement {
    return new Statement(this._db, sql);
  }

  exec(sql: string): void {
    this._db.exec(sql);
  }

  pragma(stmt: string): void {
    try { this._db.run(`PRAGMA ${stmt}`); } catch (_) {}
  }

  /** Persist in-memory DB to disk */
  save(): void {
    const data = this._db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// ──────────────────────────────────────────────────────────
// Singleton + auto-save
// ──────────────────────────────────────────────────────────
let db: CompatDb | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  let sqlJsDb: SqlJsDatabase;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new SQL.Database();
  }

  db = new CompatDb(sqlJsDb);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeSchema();
  seedData();

  // Persist to disk every 2 seconds if writes happen
  saveTimer = setInterval(() => { db?.save(); }, 2000);

  // Also save on process exit
  process.on('exit', () => { db?.save(); });
  process.on('SIGINT', () => { db?.save(); process.exit(0); });
  process.on('SIGTERM', () => { db?.save(); process.exit(0); });
}

export function getDb(): CompatDb {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

// ──────────────────────────────────────────────────────────
// Schema + seed
// ──────────────────────────────────────────────────────────
function initializeSchema(): void {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db!.exec(schema);
  db!.save();
}

function seedData(): void {
  const existing = db!.prepare('SELECT id FROM users WHERE email = ?').get('admin@assetflow.com');
  if (existing) return;

  const hash = bcrypt.hashSync('Admin@123', 10);

  const deptIT  = uuidv4();
  const deptOps = uuidv4();
  const deptFac = uuidv4();

  db!.prepare(`INSERT INTO departments (id, name, status) VALUES (?, ?, ?)`).run(deptIT,  'IT',         'active');
  db!.prepare(`INSERT INTO departments (id, name, status) VALUES (?, ?, ?)`).run(deptOps, 'Operations', 'active');
  db!.prepare(`INSERT INTO departments (id, name, status) VALUES (?, ?, ?)`).run(deptFac, 'Facilities', 'active');

  const adminId = 'admin-seed-001';
  db!.prepare(`INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
    adminId, 'System Admin', 'admin@assetflow.com', hash, 'admin', 'active'
  );

  const amId = uuidv4();
  db!.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    amId, 'Alex Manager', 'manager@assetflow.com', hash, 'asset_manager', deptIT, 'active'
  );

  const dhId = uuidv4();
  db!.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    dhId, 'Diana Head', 'dhead@assetflow.com', hash, 'department_head', deptOps, 'active'
  );

  const emp1Id = uuidv4(); const emp2Id = uuidv4(); const emp3Id = uuidv4();
  db!.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(emp1Id, 'Bob Employee', 'bob@assetflow.com',   hash, 'employee', deptIT,  'active');
  db!.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(emp2Id, 'Carol Smith',   'carol@assetflow.com', hash, 'employee', deptOps, 'active');
  db!.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(emp3Id, 'Dave Johnson',  'dave@assetflow.com',  hash, 'employee', deptFac, 'active');

  db!.prepare(`UPDATE departments SET head_id = ? WHERE id = ?`).run(dhId, deptOps);
  db!.prepare(`UPDATE departments SET head_id = ? WHERE id = ?`).run(amId, deptIT);

  const catElec = uuidv4(); const catFurn = uuidv4(); const catVeh = uuidv4();
  db!.prepare(`INSERT INTO asset_categories (id, name, description, custom_fields) VALUES (?, ?, ?, ?)`).run(catElec, 'Electronics', 'Electronic devices and equipment', JSON.stringify([{key:'Warranty',value:''},{key:'Manufacturer',value:''}]));
  db!.prepare(`INSERT INTO asset_categories (id, name, description, custom_fields) VALUES (?, ?, ?, ?)`).run(catFurn, 'Furniture',   'Office furniture and fixtures',     JSON.stringify([{key:'Material',value:''}]));
  db!.prepare(`INSERT INTO asset_categories (id, name, description, custom_fields) VALUES (?, ?, ?, ?)`).run(catVeh,  'Vehicles',    'Company vehicles and transport',    JSON.stringify([{key:'License Plate',value:''},{key:'Year',value:''}]));

  const ins = db!.prepare(`INSERT INTO assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, status, department_id, is_bookable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const a1  = uuidv4(); ins.run(a1,  'AF-0001', 'Dell Laptop Pro',          catElec, 'SN-DELL-001',  '2023-01-15', 1200,  'Good', 'IT Room 101',       'Allocated',        deptIT,  0);
  const a2  = uuidv4(); ins.run(a2,  'AF-0002', 'HP Monitor 27"',           catElec, 'SN-HP-002',    '2023-02-10', 350,   'Good', 'IT Room 101',       'Available',        deptIT,  0);
  const a3  = uuidv4(); ins.run(a3,  'AF-0003', 'Conference Room Projector',catElec, 'SN-PROJ-003',  '2022-11-20', 800,   'Fair', 'Conference Room A', 'Available',        deptOps, 1);
  const a4  = uuidv4(); ins.run(a4,  'AF-0004', 'Office Chair Executive',   catFurn, 'SN-CHAIR-004', '2023-03-05', 450,   'Good', 'Office Floor 2',    'Allocated',        deptOps, 0);
  const a5  = uuidv4(); ins.run(a5,  'AF-0005', 'Toyota Camry 2022',        catVeh,  'SN-VEH-005',   '2022-06-01', 25000, 'Good', 'Parking Bay A',     'Available',        deptFac, 1);
  const a6  = uuidv4(); ins.run(a6,  'AF-0006', 'MacBook Air M2',           catElec, 'SN-MAC-006',   '2023-08-12', 1500,  'Good', 'IT Room 102',       'Available',        deptIT,  0);
  const a7  = uuidv4(); ins.run(a7,  'AF-0007', 'Standing Desk',            catFurn, 'SN-DESK-007',  '2023-04-20', 600,   'Good', 'Office Floor 1',    'Under Maintenance',deptFac, 0);
  const a8  = uuidv4(); ins.run(a8,  'AF-0008', 'iPad Pro 12.9"',           catElec, 'SN-IPAD-008',  '2023-07-30', 900,   'Good', 'Reception',         'Allocated',        deptOps, 0);
  const a9  = uuidv4(); ins.run(a9,  'AF-0009', 'Cisco IP Phone',           catElec, 'SN-PHONE-009', '2022-12-01', 200,   'Fair', 'IT Room 101',       'Available',        deptIT,  0);
  const a10 = uuidv4(); ins.run(a10, 'AF-0010', 'Epson Printer A3',         catElec, 'SN-PRINT-010', '2023-01-28', 500,   'Good', 'Print Room',        'Available',        deptOps, 1);

  const alloc1Id = uuidv4(); const alloc2Id = uuidv4(); const alloc3Id = uuidv4();
  db!.prepare(`INSERT INTO allocations (id, asset_id, employee_id, department_id, allocated_by, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(alloc1Id, a1, emp1Id, deptIT,  adminId, new Date(Date.now() + 30*24*60*60*1000).toISOString(), 'Active');
  db!.prepare(`INSERT INTO allocations (id, asset_id, employee_id, department_id, allocated_by, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(alloc2Id, a4, emp2Id, deptOps, adminId, new Date(Date.now() + 60*24*60*60*1000).toISOString(), 'Active');
  db!.prepare(`INSERT INTO allocations (id, asset_id, employee_id, department_id, allocated_by, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(alloc3Id, a8, emp3Id, deptOps, adminId, new Date(Date.now() -  7*24*60*60*1000).toISOString(), 'Overdue');

  const tomorrow  = new Date(Date.now() + 24*60*60*1000);
  const dayAfter  = new Date(Date.now() + 48*60*60*1000);
  db!.prepare(`INSERT INTO bookings (id, asset_id, booked_by, start_time, end_time, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), a3, emp1Id, tomorrow.toISOString(), new Date(tomorrow.getTime() + 2*60*60*1000).toISOString(), 'Team Presentation', 'Upcoming');
  db!.prepare(`INSERT INTO bookings (id, asset_id, booked_by, start_time, end_time, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), a5, emp2Id, dayAfter.toISOString(), new Date(dayAfter.getTime() + 4*60*60*1000).toISOString(), 'Client Visit', 'Upcoming');

  db!.prepare(`INSERT INTO maintenance_requests (id, asset_id, raised_by, issue_description, priority, status) VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), a7, emp3Id, 'Desk motor not working, unable to adjust height', 'High',   'Approved');
  db!.prepare(`INSERT INTO maintenance_requests (id, asset_id, raised_by, issue_description, priority, status) VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), a9, emp1Id, 'Phone display flickering and calls dropping',     'Medium', 'Pending');

  db!.save();
  console.log('✅ Seeded: admin@assetflow.com / Admin@123');
  console.log('✅ Sample data seeded successfully');
}

export default getDb;
