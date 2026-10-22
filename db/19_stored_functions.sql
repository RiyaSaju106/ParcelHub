
USE parcelhub;

DROP FUNCTION IF EXISTS GetParcelCount;

DELIMITER //

CREATE FUNCTION GetParcelCount(p_user_id INT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE total INT;

    SELECT COUNT(*)
    INTO total
    FROM parcels
    WHERE recipient_user_id = p_user_id;

    RETURN total;
END//

DELIMITER ;
