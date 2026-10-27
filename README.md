# ParcelHub — Smart Parcel & Locker Management System

## 1. Project Overview

ParcelHub is a smart parcel and locker management system designed for modern tech parks. It helps manage incoming parcels, track recipient information, monitor smart locker availability, record parcel-related incidents, enforce role-based access control (RBAC), and manage the full parcel pickup lifecycle.

The application provides a web interface connected to a backend API and database systems.

## 2. Technology Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla JS with interactive RBAC switcher)
- **Backend:** Python, FastAPI
- **Relational Database:** MySQL
- **NoSQL Database:** MongoDB
- **API Documentation and Testing:** FastAPI Swagger UI

## 3. Main Features

### Dashboard
Displays an overview of parcel activity and locker inventory, including total parcels, parcels ready for pickup, total lockers, and available lockers.

### Parcel Management & Pickup Workflow
Displays parcel tracking codes, descriptions, recipient information, assigned smart lockers, parcel status, and timestamps.
- **Parcel Pickup Execution:** Authenticated users (Recipients/Employees, Admin, Security) can trigger parcel pickup.
- When picked up, the system:
  1. Updates `parcel_status` to `picked_up`.
  2. Updates `picked_up_at` timestamp.
  3. Updates delivery status to `picked_up` and logs `picked_up_at`.
  4. Releases the associated locker assignment (`released_at` set to current timestamp).
  5. Sets the associated locker status back to `available` so it can immediately be reused.
  6. Executes atomically within a database transaction.

### Role-Based Access Control (RBAC)
Enforces granular access permissions across 4 distinct roles:
- **Admin:** Full access across all modules (Users, Parcels, Lockers, Incidents, Pickup).
- **Security:** Access to Parcels, Lockers, Incident reporting/viewing, and desk parcel handover pickups. Forbidden from accessing User accounts.
- **Courier:** Access to Parcels and Locker statuses for drop-off operations. Forbidden from incident management and customer pickups.
- **Employee (Recipient):** Access to view their assigned parcels and execute self-service pickup for their own parcels. Forbidden from incident management and user management.

Authentication and role headers supported:
- `X-User-Role`: `admin`, `security`, `courier`, `employee`
- `X-User-Email`: e.g. `aarav.admin@example.com`
- `Authorization`: `Bearer <role>` or `Bearer <email>`
- In demo/testing environments, query parameters `?role=` and `?email=` can also be used directly in browser/curl.

### Smart Locker Management
Displays locker codes, locations, sizes, and current statuses (available, occupied, maintenance). Real-time status reflects active assignments and automatic release on pickup.

### Incident Management
Allows parcel-related incidents to be recorded and retrieved. Restricted to **Admin** and **Security** roles via RBAC. Incident creation validates parcel tracking codes against MySQL before saving in MongoDB.

## 4. Database Design

### MySQL
Stores structured application data, including users, parcels, locker assignments, and smart lockers. Includes triggers and stored procedures (`db/21_pickup_workflow.sql`, `db/22_validate_assignments.sql`).

### MongoDB
Stores parcel incident reports in the `incidents` collection. MongoDB indexes support searches by parcel tracking code and incident status with creation time.

## 5. Project Structure

```text
ParcelHub-FINAL/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── db/
│   ├── 01_create_database.sql
│   ├── 02_create_tables.sql
│   ├── 03_constraints_indexes.sql
│   ├── 04_seed_data.sql
│   ├── 05_seed_lockers.sql
│   ├── 06_seed_parcels.sql
│   ├── 07_join_queries.sql
│   ├── 08_seed_assignments.sql
│   ├── 09_seed_deliveries.sql
│   ├── 10_advanced_queries.sql
│   ├── 18_stored_procedures.sql
│   ├── 21_pickup_workflow.sql
│   ├── 22_validate_assignments.sql
│   └── ...
├── frontend/
│   ├── index.html
│   ├── parcels.html
│   ├── lockers.html
│   ├── incidents.html
│   ├── app.js
│   └── style.css
├── nosql/
│   ├── collection.js
│   ├── indexes.js
│   ├── README.md
│   └── sample_incidents.json
└── README.md
```

