import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user!.id);
  res.json(notifications);
});

router.get('/unread-count', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user!.id) as any;
  res.json({ count: result.count });
});

router.put('/read-all', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ message: 'All notifications marked as read' });
});

router.put('/:id/read', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Notification marked as read' });
});

export default router;
