
USE parcelhub;

SELECT
    p.tracking_code,
    p.parcel_status,
    l.locker_code,
    l.locker_status,
    la.assigned_at,
    la.released_at
FROM locker_assignments AS la
JOIN parcels AS p
    ON la.parcel_id = p.parcel_id
JOIN lockers AS l
    ON la.locker_id = l.locker_id
WHERE la.parcel_id = 1
ORDER BY la.assignment_id;
