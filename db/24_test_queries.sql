
USE parcelhub;

SHOW TABLES;

SELECT COUNT(*) AS total_users FROM users;
SELECT COUNT(*) AS total_lockers FROM lockers;
SELECT COUNT(*) AS total_parcels FROM parcels;
SELECT COUNT(*) AS total_assignments FROM locker_assignments;
SELECT COUNT(*) AS total_deliveries FROM deliveries;

SELECT * FROM parcel_recipient_view;

SHOW INDEX FROM parcels;
SHOW TRIGGERS;
SHOW PROCEDURE STATUS
WHERE Db = 'parcelhub';
SHOW FUNCTION STATUS
WHERE Db = 'parcelhub';
