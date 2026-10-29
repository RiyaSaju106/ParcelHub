# ParcelHub — Smart Parcel & Locker Management System

## 1. Project Overview

ParcelHub is a smart parcel and locker management system designed for modern tech parks. It handles incoming parcels, recipient tracking, smart locker inventory, parcel exception reporting, database-authenticated login/logout sessions, strict role-based access control (RBAC), and the full parcel pickup lifecycle.

The application features a responsive frontend connected to a FastAPI backend powered by MySQL (relational core) and MongoDB (NoSQL incident register).

## 2. Technology Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla JS with token-authenticated sessions)
- **Backend:** Python, FastAPI, Uvicorn
- **Authentication & Security:** HMAC-SHA256 stateless session tokens, database password validation, inactive user blocking
- **Relational Database:** MySQL
- **NoSQL Database:** MongoDB
- **API Documentation and Testing:** FastAPI Swagger UI (`/docs`)

## 3. Main Features

### 1. Database-Validated Login & Session Management
- **Dedicated Login Page (`login.html`):** Validates email and password directly against the `users` table in MySQL.
- **Role from Database:** Roles are never selected from client-side dropdowns; the user's role is strictly derived from their authenticated database record.
- **Account Inactivity Guard:** Inactive accounts (`account_status != 'active'`) are blocked from logging in with `HTTP 403 Forbidden`.
- **Session Persistence & Logout:** Issues a signed bearer token stored in `localStorage`. Log out revokes the session and clears local credentials.

### 2. Actual Role-Based Access Control (RBAC)
Enforces granular access permissions across 4 distinct roles at the backend API level:
- **Admin:** Full privileges across all modules (Users, Parcels, Lockers, Incidents, Pickup).
- **Security:** Access to monitor parcels, lockers, and report/inspect incidents. Can assist with desk parcel pickups. Restricted from user account management (`HTTP 403`).
- **Courier:** Restricted strictly to their assigned deliveries and locker statuses for drop-offs. Forbidden from incident management and customer parcel pickups (`HTTP 403`).
- **Employee (Recipient):** Self-service role. Views **only parcels addressed to them** and executes pickup **only for their own parcels**. Forbidden from user records and incidents (`HTTP 403`).

### 3. Complete Parcel Pickup Workflow
- **Recipient Ownership & Status Verification:** Employees can pick up parcels addressed to their user ID when the status is ready (`ready_for_pickup`, `stored`, or `received`).
- **Duplicate Pickup Prevention:** If a parcel has already been collected, the backend rejects duplicate requests with `HTTP 400 Bad Request`.
- **Atomic Database Transaction (`START TRANSACTION` ... `COMMIT`):**
  1. Updates `parcels.parcel_status` to `'picked_up'` and records `picked_up_at = NOW()`.
  2. Updates `deliveries.delivery_status` to `'picked_up'` with timestamp.
  3. Releases the active locker assignment (`locker_assignments.released_at = NOW()`).
  4. Restores locker availability (`lockers.locker_status = 'available'`).
  5. Rolls back all changes if any query fails, guaranteeing data consistency.

### 4. Smart Locker Management
- Real-time locker inventory reflecting active parcel assignments.
- Permitted roles (Admin & Security) can update locker availability or set maintenance status (`PATCH /api/lockers/{id}/status`).

## 4. Test & Demo Accounts

Use these pre-seeded accounts to test roles and verification:

| Role | Email | Password | Allowed Capabilities |
|---|---|---|---|
| **Admin** | `aarav.admin@example.com` | `password123` | Full access (manage users, parcels, lockers, incidents, pickup) |
| **Security** | `meera.security@example.com` | `password123` | Monitor parcels & lockers, report/view incidents, desk handovers |
| **Courier** | `kiran.courier@example.com` | `password123` | View assigned deliveries, view lockers |
| **Employee** | `ananya.employee@example.com` | `password123` | View own parcels, self-service pickup for own parcels |
| **Inactive (Blocked)** | `rohan.inactive@example.com` | `password123` | **Blocked:** Login fails with `403 Forbidden: Account is inactive` |

*(On `login.html`, click any of the demo account pills to instantly auto-fill credentials).*

## 5. API Endpoints & RBAC Matrix

| Method | Endpoint | RBAC Allowed Roles | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Authenticate user against MySQL and issue token |
| POST | `/api/auth/logout` | Authenticated | Invalidate/log out current session |
| GET | `/api/auth/me` | Authenticated | Retrieve profile and permissions of current user |
| GET | `/api/users` | `admin` | Retrieve all user accounts (403 for other roles) |
| GET | `/api/parcels` | All active authenticated | Retrieve parcels (scoped to own parcels for Employee, assigned for Courier) |
| POST | `/api/parcels/{id}/pickup` | `admin`, `security`, `employee` | Execute pickup workflow: updates status, records timestamp & frees locker |
| GET | `/api/lockers` | All active authenticated | Retrieve smart locker inventory and statuses |
| PATCH | `/api/lockers/{id}/status` | `admin`, `security` | Update locker operational status (available/maintenance) |
| GET | `/api/incidents` | `admin`, `security` | Retrieve incident reports from MongoDB (403 for others) |
| POST | `/api/incidents` | `admin`, `security` | Report parcel incident in MongoDB after MySQL validation |

## 6. Running the Application

1. **Start MySQL and MongoDB:**
   Ensure MySQL is running on port 3306 and MongoDB on port 27017.
2. **Import SQL Seed Data:**
   Run scripts in `db/` (e.g. `01_create_database.sql` through `09_seed_deliveries.sql`, `21_pickup_workflow.sql`).
3. **Start the Backend:**
   ```bash
   cd backend
   uvicorn main:app --reload
   ```
4. **Access the Application:**
   Open `frontend/login.html` (e.g. via VS Code Live Server at `http://127.0.0.1:5500/frontend/login.html`).
   Sign in with any of the demo accounts listed above.
5. **Interactive Swagger API Docs:**
   Open `http://127.0.0.1:8000/docs`. Click **Authorize** at the top right to paste a Bearer token or test login.
