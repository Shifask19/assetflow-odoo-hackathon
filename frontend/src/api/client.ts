import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('assetflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('assetflow_token');
      localStorage.removeItem('assetflow_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  signup: (name: string, email: string, password: string) => api.post('/auth/signup', { name, email, password }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  me: () => api.get('/auth/me'),
};

// Departments
export const departmentsApi = {
  getAll: () => api.get('/departments'),
  create: (data: any) => api.post('/departments', data),
  update: (id: string, data: any) => api.put(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),
};

// Categories
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Employees
export const employeesApi = {
  getAll: () => api.get('/employees'),
  updateRole: (id: string, role: string) => api.put(`/employees/${id}/role`, { role }),
  updateStatus: (id: string, status: string) => api.put(`/employees/${id}/status`, { status }),
  update: (id: string, data: any) => api.put(`/employees/${id}`, data),
};

// Assets
export const assetsApi = {
  getAll: (params?: any) => api.get('/assets', { params }),
  getById: (id: string) => api.get(`/assets/${id}`),
  create: (data: any) => api.post('/assets', data),
  update: (id: string, data: any) => api.put(`/assets/${id}`, data),
  getHistory: (id: string) => api.get(`/assets/${id}/history`),
};

// Allocations
export const allocationsApi = {
  getAll: () => api.get('/allocations'),
  create: (data: any) => api.post('/allocations', data),
  return: (id: string, notes?: string) => api.post(`/allocations/${id}/return`, { condition_checkin_notes: notes }),
  getTransferRequests: () => api.get('/allocations/transfer-requests'),
  createTransferRequest: (data: any) => api.post('/allocations/transfer-requests', data),
  approveTransfer: (id: string) => api.put(`/allocations/transfer-requests/${id}/approve`),
  rejectTransfer: (id: string, notes?: string) => api.put(`/allocations/transfer-requests/${id}/reject`, { notes }),
};

// Bookings
export const bookingsApi = {
  getAll: (params?: any) => api.get('/bookings', { params }),
  create: (data: any) => api.post('/bookings', data),
  cancel: (id: string) => api.put(`/bookings/${id}/cancel`),
  update: (id: string, data: any) => api.put(`/bookings/${id}`, data),
  getCalendar: (assetId: string) => api.get(`/bookings/calendar/${assetId}`),
};

// Maintenance
export const maintenanceApi = {
  getAll: () => api.get('/maintenance'),
  create: (data: any) => api.post('/maintenance', data),
  approve: (id: string) => api.put(`/maintenance/${id}/approve`),
  reject: (id: string, notes?: string) => api.put(`/maintenance/${id}/reject`, { notes }),
  assign: (id: string, technician_id: string) => api.put(`/maintenance/${id}/assign`, { technician_id }),
  progress: (id: string) => api.put(`/maintenance/${id}/progress`),
  resolve: (id: string, notes?: string) => api.put(`/maintenance/${id}/resolve`, { technician_notes: notes }),
};

// Audits
export const auditsApi = {
  getAll: () => api.get('/audits'),
  create: (data: any) => api.post('/audits', data),
  update: (id: string, data: any) => api.put(`/audits/${id}`, data),
  assignAuditors: (id: string, user_ids: string[]) => api.post(`/audits/${id}/auditors`, { user_ids }),
  getItems: (id: string) => api.get(`/audits/${id}/items`),
  updateItem: (cycleId: string, itemId: string, data: any) => api.put(`/audits/${cycleId}/items/${itemId}`, data),
  close: (id: string) => api.post(`/audits/${id}/close`),
  getReport: (id: string) => api.get(`/audits/${id}/report`),
};

// Notifications
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// Reports
export const reportsApi = {
  getKpiDashboard: () => api.get('/reports/kpi-dashboard'),
  getUtilization: () => api.get('/reports/utilization'),
  getMaintenanceFrequency: () => api.get('/reports/maintenance-frequency'),
  getDueMaintenance: () => api.get('/reports/due-maintenance'),
  getDepartmentAllocation: () => api.get('/reports/department-allocation'),
  getBookingHeatmap: () => api.get('/reports/booking-heatmap'),
};

// Logs
export const logsApi = {
  getAll: (params?: any) => api.get('/logs', { params }),
};

export default api;
