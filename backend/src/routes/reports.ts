import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/kpi-dashboard', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  // Update overdue
  db.prepare(`UPDATE allocations SET status = 'Overdue' WHERE expected_return_date < datetime('now') AND status = 'Active'`).run();

  const totalAssets = (db.prepare(`SELECT COUNT(*) as c FROM assets`).get() as any).c;
  const available = (db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Available'`).get() as any).c;
  const allocated = (db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Allocated'`).get() as any).c;
  const underMaintenance = (db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Under Maintenance'`).get() as any).c;
  const maintenanceToday = (db.prepare(`SELECT COUNT(*) as c FROM maintenance_requests WHERE DATE(created_at) = DATE('now') AND status NOT IN ('Resolved', 'Rejected')`).get() as any).c;
  const activeBookings = (db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status IN ('Upcoming', 'Ongoing')`).get() as any).c;
  const pendingTransfers = (db.prepare(`SELECT COUNT(*) as c FROM transfer_requests WHERE status = 'Requested'`).get() as any).c;
  const overdueAllocations = (db.prepare(`SELECT COUNT(*) as c FROM allocations WHERE status = 'Overdue'`).get() as any).c;
  const upcomingReturns = (db.prepare(`SELECT COUNT(*) as c FROM allocations WHERE status = 'Active' AND expected_return_date BETWEEN datetime('now') AND datetime('now', '+7 days')`).get() as any).c;

  const overdueList = db.prepare(`
    SELECT al.*, a.name as asset_name, a.asset_tag, u.name as employee_name, u.email as employee_email
    FROM allocations al
    JOIN assets a ON al.asset_id = a.id
    JOIN users u ON al.employee_id = u.id
    WHERE al.status = 'Overdue'
    ORDER BY al.expected_return_date ASC
    LIMIT 10
  `).all();

  const recentActivity = db.prepare(`
    SELECT al.*, u.name as user_name, u.email as user_email
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT 10
  `).all();

  res.json({
    kpis: { totalAssets, available, allocated, underMaintenance, maintenanceToday, activeBookings, pendingTransfers, overdueAllocations, upcomingReturns },
    overdueList,
    recentActivity
  });
});

router.get('/utilization', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const data = db.prepare(`
    SELECT
      c.name as category,
      COUNT(DISTINCT a.id) as total,
      SUM(CASE WHEN a.status = 'Allocated' THEN 1 ELSE 0 END) as allocated,
      SUM(CASE WHEN a.status = 'Available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN a.status = 'Under Maintenance' THEN 1 ELSE 0 END) as maintenance
    FROM assets a
    LEFT JOIN asset_categories c ON a.category_id = c.id
    GROUP BY c.id, c.name
    ORDER BY total DESC
  `).all();
  res.json(data);
});

router.get('/maintenance-frequency', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const data = db.prepare(`
    SELECT
      a.name as asset_name, a.asset_tag,
      COUNT(*) as maintenance_count,
      SUM(CASE WHEN mr.priority = 'Critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN mr.priority = 'High' THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN mr.status = 'Resolved' THEN 1 ELSE 0 END) as resolved
    FROM maintenance_requests mr
    LEFT JOIN assets a ON mr.asset_id = a.id
    GROUP BY mr.asset_id, a.name, a.asset_tag
    ORDER BY maintenance_count DESC
    LIMIT 10
  `).all();
  res.json(data);
});

router.get('/due-maintenance', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const data = db.prepare(`
    SELECT a.*, c.name as category_name,
           MAX(mr.resolved_at) as last_maintenance
    FROM assets a
    LEFT JOIN asset_categories c ON a.category_id = c.id
    LEFT JOIN maintenance_requests mr ON a.id = mr.asset_id AND mr.status = 'Resolved'
    WHERE a.status NOT IN ('Retired', 'Disposed', 'Lost')
    GROUP BY a.id
    HAVING last_maintenance IS NULL OR last_maintenance < datetime('now', '-90 days')
    ORDER BY last_maintenance ASC
    LIMIT 20
  `).all();
  res.json(data);
});

router.get('/department-allocation', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const data = db.prepare(`
    SELECT d.name as department,
           COUNT(a.id) as total_assets,
           SUM(CASE WHEN a.status = 'Allocated' THEN 1 ELSE 0 END) as allocated,
           SUM(CASE WHEN a.status = 'Available' THEN 1 ELSE 0 END) as available,
           SUM(COALESCE(a.acquisition_cost, 0)) as total_value
    FROM departments d
    LEFT JOIN assets a ON a.department_id = d.id
    WHERE d.status = 'active'
    GROUP BY d.id, d.name
    ORDER BY total_assets DESC
  `).all();
  res.json(data);
});

router.get('/booking-heatmap', authenticate, (req: Request, res: Response): void => {
  const db = getDb();
  const bookings = db.prepare(`
    SELECT
      CAST(strftime('%H', start_time) AS INTEGER) as hour,
      strftime('%w', start_time) as day_of_week,
      COUNT(*) as count
    FROM bookings
    WHERE status != 'Cancelled'
    AND start_time >= datetime('now', '-30 days')
    GROUP BY hour, day_of_week
    ORDER BY day_of_week, hour
  `).all();
  res.json(bookings);
});

export default router;
