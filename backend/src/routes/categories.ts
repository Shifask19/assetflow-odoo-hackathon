import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM asset_categories ORDER BY name').all();
  res.json(categories);
});

router.post('/', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { name, description, custom_fields } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }
  const db = getDb();
  const id = uuidv4();
  db.prepare(`INSERT INTO asset_categories (id, name, description, custom_fields) VALUES (?, ?, ?, ?)`).run(
    id, name, description || null, JSON.stringify(custom_fields || [])
  );
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'CREATE_CATEGORY', 'asset_category', id, JSON.stringify({ name })
  );
  const cat = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(id);
  res.status(201).json(cat);
});

router.put('/:id', authenticate, requireRole('admin', 'asset_manager'), (req: Request, res: Response): void => {
  const { name, description, custom_fields } = req.body;
  const db = getDb();
  const cat = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(req.params.id) as any;
  if (!cat) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  db.prepare(`UPDATE asset_categories SET name = ?, description = ?, custom_fields = ? WHERE id = ?`).run(
    name || cat.name,
    description !== undefined ? description : cat.description,
    custom_fields !== undefined ? JSON.stringify(custom_fields) : cat.custom_fields,
    req.params.id
  );
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'UPDATE_CATEGORY', 'asset_category', req.params.id, JSON.stringify(req.body)
  );
  const updated = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', authenticate, requireRole('admin'), (req: Request, res: Response): void => {
  const db = getDb();
  const cat = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(req.params.id) as any;
  if (!cat) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  db.prepare(`DELETE FROM asset_categories WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'DELETE_CATEGORY', 'asset_category', req.params.id, JSON.stringify({ name: cat.name })
  );
  res.json({ message: 'Category deleted' });
});

export default router;
