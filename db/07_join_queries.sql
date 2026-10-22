
USE parcelhub;

SELECT
    p.tracking_code,
    p.description,
    u.full_name AS recipient_name,
    u.email AS recipient_email,
    p.parcel_status
FROM parcels AS p
INNER JOIN users AS u
    ON p.recipient_user_id = u.user_id
ORDER BY p.parcel_id;
