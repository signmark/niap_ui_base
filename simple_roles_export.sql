-- Простой экспорт ролей и разрешений из старого Directus
-- Выполнить на старом сервере в PGAdmin

-- 1. Показать все роли
SELECT id, name, icon, description 
FROM directus_roles 
ORDER BY name;

-- 2. Показать разрешения для каждой роли
SELECT 
    r.name as role_name,
    p.collection,
    p.action,
    p.permissions,
    p.validation,
    p.fields
FROM directus_permissions p
JOIN directus_roles r ON p.role = r.id
ORDER BY r.name, p.collection, p.action;

-- 3. Показать пользователей с ролями
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    u.is_smm_admin,
    r.name as role_name,
    u.status
FROM directus_users u
LEFT JOIN directus_roles r ON u.role = r.id
WHERE u.email IN ('signmark@gmail.com', 'lbrspb@gmail.com')
ORDER BY u.email;

-- 4. Экспорт в формате CSV (скопируйте результаты)
COPY (
    SELECT 
        'ROLE' as type,
        id,
        name,
        COALESCE(icon, '') as icon,
        COALESCE(description, '') as description,
        '' as collection,
        '' as action,
        '' as permissions
    FROM directus_roles
    UNION ALL
    SELECT 
        'PERMISSION' as type,
        p.role,
        r.name,
        p.collection,
        p.action,
        p.collection,
        p.action,
        COALESCE(p.permissions::text, '')
    FROM directus_permissions p
    JOIN directus_roles r ON p.role = r.id
    ORDER BY type, name
) TO STDOUT WITH CSV HEADER;