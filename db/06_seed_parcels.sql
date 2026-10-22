
USE parcelhub;

INSERT INTO parcels
    (tracking_code, recipient_user_id, description, parcel_status)
VALUES
    ('PH-2026-0001', 4, 'Laptop accessories', 'received'),
    ('PH-2026-0002', 4, 'Books and stationery', 'stored'),
    ('PH-2026-0003', 1, 'Office documents', 'ready_for_pickup');

SELECT
    parcel_id,
    tracking_code,
    recipient_user_id,
    description,
    parcel_status,
    received_at
FROM parcels
ORDER BY parcel_id;
