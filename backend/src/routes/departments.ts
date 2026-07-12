import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const departments = db.prepare(`
    SELECT d.*, u.name as head_name, u.email as head_email,
           p.name as parent_name
    FROM departments d
    LEFT JOIN users u ON d.head_id = u.id
    LEFT JOIN departments p ON d.parent_id = p.id
    ORDER BY d.name
  `).all();
  res.json(departments);
});

router.post('/', authenticate, requireRole('admin'), (req: Request, res: Response): void => {
  const { name, head_id, parent_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Department name is required' });
    return;
  }
  const db = getDb();
  const id = uuidv4();
  db.prepare(`INSERT INTO departments (id, name, head_id, parent_id) VALUES (?, ?, ?, ?)`).run(id, name, head_id || null, parent_id || null);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'CREATE_DEPARTMENT', 'department', id, JSON.stringify({ name })
  );
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  res.status(201).json(dept);
});

router.put('/:id', authenticate, requireRole('admin'), (req: Request, res: Response): void => {
  const { name, head_id, parent_id, status } = req.body;
  const db = getDb();
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id) as any;
  if (!dept) {
    res.status(404).json({ error: 'Department not found' });
    return;
  }
  db.prepare(`UPDATE departments SET name = ?, head_id = ?, parent_id = ?, status = ? WHERE id = ?`).run(
    name || dept.name,
    head_id !== undefined ? (head_id || null) : dept.head_id,
    parent_id !== undefined ? (parent_id || null) : dept.parent_id,
    status || dept.status,
    req.params.id
  );
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'UPDATE_DEPARTMENT', 'department', req.params.id, JSON.stringify(req.body)
  );
  const updated = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', authenticate, requireRole('admin'), (req: Request, res: Response): void => {
  const db = getDb();
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id) as any;
  if (!dept) {
    res.status(404).json({ error: 'Department not found' });
    return;
  }
  db.prepare(`UPDATE departments SET status = 'inactive' WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'DEACTIVATE_DEPARTMENT', 'department', req.params.id, JSON.stringify({ name: dept.name })
  );
  res.json({ message: 'Department deactivated' });
});

export default router;
