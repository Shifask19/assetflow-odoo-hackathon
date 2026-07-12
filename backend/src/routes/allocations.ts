import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

function createNotification(db: any, userId: string, title: string, message: string, type: string, refId: string, refType: string) {
  db.prepare(`INSERT INTO notifications (id, user_id, title, message, type, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), userId, title, message, type, refId, refType
  );
}

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  // Update overdue allocations
  db.prepare(`UPDATE allocations SET status = 'Overdue' WHERE expected_return_date < datetime('now') AND status = 'Active'`).run();

  let query = `
    SELECT al.*, a.name as asset_name, a.asset_tag, a.status as asset_status,
           u.name as employee_name, u.email as employee_email,
           d.name as department_name, ab.name as allocated_by_name
    FROM allocations al
    LEFT JOIN assets a ON al.asset_id = a.id
    LEFT JOIN users u ON al.employee_id = u.id
    LEFT JOIN departments d ON al.department_id = d.id
    LEFT JOIN users ab ON al.allocated_by = ab.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Role-based filtering
  if (req.user!.role === 'employee') {
    query += ' AND al.employee_id = ?';
    params.push(req.user!.id);
  }

  query += ' ORDER BY al.created_at DESC';
  const allocations = db.prepare(query).all(...params);
  res.json(allocations);
});

router.post('/', authenticate, requireRole('admin', 'asset_manager', 'department_head'), (req: Request, res: Response): void => {
  const { asset_id, employee_id, department_id, expected_return_date } = req.body;
  if (!asset_id || !employee_id) {
    res.status(400).json({ error: 'Asset and employee are required' });
    return;
  }

  const db = getDb();

  // Check for existing active allocation
  const existing = db.prepare(`
    SELECT al.*, u.name as holder_name, u.email as holder_email
    FROM allocations al
    JOIN users u ON al.employee_id = u.id
    WHERE al.asset_id = ? AND al.status IN ('Active', 'Overdue')
  `).get(asset_id) as any;

  if (existing) {
    res.status(409).json({
      error: 'Asset is already allocated',
      current_holder: { name: existing.holder_name, email: existing.holder_email },
      allocation_id: existing.id
    });
    return;
  }

  // Check asset availability
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id) as any;
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }
  if (!['Available', 'Reserved'].includes(asset.status)) {
    res.status(409).json({ error: `Asset is currently ${asset.status}` });
    return;
  }

  const id = uuidv4();
  db.prepare(`INSERT INTO allocations (id, asset_id, employee_id, department_id, allocated_by, expected_return_date) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id, asset_id, employee_id, department_id || null, req.user!.id, expected_return_date || null
  );

  db.prepare(`UPDATE assets SET status = 'Allocated' WHERE id = ?`).run(asset_id);

  const employee = db.prepare('SELECT * FROM users WHERE id = ?').get(employee_id) as any;
  createNotification(db, employee_id, 'Asset Allocated to You', `Asset "${asset.name}" (${asset.asset_tag}) has been allocated to you.`, 'allocation', id, 'allocation');
  createNotification(db, req.user!.id, 'Allocation Created', `Asset "${asset.name}" allocated to ${employee?.name}.`, 'success', id, 'allocation');

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'ALLOCATE_ASSET', 'allocation', id, JSON.stringify({ asset_id, employee_id, asset_name: asset.name })
  );

  const allocation = db.prepare(`
    SELECT al.*, a.name as asset_name, a.asset_tag,
           u.name as employee_name, ab.name as allocated_by_name
    FROM allocations al
    LEFT JOIN assets a ON al.asset_id = a.id
    LEFT JOIN users u ON al.employee_id = u.id
    LEFT JOIN users ab ON al.allocated_by = ab.id
    WHERE al.id = ?
  `).get(id);
  res.status(201).json(allocation);
});

router.post('/:id/return', authenticate, (req: Request, res: Response): void => {
  const { condition_checkin_notes } = req.body;
  const db = getDb();

  const allocation = db.prepare(`
    SELECT al.*, a.name as asset_name
    FROM allocations al JOIN assets a ON al.asset_id = a.id
    WHERE al.id = ?
  `).get(req.params.id) as any;

  if (!allocation) {
    res.status(404).json({ error: 'Allocation not found' });
    return;
  }
  if (!['Active', 'Overdue'].includes(allocation.status)) {
    res.status(400).json({ error: 'Allocation is not active' });
    return;
  }

  db.prepare(`UPDATE allocations SET status = 'Returned', returned_at = datetime('now'), actual_return_date = datetime('now'), condition_checkin_notes = ? WHERE id = ?`).run(
    condition_checkin_notes || null, req.params.id
  );
  db.prepare(`UPDATE assets SET status = 'Available' WHERE id = ?`).run(allocation.asset_id);

  createNotification(db, allocation.employee_id, 'Asset Returned', `Asset "${allocation.asset_name}" has been successfully returned.`, 'success', req.params.id, 'allocation');

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'RETURN_ASSET', 'allocation', req.params.id, JSON.stringify({ asset_id: allocation.asset_id })
  );

  res.json({ message: 'Asset returned successfully' });
});

// Transfer Requests
router.post('/transfer-requests', authenticate, (req: Request, res: Response): void => {
  const { asset_id, from_employee_id, to_employee_id, to_department_id, notes } = req.body;
  if (!asset_id) {
    res.status(400).json({ error: 'Asset is required' });
    return;
  }

  const db = getDb();
  const id = uuidv4();
  db.prepare(`INSERT INTO transfer_requests (id, asset_id, requested_by, from_employee_id, to_employee_id, to_department_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id, asset_id, req.user!.id, from_employee_id || null, to_employee_id || null, to_department_id || null, notes || null
  );

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id) as any;
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'CREATE_TRANSFER_REQUEST', 'transfer_request', id, JSON.stringify({ asset_id, asset_name: asset?.name })
  );

  const req2 = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(id);
  res.status(201).json(req2);
});

