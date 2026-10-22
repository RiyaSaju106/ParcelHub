
USE parcelhub;

START TRANSACTION;

UPDATE lockers
SET locker_status = 'available'
WHERE locker_id = 4;

UPDATE parcels
SET parcel_status = 'received'
WHERE parcel_id = 1;

ROLLBACK;

SELECT locker_id, locker_status
FROM lockers
WHERE locker_id = 4;

SELECT parcel_id, parcel_status
FROM parcels
WHERE parcel_id = 1;
