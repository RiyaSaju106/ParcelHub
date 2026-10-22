
WITH RECURSIVE location_hierarchy AS (
    SELECT
        1 AS level_no,
        CAST('Tech Park' AS CHAR(50)) AS location_name

    UNION ALL

    SELECT
        level_no + 1,
        CASE level_no
            WHEN 1 THEN 'Tower A'
            WHEN 2 THEN 'Ground Floor'
        END
    FROM location_hierarchy
    WHERE level_no < 3
)
SELECT level_no, location_name
FROM location_hierarchy;