router.get('/transfer-requests', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const requests = db.prepare(`
    SELECT tr.*, a.name as asset_name, a.asset_tag,
           rb.name as requested_by_name, fe.name as from_employee_name,
           te.name as to_employee_name, td.name as to_department_name,
           ap.name as approved_by_name
    FROM transfer_requests tr
    LEFT JOIN assets a ON tr.asset_id = a.id
    LEFT JOIN users rb ON tr.requested_by = rb.id
    LEFT JOIN users fe ON tr.from_employee_id = fe.id
    LEFT JOIN users te ON tr.to_employee_id = te.id
    LEFT JOIN departments td ON tr.to_department_id = td.id
    LEFT JOIN users ap ON tr.approved_by = ap.id
    ORDER BY tr.created_at DESC
  `).all();
  res.json(requests);
});

router.put('/transfer-requests/:id/approve', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const db = getDb();
  const tr = db.prepare(`
    SELECT tr.*, a.name as asset_name
    FROM transfer_requests tr JOIN assets a ON tr.asset_id = a.id
    WHERE tr.id = ?
  `).get(req.params.id) as any;

  if (!tr) {
    res.status(404).json({ error: 'Transfer request not found' });
    return;
  }
  if (tr.status !== 'Requested') {
    res.status(400).json({ error: 'Transfer request is not pending' });
    return;
  }

  db.prepare(`UPDATE transfer_requests SET status = 'Approved', approved_by = ?, updated_at = datetime('now') WHERE id = ?`).run(
    req.user!.id, req.params.id
  );

  // Close old allocation
  if (tr.from_employee_id) {
    db.prepare(`UPDATE allocations SET status = 'Transferred', returned_at = datetime('now') WHERE asset_id = ? AND status IN ('Active', 'Overdue')`).run(tr.asset_id);
  }

  // Create new allocation if transferring to an employee
  if (tr.to_employee_id) {
    const newAllocId = uuidv4();
    db.prepare(`INSERT INTO allocations (id, asset_id, employee_id, department_id, allocated_by, status) VALUES (?, ?, ?, ?, ?, 'Active')`).run(
      newAllocId, tr.asset_id, tr.to_employee_id, tr.to_department_id || null, req.user!.id
    );
    createNotification(db, tr.to_employee_id, 'Asset Transferred to You', `Asset "${tr.asset_name}" has been transferred to you.`, 'allocation', newAllocId, 'allocation');
  }

  createNotification(db, tr.requested_by, 'Transfer Request Approved', `Your transfer request for "${tr.asset_name}" has been approved.`, 'success', req.params.id, 'transfer_request');

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'APPROVE_TRANSFER', 'transfer_request', req.params.id, JSON.stringify({ asset_id: tr.asset_id })
  );

  res.json({ message: 'Transfer approved' });
});

router.put('/transfer-requests/:id/reject', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { notes } = req.body;
  const db = getDb();
  const tr = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(req.params.id) as any;
  if (!tr) {
    res.status(404).json({ error: 'Transfer request not found' });
    return;
  }
  db.prepare(`UPDATE transfer_requests SET status = 'Rejected', approved_by = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`).run(
    req.user!.id, notes || tr.notes, req.params.id
  );
  createNotification(db, tr.requested_by, 'Transfer Request Rejected', `Your transfer request has been rejected.`, 'warning', req.params.id, 'transfer_request');
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'REJECT_TRANSFER', 'transfer_request', req.params.id, JSON.stringify({})
  );
  res.json({ message: 'Transfer rejected' });
});

export default router;
