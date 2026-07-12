import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.get('/', authenticate, requireRole('admin'), (req: Request, res: Response): void => {
  const db = getDb();
  const { entity_type, action, user_id, limit = 100, offset = 0 } = req.query;

  let query = `
    SELECT al.*, u.name as user_name, u.email as user_email
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (entity_type) { query += ' AND al.entity_type = ?'; params.push(entity_type); }
  if (action) { query += ' AND al.action LIKE ?'; params.push(`%${action}%`); }
  if (user_id) { query += ' AND al.user_id = ?'; params.push(user_id); }

  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const logs = db.prepare(query).all(...params);
  const total = (db.prepare('SELECT COUNT(*) as c FROM activity_logs').get() as any).c;

  res.json({ logs, total });
});

export default router;
