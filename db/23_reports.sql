
USE parcelhub;

SELECT
    p.parcel_status,
    COUNT(*) AS total_parcels
FROM parcels AS p
GROUP BY p.parcel_status
ORDER BY total_parcels DESC;

SELECT
    l.locker_status,
    COUNT(*) AS total_lockers
FROM lockers AS l
GROUP BY l.locker_status
ORDER BY total_lockers DESC;

SELECT
    u.full_name AS recipient_name,
    COUNT(p.parcel_id) AS total_parcels
FROM users AS u
LEFT JOIN parcels AS p
    ON p.recipient_user_id = u.user_id
GROUP BY u.user_id, u.full_name
ORDER BY total_parcels DESC, u.full_name;

SELECT
    l.locker_code,
    l.location,
    l.locker_size
FROM lockers AS l
WHERE l.locker_status = 'available'
ORDER BY l.location, l.locker_code;
