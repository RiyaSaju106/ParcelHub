
USE parcelhub;

CREATE OR REPLACE VIEW parcel_recipient_view AS
SELECT
    p.parcel_id,
    p.tracking_code,
    p.description,
    p.parcel_status,
    u.full_name AS recipient_name,
    u.email AS recipient_email
FROM parcels AS p
JOIN users AS u
    ON p.recipient_user_id = u.user_id;
