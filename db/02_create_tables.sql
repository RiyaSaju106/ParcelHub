
USE parcelhub;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'security', 'courier', 'employee') NOT NULL,
    account_status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lockers (
    locker_id INT AUTO_INCREMENT PRIMARY KEY,
    locker_code VARCHAR(20) NOT NULL UNIQUE,
    location VARCHAR(100) NOT NULL,
    locker_size ENUM('small', 'medium', 'large') NOT NULL,
    locker_status ENUM('available', 'occupied', 'maintenance')
        NOT NULL DEFAULT 'available',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parcels (
    parcel_id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_code VARCHAR(30) NOT NULL UNIQUE,
    recipient_user_id INT NOT NULL,
    description VARCHAR(255),
    parcel_status ENUM(
        'received',
        'stored',
        'ready_for_pickup',
        'picked_up',
        'returned'
    ) NOT NULL DEFAULT 'received',
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    picked_up_at TIMESTAMP NULL DEFAULT NULL,

    CONSTRAINT fk_parcels_recipient
        FOREIGN KEY (recipient_user_id)
        REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS locker_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    parcel_id INT NOT NULL,
    locker_id INT NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP NULL DEFAULT NULL,

    CONSTRAINT fk_assignment_parcel
        FOREIGN KEY (parcel_id)
        REFERENCES parcels(parcel_id),

    CONSTRAINT fk_assignment_locker
        FOREIGN KEY (locker_id)
        REFERENCES lockers(locker_id)
);

CREATE TABLE IF NOT EXISTS deliveries (
    delivery_id INT AUTO_INCREMENT PRIMARY KEY,
    parcel_id INT NOT NULL,
    courier_user_id INT NOT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP NULL DEFAULT NULL,
    picked_up_at TIMESTAMP NULL DEFAULT NULL,
    delivery_status ENUM(
        'received',
        'in_transit',
        'delivered',
        'picked_up',
        'failed'
    ) NOT NULL DEFAULT 'received',

    CONSTRAINT fk_delivery_parcel
        FOREIGN KEY (parcel_id)
        REFERENCES parcels(parcel_id),

    CONSTRAINT fk_delivery_courier
        FOREIGN KEY (courier_user_id)
        REFERENCES users(user_id)
);
