
USE parcelhub;

CREATE INDEX idx_parcels_status
ON parcels(parcel_status);

CREATE INDEX idx_deliveries_status
ON deliveries(delivery_status);

CREATE INDEX idx_assignments_locker_release
ON locker_assignments(locker_id, released_at);
