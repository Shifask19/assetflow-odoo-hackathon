import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

function createNotification(db: any, userId: string, title: string, message: string, type: string, refId: string) {
  db.prepare(`INSERT INTO notifications (id, user_id, title, message, type, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, 'maintenance')`).run(
    uuidv4(), userId, title, message, type, refId
  );
}

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  let query = `
    SELECT mr.*, a.name as asset_name, a.asset_tag,
           u.name as raised_by_name,
           ap.name as approved_by_name,
           t.name as technician_name
    FROM maintenance_requests mr
    LEFT JOIN assets a ON mr.asset_id = a.id
    LEFT JOIN users u ON mr.raised_by = u.id
    LEFT JOIN users ap ON mr.approved_by = ap.id
    LEFT JOIN users t ON mr.technician_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'employee') {
    query += ' AND mr.raised_by = ?';
    params.push(req.user!.id);
  }

  query += ' ORDER BY mr.created_at DESC';
  const requests = db.prepare(query).all(...params);
  res.json(requests);
});

router.post('/', authenticate, (req: Request, res: Response): void => {
  const { asset_id, issue_description, priority, photo_url } = req.body;
  if (!asset_id || !issue_description) {
    res.status(400).json({ error: 'Asset and issue description are required' });
    return;
  }

  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id) as any;
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  const id = uuidv4();
  db.prepare(`INSERT INTO maintenance_requests (id, asset_id, raised_by, issue_description, priority, photo_url) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id, asset_id, req.user!.id, issue_description, priority || 'Medium', photo_url || null
  );

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'RAISE_MAINTENANCE', 'maintenance_request', id, JSON.stringify({ asset_id, asset_name: asset.name, priority })
  );

  const request = db.prepare(`
    SELECT mr.*, a.name as asset_name, a.asset_tag, u.name as raised_by_name
    FROM maintenance_requests mr
    LEFT JOIN assets a ON mr.asset_id = a.id
    LEFT JOIN users u ON mr.raised_by = u.id
    WHERE mr.id = ?
  `).get(id);
  res.status(201).json(request);
});

router.put('/:id/approve', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const db = getDb();
  const mr = db.prepare(`
    SELECT mr.*, a.name as asset_name
    FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id
    WHERE mr.id = ?
  `).get(req.params.id) as any;
  if (!mr) {
    res.status(404).json({ error: 'Maintenance request not found' });
    return;
  }
  if (mr.status !== 'Pending') {
    res.status(400).json({ error: 'Request must be Pending to approve' });
    return;
  }

  db.prepare(`UPDATE maintenance_requests SET status = 'Approved', approved_by = ? WHERE id = ?`).run(req.user!.id, req.params.id);
  db.prepare(`UPDATE assets SET status = 'Under Maintenance' WHERE id = ?`).run(mr.asset_id);

  createNotification(db, mr.raised_by, 'Maintenance Approved', `Your maintenance request for "${mr.asset_name}" has been approved.`, 'success', req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'APPROVE_MAINTENANCE', 'maintenance_request', req.params.id, JSON.stringify({})
  );
  res.json({ message: 'Maintenance request approved' });
});

router.put('/:id/reject', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { notes } = req.body;
  const db = getDb();
  const mr = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id) as any;
  if (!mr) {
    res.status(404).json({ error: 'Maintenance request not found' });
    return;
  }
  db.prepare(`UPDATE maintenance_requests SET status = 'Rejected', approved_by = ?, technician_notes = ? WHERE id = ?`).run(
    req.user!.id, notes || null, req.params.id
  );
  createNotification(db, mr.raised_by, 'Maintenance Rejected', `Your maintenance request has been rejected.`, 'warning', req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'REJECT_MAINTENANCE', 'maintenance_request', req.params.id, JSON.stringify({})
  );
  res.json({ message: 'Maintenance request rejected' });
});

router.put('/:id/assign', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { technician_id } = req.body;
  if (!technician_id) {
    res.status(400).json({ error: 'Technician ID is required' });
    return;
  }
  const db = getDb();
  const mr = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id) as any;
  if (!mr) {
    res.status(404).json({ error: 'Maintenance request not found' });
    return;
  }
  db.prepare(`UPDATE maintenance_requests SET status = 'Technician Assigned', technician_id = ? WHERE id = ?`).run(technician_id, req.params.id);
  createNotification(db, technician_id, 'Maintenance Task Assigned', `You have been assigned a maintenance task.`, 'info', req.params.id);
  createNotification(db, mr.raised_by, 'Technician Assigned', `A technician has been assigned to your maintenance request.`, 'info', req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'ASSIGN_TECHNICIAN', 'maintenance_request', req.params.id, JSON.stringify({ technician_id })
  );
  res.json({ message: 'Technician assigned' });
});

router.put('/:id/progress', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const mr = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id) as any;
  if (!mr) {
    res.status(404).json({ error: 'Maintenance request not found' });
    return;
  }
  if (mr.technician_id !== req.user!.id && !['admin', 'asset_manager'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }
  db.prepare(`UPDATE maintenance_requests SET status = 'In Progress' WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'START_MAINTENANCE', 'maintenance_request', req.params.id, JSON.stringify({})
  );
  res.json({ message: 'Maintenance in progress' });
});

router.put('/:id/resolve', authenticate, (req: Request, res: Response): void => {
  const { technician_notes } = req.body;
  const db = getDb();
  const mr = db.prepare(`
    SELECT mr.*, a.name as asset_name
    FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id
    WHERE mr.id = ?
  `).get(req.params.id) as any;
  if (!mr) {
    res.status(404).json({ error: 'Maintenance request not found' });
    return;
  }
  if (mr.technician_id !== req.user!.id && !['admin', 'asset_manager'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  db.prepare(`UPDATE maintenance_requests SET status = 'Resolved', resolved_at = datetime('now'), technician_notes = ? WHERE id = ?`).run(
    technician_notes || null, req.params.id
  );
  db.prepare(`UPDATE assets SET status = 'Available' WHERE id = ?`).run(mr.asset_id);

  createNotification(db, mr.raised_by, 'Maintenance Resolved', `Maintenance for "${mr.asset_name}" has been resolved.`, 'success', req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'RESOLVE_MAINTENANCE', 'maintenance_request', req.params.id, JSON.stringify({})
  );
  res.json({ message: 'Maintenance resolved' });
});

export default router;
