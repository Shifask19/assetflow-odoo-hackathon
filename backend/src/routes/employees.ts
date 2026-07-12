import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const employees = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
           u.department_id, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY u.name
  `).all();
  res.json(employees);
});

router.put('/:id/role', authenticate, requireRole('admin'), (req: Request, res: Response): void => {
  const { role } = req.body;
  const validRoles = ['admin', 'asset_manager', 'department_head', 'employee'];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'UPDATE_ROLE', 'user', req.params.id, JSON.stringify({ from: user.role, to: role })
  );
  res.json({ message: 'Role updated successfully' });
});

router.put('/:id/status', authenticate, requireRole('admin'), (req: Request, res: Response): void => {
  const { status } = req.body;
  if (!status || !['active', 'inactive'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'UPDATE_USER_STATUS', 'user', req.params.id, JSON.stringify({ status })
  );
  res.json({ message: 'User status updated' });
});

router.put('/:id', authenticate, requireRole('admin'), (req: Request, res: Response): void => {
  const { name, department_id } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  db.prepare('UPDATE users SET name = ?, department_id = ? WHERE id = ?').run(
    name || user.name,
    department_id !== undefined ? (department_id || null) : user.department_id,
    req.params.id
  );
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'UPDATE_EMPLOYEE', 'user', req.params.id, JSON.stringify(req.body)
  );
  const updated = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.status, u.department_id, d.name as department_name
    FROM users u LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(req.params.id);
  res.json(updated);
});

export default router;
