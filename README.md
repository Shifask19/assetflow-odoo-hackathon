# AssetFlow — Odoo Hackathon Submission

A full-stack IT Asset Management System built for the Odoo Hackathon.

## What it does

AssetFlow helps organizations track, manage, and audit their physical assets across departments. Key features:

- **Asset Registry** — Add, edit, and track assets with tags, categories, conditions, and locations
- **Allocations** — Assign assets to employees and track return dates / overdue items
- **Bookings** — Reserve shared/bookable assets (projectors, vehicles, etc.) by time slot
- **Maintenance** — Raise and manage maintenance requests with priority levels
- **Audit Cycles** — Run structured asset audits, assign auditors, and generate discrepancy reports
- **Notifications** — In-app alerts for overdue allocations, maintenance updates, and more
- **Reports** — Asset utilization, allocation history, and maintenance summaries
- **Role-based Access** — Admin, Asset Manager, Department Head, and Employee roles

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite via sql.js (zero native dependencies) |
| Auth | JWT |

## Project Structure

```
assetflow/
├── backend/          # Express REST API
│   └── src/
│       ├── database/ # SQLite schema + db setup
│       ├── middleware/
│       └── routes/
└── frontend/         # React SPA
    └── src/
        ├── api/
        ├── components/
        ├── contexts/
        ├── pages/
        └── types/
```

## Running Locally

**Prerequisites:** Node.js v18+

**Terminal 1 — Backend:**
```bash
cd backend
npm install
npm run dev
# Server starts at http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
# App opens at http://localhost:5173
```

## Default Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@assetflow.com | Admin@123 |
| Asset Manager | manager@assetflow.com | Admin@123 |
| Department Head | dhead@assetflow.com | Admin@123 |
| Employee | bob@assetflow.com | Admin@123 |
