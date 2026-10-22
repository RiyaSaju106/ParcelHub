
USE parcelhub;

INSERT INTO locker_assignments (parcel_id, locker_id)
VALUES
    (2, 1),
    (3, 2);

UPDATE lockers
SET locker_status = 'occupied'
WHERE locker_id IN (1, 2);

SELECT
    la.assignment_id,
    p.tracking_code,
    l.locker_code,
    la.assigned_at,
    la.released_at
FROM locker_assignments AS la
INNER JOIN parcels AS p
    ON la.parcel_id = p.parcel_id
INNER JOIN lockers AS l
    ON la.locker_id = l.locker_id
ORDER BY la.assignment_id;
