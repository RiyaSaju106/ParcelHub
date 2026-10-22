# ParcelHub NoSQL Module

ParcelHub uses MongoDB to store flexible parcel incident reports.
MySQL remains the source of truth for users, parcels, and lockers.

## Incident fields
- parcel_tracking_code
- incident_type
- description
- reported_by
- severity
- status
- created_at

## Run
Ensure MongoDB is running and configure MONGO_URI in backend/.env.
The FastAPI backend will expose endpoints for creating and viewing incidents.
