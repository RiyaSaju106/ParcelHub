
USE parcelhub;

INSERT INTO lockers
    (locker_code, location, locker_size, locker_status)
VALUES
    ('BLR-A-001', 'Tower A - Ground Floor', 'small', 'available'),
    ('BLR-A-002', 'Tower A - Ground Floor', 'medium', 'available'),
    ('BLR-A-003', 'Tower A - Ground Floor', 'large', 'maintenance'),
    ('BLR-B-001', 'Tower B - First Floor', 'medium', 'available'),
    ('BLR-B-002', 'Tower B - First Floor', 'large', 'occupied');

SELECT * FROM lockers;
