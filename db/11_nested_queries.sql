
USE parcelhub;

SELECT
    tracking_code,
    description,
    parcel_status
FROM parcels
WHERE recipient_user_id IN (
    SELECT user_id
    FROM users
    WHERE role = 'employee'
);
