
USE parcelhub;

WITH parcel_counts AS (
    SELECT
        recipient_user_id,
        COUNT(*) AS total_parcels
    FROM parcels
    GROUP BY recipient_user_id
)
SELECT
    u.full_name,
    pc.total_parcels
FROM parcel_counts AS pc
JOIN users AS u
    ON pc.recipient_user_id = u.user_id
ORDER BY pc.total_parcels DESC, u.full_name;
