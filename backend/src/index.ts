import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDb } from './database/db';

// Routes
import authRoutes from './routes/auth';
import departmentRoutes from './routes/departments';
import categoryRoutes from './routes/categories';
import employeeRoutes from './routes/employees';
import assetRoutes from './routes/assets';
import allocationRoutes from './routes/allocations';
import bookingRoutes from './routes/bookings';
import maintenanceRoutes from './routes/maintenance';
import auditRoutes from './routes/audits';
import notificationRoutes from './routes/notifications';
import reportRoutes from './routes/reports';
import logRoutes from './routes/logs';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/logs', logRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database then start server
initDb()
  .then(() => {
    console.log('✅ Database initialized successfully');
    app.listen(PORT, () => {
      console.log(`🚀 AssetFlow Backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });

export default app;
