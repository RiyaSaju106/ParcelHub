
USE parcelhub;

-- =====================================================================
-- Stored Procedure: ProcessParcelPickup
-- Workflow:
-- 1. Verifies that parcel exists and is not already picked up
-- 2. Sets parcel_status to 'picked_up' and records picked_up_at timestamp
-- 3. Updates delivery status to 'picked_up' and records picked_up_at
-- 4. Releases active locker assignment (sets released_at to CURRENT_TIMESTAMP)
-- 5. Restores locker status to 'available'
-- =====================================================================

DROP PROCEDURE IF EXISTS ProcessParcelPickup;

DELIMITER //

CREATE PROCEDURE ProcessParcelPickup(
    IN p_parcel_id INT,
    OUT p_status_code INT,
    OUT p_message VARCHAR(255),
    OUT p_released_locker_code VARCHAR(20)
)
proc_label: BEGIN
    DECLARE v_current_status VARCHAR(30);
    DECLARE v_locker_id INT DEFAULT NULL;
    DECLARE v_assignment_id INT DEFAULT NULL;
    DECLARE v_now TIMESTAMP;

    SET v_now = CURRENT_TIMESTAMP;
    SET p_released_locker_code = NULL;

    -- Check if parcel exists and retrieve its current status
    SELECT parcel_status
    INTO v_current_status
    FROM parcels
    WHERE parcel_id = p_parcel_id;

    IF v_current_status IS NULL THEN
        SET p_status_code = 404;
        SET p_message = 'Parcel not found';
        LEAVE proc_label;
    END IF;

    IF v_current_status = 'picked_up' THEN
        SET p_status_code = 400;
        SET p_message = 'Parcel has already been picked up';
        LEAVE proc_label;
    END IF;

    IF v_current_status = 'returned' THEN
        SET p_status_code = 400;
        SET p_message = 'Parcel is returned and cannot be picked up';
        LEAVE proc_label;
    END IF;

    START TRANSACTION;

    -- Find any active locker assignment
    SELECT assignment_id, locker_id
    INTO v_assignment_id, v_locker_id
    FROM locker_assignments
    WHERE parcel_id = p_parcel_id AND released_at IS NULL
    ORDER BY assignment_id DESC
    LIMIT 1;

    -- Release locker assignment if present
    IF v_assignment_id IS NOT NULL THEN
        UPDATE locker_assignments
        SET released_at = v_now
        WHERE assignment_id = v_assignment_id;

        UPDATE lockers
        SET locker_status = 'available'
        WHERE locker_id = v_locker_id;

        SELECT locker_code
        INTO p_released_locker_code
        FROM lockers
        WHERE locker_id = v_locker_id;
    END IF;

    -- Update parcel status and pickup timestamp
    UPDATE parcels
    SET parcel_status = 'picked_up',
        picked_up_at = v_now
    WHERE parcel_id = p_parcel_id;

    -- Update delivery status and pickup timestamp
    UPDATE deliveries
    SET delivery_status = 'picked_up',
        picked_up_at = v_now
    WHERE parcel_id = p_parcel_id;

    COMMIT;

    SET p_status_code = 200;
    IF p_released_locker_code IS NOT NULL THEN
        SET p_message = CONCAT('Parcel picked up successfully. Locker ', p_released_locker_code, ' is now available.');
    ELSE
        SET p_message = 'Parcel picked up successfully (no locker assigned).';
    END IF;
END//

DELIMITER ;
