
USE parcelhub;

-- Query 1: Count parcels by status
SELECT
    parcel_status,
    COUNT(*) AS total_parcels
FROM parcels
GROUP BY parcel_status;

-- Query 2: Count lockers by status
SELECT
    locker_status,
    COUNT(*) AS total_lockers
FROM lockers
GROUP BY locker_status;

-- Query 3: Count deliveries handled by each courier
SELECT
    u.full_name AS courier_name,
    COUNT(d.delivery_id) AS total_deliveries
FROM users AS u
LEFT JOIN deliveries AS d
    ON u.user_id = d.courier_user_id
WHERE u.role = 'courier'
GROUP BY u.user_id, u.full_name;
