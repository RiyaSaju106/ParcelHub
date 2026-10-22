
USE parcelhub;

DROP TRIGGER IF EXISTS trg_locker_assignment_insert;
DROP TRIGGER IF EXISTS trg_locker_assignment_release;

DELIMITER //

CREATE TRIGGER trg_locker_assignment_insert
BEFORE INSERT ON locker_assignments
FOR EACH ROW
BEGIN
    DECLARE current_status VARCHAR(20);

    SELECT locker_status
    INTO current_status
    FROM lockers
    WHERE locker_id = NEW.locker_id;

    IF current_status IS NULL OR current_status <> 'available' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Locker is not available';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM locker_assignments
        WHERE parcel_id = NEW.parcel_id
          AND released_at IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Parcel already has an active locker assignment';
    END IF;
END//

CREATE TRIGGER trg_locker_assignment_after_insert
AFTER INSERT ON locker_assignments
FOR EACH ROW
BEGIN
    UPDATE lockers
    SET locker_status = 'occupied'
    WHERE locker_id = NEW.locker_id;

    UPDATE parcels
    SET parcel_status = 'stored'
    WHERE parcel_id = NEW.parcel_id;
END//

CREATE TRIGGER trg_locker_assignment_release
AFTER UPDATE ON locker_assignments
FOR EACH ROW
BEGIN
    IF OLD.released_at IS NULL AND NEW.released_at IS NOT NULL THEN
        UPDATE lockers
        SET locker_status = 'available'
        WHERE locker_id = OLD.locker_id;

        UPDATE parcels
        SET parcel_status = 'ready_for_pickup'
        WHERE parcel_id = OLD.parcel_id;
    END IF;
END//

DELIMITER ;
