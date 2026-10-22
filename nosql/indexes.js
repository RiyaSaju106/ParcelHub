// Indexes for common incident searches.
// Run with mongosh against the ParcelHub database.

db = db.getSiblingDB("parcelhub");

db.incidents.createIndex({ parcel_tracking_code: 1 });
db.incidents.createIndex({ status: 1, created_at: -1 });
db.incidents.createIndex({ incident_type: 1, created_at: -1 });
