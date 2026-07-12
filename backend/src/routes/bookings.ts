import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';

const router = Router();

function createNotification(db: any, userId: string, title: string, message: string, type: string, refId: string, refType: string) {
  db.prepare(`INSERT INTO notifications (id, user_id, title, message, type, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), userId, title, message, type, refId, refType
  );
}

router.get('/', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const { asset_id } = req.query;
  let query = `
    SELECT b.*, a.name as asset_name, a.asset_tag, u.name as booked_by_name, u.email as booked_by_email
    FROM bookings b
    LEFT JOIN assets a ON b.asset_id = a.id
    LEFT JOIN users u ON b.booked_by = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (asset_id) { query += ' AND b.asset_id = ?'; params.push(asset_id); }
  if (req.user!.role === 'employee') { query += ' AND b.booked_by = ?'; params.push(req.user!.id); }

  query += ' ORDER BY b.start_time DESC';
  const bookings = db.prepare(query).all(...params);
  res.json(bookings);
});

router.post('/', authenticate, (req: Request, res: Response): void => {
  const { asset_id, start_time, end_time, purpose } = req.body;
  if (!asset_id || !start_time || !end_time) {
    res.status(400).json({ error: 'Asset, start time and end time are required' });
    return;
  }

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);
  if (startDate >= endDate) {
    res.status(400).json({ error: 'End time must be after start time' });
    return;
  }

  const db = getDb();

  // Check asset is bookable
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id) as any;
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }
  if (!asset.is_bookable) {
    res.status(400).json({ error: 'This asset is not bookable' });
    return;
  }

  // Overlap check
  const overlap = db.prepare(`
    SELECT b.*, u.name as booked_by_name
    FROM bookings b
    JOIN users u ON b.booked_by = u.id
    WHERE b.asset_id = ?
    AND b.status NOT IN ('Cancelled', 'Completed')
    AND b.start_time < ? AND b.end_time > ?
  `).get(asset_id, end_time, start_time) as any;

  if (overlap) {
    res.status(409).json({
      error: 'Time slot is already booked',
      conflict: {
        booked_by: overlap.booked_by_name,
        start_time: overlap.start_time,
        end_time: overlap.end_time,
        purpose: overlap.purpose
      }
    });
    return;
  }

  const id = uuidv4();
  db.prepare(`INSERT INTO bookings (id, asset_id, booked_by, start_time, end_time, purpose) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id, asset_id, req.user!.id, start_time, end_time, purpose || null
  );

  createNotification(db, req.user!.id, 'Booking Confirmed', `Your booking for "${asset.name}" has been confirmed.`, 'success', id, 'booking');

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'CREATE_BOOKING', 'booking', id, JSON.stringify({ asset_id, start_time, end_time })
  );

  const booking = db.prepare(`
    SELECT b.*, a.name as asset_name, u.name as booked_by_name
    FROM bookings b LEFT JOIN assets a ON b.asset_id = a.id LEFT JOIN users u ON b.booked_by = u.id
    WHERE b.id = ?
  `).get(id);
  res.status(201).json(booking);
});

router.put('/:id/cancel', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  if (booking.booked_by !== req.user!.id && !['admin', 'asset_manager'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Not authorized to cancel this booking' });
    return;
  }
  if (['Cancelled', 'Completed'].includes(booking.status)) {
    res.status(400).json({ error: `Booking is already ${booking.status}` });
    return;
  }

  db.prepare(`UPDATE bookings SET status = 'Cancelled', cancelled_by = ? WHERE id = ?`).run(req.user!.id, req.params.id);
  createNotification(db, booking.booked_by, 'Booking Cancelled', `Your booking has been cancelled.`, 'warning', req.params.id, 'booking');

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'CANCEL_BOOKING', 'booking', req.params.id, JSON.stringify({})
  );
  res.json({ message: 'Booking cancelled' });
});

router.put('/:id', authenticate, (req: Request, res: Response): void => {
  const { start_time, end_time, purpose } = req.body;
  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  if (booking.booked_by !== req.user!.id && !['admin', 'asset_manager'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Not authorized to modify this booking' });
    return;
  }

  const newStart = start_time || booking.start_time;
  const newEnd = end_time || booking.end_time;

  // Re-validate overlap
  const overlap = db.prepare(`
    SELECT * FROM bookings
    WHERE asset_id = ?
    AND id != ?
    AND status NOT IN ('Cancelled', 'Completed')
    AND start_time < ? AND end_time > ?
  `).get(booking.asset_id, req.params.id, newEnd, newStart);

  if (overlap) {
    res.status(409).json({ error: 'New time slot conflicts with an existing booking' });
    return;
  }

  db.prepare(`UPDATE bookings SET start_time = ?, end_time = ?, purpose = ? WHERE id = ?`).run(
    newStart, newEnd, purpose !== undefined ? purpose : booking.purpose, req.params.id
  );

  db.prepare(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), req.user!.id, 'UPDATE_BOOKING', 'booking', req.params.id, JSON.stringify({ start_time: newStart, end_time: newEnd })
  );

  const updated = db.prepare(`
    SELECT b.*, a.name as asset_name, u.name as booked_by_name
    FROM bookings b LEFT JOIN assets a ON b.asset_id = a.id LEFT JOIN users u ON b.booked_by = u.id
    WHERE b.id = ?
  `).get(req.params.id);
  res.json(updated);
});

router.get('/calendar/:assetId', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const bookings = db.prepare(`
    SELECT b.*, u.name as booked_by_name
    FROM bookings b
    LEFT JOIN users u ON b.booked_by = u.id
    WHERE b.asset_id = ? AND b.status NOT IN ('Cancelled', 'Completed')
    ORDER BY b.start_time
  `).all(req.params.assetId);
  res.json(bookings);
});

export default router;
