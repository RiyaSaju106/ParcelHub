
USE parcelhub;

DROP PROCEDURE IF EXISTS GetParcelDeliveryHistory;

DELIMITER //

CREATE PROCEDURE GetParcelDeliveryHistory(
    IN p_parcel_id INT
)
BEGIN
    SELECT
        d.delivery_id,
        p.tracking_code,
        u.full_name AS courier_name,
        d.delivery_status,
        d.received_at,
        d.delivered_at,
        d.picked_up_at
    FROM deliveries AS d
    JOIN parcels AS p
        ON d.parcel_id = p.parcel_id
    JOIN users AS u
        ON d.courier_user_id = u.user_id
    WHERE d.parcel_id = p_parcel_id
    ORDER BY d.received_at;
END//

DELIMITER ;
