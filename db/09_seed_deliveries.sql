
USE parcelhub;

INSERT INTO deliveries
    (parcel_id, courier_user_id, delivery_status)
VALUES
    (1, 3, 'received'),
    (2, 3, 'delivered'),
    (3, 3, 'delivered');

SELECT
    delivery_id,
    parcel_id,
    courier_user_id,
    delivery_status,
    received_at,
    delivered_at,
    picked_up_at
FROM deliveries
ORDER BY delivery_id;
