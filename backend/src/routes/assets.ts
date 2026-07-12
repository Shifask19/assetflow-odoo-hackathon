import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

function generateAssetTag(db: any): string {
  const result = db.prepare(`SELECT asset_tag FROM assets ORDER BY asset_tag DESC LIMIT 1`).get() as any;
  if (!result) return 'AF-0001';
  const match = result.asset_tag.match(/AF-(\d+)/);
  if (!match) return 'AF-0001';
  const num = parseInt(match[1], 10) + 1;
  return `AF-${num.toString().padStart(4, '0')}`;
}

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const { category, status, department, location, search } = req.query;

  let query = `
    SELECT a.*, c.name as category_name, d.name as department_name
    FROM assets a
    LEFT JOIN asset_categories c ON a.category_id = c.id
    LEFT JOIN departments d ON a.department_id = d.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (category) { query += ' AND a.category_id = ?'; params.push(category); }
  if (status) { query += ' AND a.status = ?'; params.push(status); }
  if (department) { query += ' AND a.department_id = ?'; params.push(department); }
  if (location) { query += ' AND a.location LIKE ?'; params.push(`%${location}%`); }
  if (search) { query += ' AND (a.name LIKE ? OR a.asset_tag LIKE ? OR a.serial_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  query += ' ORDER BY a.created_at DESC';
  const assets = db.prepare(query).all(...params);
  res.json(assets);
});

router.post('/', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, status, department_id, is_bookable, photo_url, notes } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Asset name is required' });
    return;
  }
  const db = getDb();
  const id = uuidv4();
  const asset_tag = generateAssetTag(db);

  db.prepare(`INSERT INTO assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, status, department_id, is_bookable, photo_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, asset_tag, name, category_id || null, serial_number || null, acquisition_date || null,
    acquisition_cost || null, condition || 'Good', location || null, status || 'Available',
    department_id || null, is_bookable ? 1 : 0, photo_url || null, notes || null
  );

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'CREATE_ASSET', 'asset', id, JSON.stringify({ asset_tag, name })
  );

  const asset = db.prepare(`
    SELECT a.*, c.name as category_name, d.name as department_name
    FROM assets a
    LEFT JOIN asset_categories c ON a.category_id = c.id
    LEFT JOIN departments d ON a.department_id = d.id
    WHERE a.id = ?
  `).get(id);
  res.status(201).json(asset);
});

router.get('/:id', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const asset = db.prepare(`
    SELECT a.*, c.name as category_name, d.name as department_name
    FROM assets a
    LEFT JOIN asset_categories c ON a.category_id = c.id
    LEFT JOIN departments d ON a.department_id = d.id
    WHERE a.id = ?
  `).get(req.params.id) as any;

  if (!asset) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  const allocations = db.prepare(`
    SELECT al.*, u.name as employee_name, u.email as employee_email,
           d.name as department_name, ab.name as allocated_by_name
    FROM allocations al
    LEFT JOIN users u ON al.employee_id = u.id
    LEFT JOIN departments d ON al.department_id = d.id
    LEFT JOIN users ab ON al.allocated_by = ab.id
    WHERE al.asset_id = ?
    ORDER BY al.created_at DESC LIMIT 10
  `).all(req.params.id);

  const maintenance = db.prepare(`
    SELECT mr.*, u.name as raised_by_name, t.name as technician_name
    FROM maintenance_requests mr
    LEFT JOIN users u ON mr.raised_by = u.id
    LEFT JOIN users t ON mr.technician_id = t.id
    WHERE mr.asset_id = ?
    ORDER BY mr.created_at DESC LIMIT 10
  `).all(req.params.id);

  res.json({ ...asset, allocations, maintenance });
});

router.put('/:id', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id) as any;
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  const { name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, status, department_id, is_bookable, photo_url, notes } = req.body;

  db.prepare(`UPDATE assets SET name=?, category_id=?, serial_number=?, acquisition_date=?, acquisition_cost=?, condition=?, location=?, status=?, department_id=?, is_bookable=?, photo_url=?, notes=? WHERE id=?`).run(
    name || asset.name,
    category_id !== undefined ? (category_id || null) : asset.category_id,
    serial_number !== undefined ? serial_number : asset.serial_number,
    acquisition_date !== undefined ? acquisition_date : asset.acquisition_date,
    acquisition_cost !== undefined ? acquisition_cost : asset.acquisition_cost,
    condition || asset.condition,
    location !== undefined ? location : asset.location,
    status || asset.status,
    department_id !== undefined ? (department_id || null) : asset.department_id,
    is_bookable !== undefined ? (is_bookable ? 1 : 0) : asset.is_bookable,
    photo_url !== undefined ? photo_url : asset.photo_url,
    notes !== undefined ? notes : asset.notes,
    req.params.id
  );

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'UPDATE_ASSET', 'asset', req.params.id, JSON.stringify(req.body)
  );

  const updated = db.prepare(`
    SELECT a.*, c.name as category_name, d.name as department_name
    FROM assets a LEFT JOIN asset_categories c ON a.category_id = c.id
    LEFT JOIN departments d ON a.department_id = d.id WHERE a.id = ?
  `).get(req.params.id);
  res.json(updated);
});

router.get('/:id/history', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const allocations = db.prepare(`
    SELECT al.*, u.name as employee_name, u.email as employee_email,
           d.name as department_name, ab.name as allocated_by_name
    FROM allocations al
    LEFT JOIN users u ON al.employee_id = u.id
    LEFT JOIN departments d ON al.department_id = d.id
    LEFT JOIN users ab ON al.allocated_by = ab.id
    WHERE al.asset_id = ?
    ORDER BY al.created_at DESC
  `).all(req.params.id);

  const maintenance = db.prepare(`
    SELECT mr.*, u.name as raised_by_name, t.name as technician_name, ap.name as approved_by_name
    FROM maintenance_requests mr
    LEFT JOIN users u ON mr.raised_by = u.id
    LEFT JOIN users t ON mr.technician_id = t.id
    LEFT JOIN users ap ON mr.approved_by = ap.id
    WHERE mr.asset_id = ?
    ORDER BY mr.created_at DESC
  `).all(req.params.id);

  res.json({ allocations, maintenance });
});

export default router;
