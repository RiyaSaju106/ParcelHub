
USE parcelhub;

INSERT INTO users
    (full_name, email, password_hash, role, account_status)
VALUES
    ('Aarav Sharma', 'aarav.admin@example.com', 'DEMO_HASH_ADMIN', 'admin', 'active'),
    ('Meera Nair', 'meera.security@example.com', 'DEMO_HASH_SECURITY', 'security', 'active'),
    ('Kiran Rao', 'kiran.courier@example.com', 'DEMO_HASH_COURIER', 'courier', 'active'),
    ('Ananya Iyer', 'ananya.employee@example.com', 'DEMO_HASH_EMPLOYEE', 'employee', 'active'),
    ('Rohan Verma', 'rohan.inactive@example.com', 'DEMO_HASH_INACTIVE', 'employee', 'inactive');

SELECT user_id, full_name, email, role, account_status
FROM users;
