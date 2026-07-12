import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const cycles = db.prepare(`
    SELECT ac.*, d.name as scope_department_name, u.name as created_by_name,
           (SELECT COUNT(*) FROM audit_items ai WHERE ai.audit_cycle_id = ac.id) as total_items,
           (SELECT COUNT(*) FROM audit_items ai WHERE ai.audit_cycle_id = ac.id AND ai.status != 'Pending') as audited_items
    FROM audit_cycles ac
    LEFT JOIN departments d ON ac.scope_department_id = d.id
    LEFT JOIN users u ON ac.created_by = u.id
    ORDER BY ac.created_at DESC
  `).all();
  res.json(cycles);
});

router.post('/', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { name, scope_department_id, scope_location, start_date, end_date } = req.body;
  if (!name || !start_date || !end_date) {
    res.status(400).json({ error: 'Name, start date and end date are required' });
    return;
  }

  const db = getDb();
  const id = uuidv4();
  db.prepare(`INSERT INTO audit_cycles (id, name, scope_department_id, scope_location, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, scope_department_id || null, scope_location || null, start_date, end_date, req.user!.id
  );

  // Auto-populate audit items based on scope
  let assetQuery = 'SELECT id FROM assets WHERE 1=1';
  const assetParams: any[] = [];
  if (scope_department_id) { assetQuery += ' AND department_id = ?'; assetParams.push(scope_department_id); }
  if (scope_location) { assetQuery += ' AND location LIKE ?'; assetParams.push(`%${scope_location}%`); }

  const assets = db.prepare(assetQuery).all(...assetParams) as any[];
  const insertItem = db.prepare(`INSERT INTO audit_items (id, audit_cycle_id, asset_id) VALUES (?, ?, ?)`);
  for (const asset of assets) {
    insertItem.run(uuidv4(), id, asset.id);
  }

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'CREATE_AUDIT_CYCLE', 'audit_cycle', id, JSON.stringify({ name, itemCount: assets.length })
  );

  const cycle = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(id);
  res.status(201).json(cycle);
});

router.put('/:id', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { name, scope_department_id, scope_location, start_date, end_date, status } = req.body;
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.id) as any;
  if (!cycle) {
    res.status(404).json({ error: 'Audit cycle not found' });
    return;
  }
  if (cycle.status === 'Closed') {
    res.status(400).json({ error: 'Cannot modify a closed audit cycle' });
    return;
  }
  db.prepare(`UPDATE audit_cycles SET name=?, scope_department_id=?, scope_location=?, start_date=?, end_date=?, status=? WHERE id=?`).run(
    name || cycle.name,
    scope_department_id !== undefined ? (scope_department_id || null) : cycle.scope_department_id,
    scope_location !== undefined ? scope_location : cycle.scope_location,
    start_date || cycle.start_date,
    end_date || cycle.end_date,
    status || cycle.status,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.post('/:id/auditors', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { user_ids } = req.body;
  if (!Array.isArray(user_ids)) {
    res.status(400).json({ error: 'user_ids must be an array' });
    return;
  }
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.id) as any;
  if (!cycle) {
    res.status(404).json({ error: 'Audit cycle not found' });
    return;
  }

  // Delete existing auditors and re-add
  db.prepare('DELETE FROM audit_cycle_auditors WHERE audit_cycle_id = ?').run(req.params.id);
  const insert = db.prepare('INSERT OR IGNORE INTO audit_cycle_auditors (audit_cycle_id, user_id) VALUES (?, ?)');
  for (const uid of user_ids) {
    insert.run(req.params.id, uid);
    db.prepare(`INSERT INTO notifications (id, user_id, title, message, type, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      uuidv4(), uid, 'Assigned to Audit', `You have been assigned to audit cycle: "${cycle.name}"`, 'info', req.params.id, 'audit_cycle'
    );
  }

  // Update cycle status
  if (cycle.status === 'Open') {
    db.prepare(`UPDATE audit_cycles SET status = 'In Progress' WHERE id = ?`).run(req.params.id);
  }

  res.json({ message: 'Auditors assigned', count: user_ids.length });
});

