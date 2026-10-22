
USE parcelhub;

INSERT INTO users
    (full_name, email, password_hash, role)
VALUES
    ('Aarav Sharma', 'aarav.admin@example.com', 'DEMO_HASH_ADMIN', 'admin'),
    ('Meera Nair', 'meera.security@example.com', 'DEMO_HASH_SECURITY', 'security'),
    ('Kiran Rao', 'kiran.courier@example.com', 'DEMO_HASH_COURIER', 'courier'),
    ('Ananya Iyer', 'ananya.employee@example.com', 'DEMO_HASH_EMPLOYEE', 'employee');

SELECT user_id, full_name, email, role, account_status
FROM users;
