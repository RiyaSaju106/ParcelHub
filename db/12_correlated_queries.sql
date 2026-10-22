
USE parcelhub;

SELECT
    u.user_id,
    u.full_name,
    u.role
FROM users AS u
WHERE EXISTS (
    SELECT 1
    FROM parcels AS p
    WHERE p.recipient_user_id = u.user_id
);