## 6. Running the Application

1. Configure the required database connection settings in `backend/.env`.
2. Start MySQL and MongoDB.
3. Import the SQL scripts in `db/` (e.g., `01_create_database.sql` through `09_seed_deliveries.sql`, `21_pickup_workflow.sql`).
4. Install the Python dependencies: `pip install -r backend/requirements.txt`.
5. Start the FastAPI backend: `uvicorn main:app --reload` from the `backend/` directory.
6. Open `http://127.0.0.1:8000/docs` to access Swagger UI.
7. Open `frontend/index.html` (e.g. via VS Code Live Server at `http://127.0.0.1:5500`).
8. Use the **Role Selector** in the navigation bar to easily switch between Admin, Security, Courier, and Employee roles in the live demo.

## 7. API Endpoints

| Method | Endpoint | RBAC Allowed Roles | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Check API and MySQL connectivity |
| POST | `/api/auth/login` | Public | Authenticate user email and retrieve role |
| GET | `/api/auth/me` | Authenticated | Retrieve profile and permissions of current user |
| GET | `/api/users` | `admin` | Retrieve all users |
| GET | `/api/parcels` | `admin`, `security`, `courier`, `employee` | Retrieve parcels (filtered by recipient for Employee role) |
| POST | `/api/parcels/{parcel_id}/pickup` | `admin`, `security`, `employee` | Execute pickup workflow: updates status, timestamp & releases locker |
| GET | `/api/lockers` | All authenticated roles | Retrieve smart lockers and availability |
| GET | `/api/incidents` | `admin`, `security` | Retrieve incident reports |
| GET | `/api/incidents/{incident_id}` | `admin`, `security` | Retrieve a specific incident |
| POST | `/api/incidents` | `admin`, `security` | Create an incident after validating tracking code |

## 8. Role-Based Access Control (RBAC) Matrix

| Endpoint | Admin | Security | Courier | Employee |
|---|:---:|:---:|:---:|:---:|
| `GET /api/users` | Allowed | Forbidden (403) | Forbidden (403) | Forbidden (403) |
| `GET /api/parcels` | All Parcels | All Parcels | All Parcels | Own Parcels |
| `POST /api/parcels/{id}/pickup` | Allowed | Allowed | Forbidden (403) | Own Parcels |
| `GET /api/lockers` | Allowed | Allowed | Allowed | Allowed |
| `GET /api/incidents` | Allowed | Allowed | Forbidden (403) | Forbidden (403) |
| `POST /api/incidents` | Allowed | Allowed | Forbidden (403) | Forbidden (403) |

## 9. Testing & Demo Instructions

- **Testing RBAC in Swagger UI:**
  - Enter `admin` in `X-User-Role` to access `/api/users` (returns `200 OK`).
  - Enter `courier` in `X-User-Role` to call `/api/users` or `/api/incidents` (returns `403 Forbidden`).
- **Testing Parcel Pickup in Swagger UI:**
  - Send `POST /api/parcels/3/pickup` with `X-User-Role: admin`.
  - Check response: status is updated to `picked_up`, timestamp is recorded, and locker assignment is released with locker code returned as available.
  - Re-run the same request: returns `400 Bad Request` ("Parcel has already been picked up").
- **Testing in Frontend UI:**
  - Use the navigation bar role switcher to switch roles on the fly.
  - Switch to **Employee (Ananya)**: only her parcels are displayed.
  - Click **Pick Up 📦** on an eligible parcel: the status immediately changes to green `picked up`, the locker tag is released, and locker inventory increments available lockers.
  - Navigate to **Incidents** while in Employee or Courier role: the system shows a clean RBAC access restriction notice. Switch to Security to report an incident.