router.get('/:id/items', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const items = db.prepare(`
    SELECT ai.*, a.name as asset_name, a.asset_tag, a.location, a.condition, a.status as asset_status,
           u.name as auditor_name, c.name as category_name
    FROM audit_items ai
    LEFT JOIN assets a ON ai.asset_id = a.id
    LEFT JOIN users u ON ai.auditor_id = u.id
    LEFT JOIN asset_categories c ON a.category_id = c.id
    WHERE ai.audit_cycle_id = ?
    ORDER BY a.name
  `).all(req.params.id);
  res.json(items);
});

router.put('/:id/items/:itemId', authenticate, (req: Request, res: Response): void => {
  const { status, notes } = req.body;
  const validStatuses = ['Pending', 'Verified', 'Missing', 'Damaged'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const db = getDb();
  const item = db.prepare('SELECT * FROM audit_items WHERE id = ? AND audit_cycle_id = ?').get(req.params.itemId, req.params.id) as any;
  if (!item) {
    res.status(404).json({ error: 'Audit item not found' });
    return;
  }

  db.prepare(`UPDATE audit_items SET status = ?, notes = ?, auditor_id = ?, audited_at = datetime('now') WHERE id = ?`).run(
    status, notes || null, req.user!.id, req.params.itemId
  );

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'UPDATE_AUDIT_ITEM', 'audit_item', req.params.itemId, JSON.stringify({ status, notes })
  );

  const updated = db.prepare('SELECT * FROM audit_items WHERE id = ?').get(req.params.itemId);
  res.json(updated);
});

router.post('/:id/close', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.id) as any;
  if (!cycle) {
    res.status(404).json({ error: 'Audit cycle not found' });
    return;
  }
  if (cycle.status === 'Closed') {
    res.status(400).json({ error: 'Audit cycle is already closed' });
    return;
  }

  // Lock cycle
  db.prepare(`UPDATE audit_cycles SET status = 'Closed' WHERE id = ?`).run(req.params.id);

  // Process discrepancies
  const missingItems = db.prepare(`SELECT ai.asset_id FROM audit_items ai WHERE ai.audit_cycle_id = ? AND ai.status = 'Missing'`).all(req.params.id) as any[];
  const damagedItems = db.prepare(`SELECT ai.asset_id FROM audit_items ai WHERE ai.audit_cycle_id = ? AND ai.status = 'Damaged'`).all(req.params.id) as any[];

  for (const item of missingItems) {
    db.prepare(`UPDATE assets SET status = 'Lost' WHERE id = ?`).run(item.asset_id);
  }
  for (const item of damagedItems) {
    db.prepare(`UPDATE assets SET condition = 'Poor' WHERE id = ?`).run(item.asset_id);
  }

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'CLOSE_AUDIT_CYCLE', 'audit_cycle', req.params.id, JSON.stringify({
      missing: missingItems.length,
      damaged: damagedItems.length
    })
  );

  res.json({
    message: 'Audit cycle closed',
    summary: {
      missing_assets: missingItems.length,
      damaged_assets: damagedItems.length
    }
  });
});

router.get('/:id/report', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.id) as any;
  if (!cycle) {
    res.status(404).json({ error: 'Audit cycle not found' });
    return;
  }

  const items = db.prepare(`
    SELECT ai.*, a.name as asset_name, a.asset_tag, a.location, a.condition,
           u.name as auditor_name
    FROM audit_items ai
    LEFT JOIN assets a ON ai.asset_id = a.id
    LEFT JOIN users u ON ai.auditor_id = u.id
    WHERE ai.audit_cycle_id = ?
    ORDER BY ai.status, a.name
  `).all(req.params.id) as any[];

  const summary = {
    total: items.length,
    verified: items.filter(i => i.status === 'Verified').length,
    missing: items.filter(i => i.status === 'Missing').length,
    damaged: items.filter(i => i.status === 'Damaged').length,
    pending: items.filter(i => i.status === 'Pending').length
  };

  res.json({ cycle, items, summary });
});

export default router;
