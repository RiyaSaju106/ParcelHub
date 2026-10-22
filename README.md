# ParcelHub — Smart Parcel & Locker Management System

## 1. Project Overview

ParcelHub is a smart parcel and locker management system designed for modern tech parks. It helps manage incoming parcels, track recipient information, monitor smart locker availability, and record parcel-related incidents.

The application provides a web interface connected to a backend API and database systems.

## 2. Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Python, FastAPI
- **Relational Database:** MySQL
- **NoSQL Database:** MongoDB
- **API Documentation and Testing:** FastAPI Swagger UI

## 3. Main Features

### Dashboard
Displays an overview of parcel activity and locker inventory, including total parcels, parcels ready for pickup, total lockers, and available lockers.

### Parcel Management
Displays parcel tracking codes, descriptions, recipient information, parcel status, and received timestamps. Users can search and inspect parcel records.

### Smart Locker Management
Displays locker codes, locations, sizes, and current statuses. Users can search and filter lockers by status.

### Incident Management
Allows parcel-related incidents to be recorded and retrieved. Incident records include the parcel tracking code, incident type, description, reporter, severity, status, and creation timestamp.

Incident creation validates the parcel tracking code against MySQL before saving the incident in MongoDB.

## 4. Database Design

### MySQL
Stores structured application data, including users, parcels, and smart lockers.

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
├── docs/
├── frontend/
│   ├── index.html
│   ├── parcels.html
│   ├── lockers.html
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

1. Configure the required database connection settings in the appropriate environment file.
2. Start MySQL and MongoDB.
3. Install the Python dependencies listed in `backend/requirements.txt`.
4. Start the FastAPI backend from the backend directory.
5. Open `http://127.0.0.1:8000/docs` to access the API documentation.
6. Open the frontend using the configured local web server.

Use the project's existing environment configuration and startup scripts where applicable. Do not commit `.env` files or credentials to GitHub.

## 7. API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check API and MySQL connectivity |
| GET | `/api/users` | Retrieve users |
| GET | `/api/parcels` | Retrieve parcels |
| GET | `/api/lockers` | Retrieve lockers |
| GET | `/api/incidents` | Retrieve incident reports |
| GET | `/api/incidents/{incident_id}` | Retrieve one incident |
| POST | `/api/incidents` | Create an incident after validating the parcel tracking code |

## 8. Testing

The following incident API tests have been performed manually through Swagger UI:

- Creating an incident for an existing parcel returned `201 Created`.
- Submitting a nonexistent parcel tracking code returned `404 Not Found`.
- Retrieving incident records returned `200 OK`.
- Retrieving a specific incident using its MongoDB ID returned `200 OK`.

These tests verify the basic incident API workflow; they do not constitute a complete system-wide test suite.

## 9. Planned Work

The following items remain separate project deliverables:

- Hand-drawn ER diagram showing entities and relationships.
- Hand-drawn relational schema showing keys, relationships, and constraints.
- Parcel pickup workflow that updates the parcel status, records the pickup timestamp, releases the corresponding locker assignment, and makes the locker available again.
