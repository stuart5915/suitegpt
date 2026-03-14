-- Fix: defiunknownking changed X handle to abhiontwt
-- Update across all tables that store x_handle

UPDATE user_apps
SET creator_x_handle = 'abhiontwt', updated_at = now()
WHERE LOWER(creator_x_handle) = 'defiunknownking';

UPDATE human_profiles
SET x_handle = 'abhiontwt', updated_at = now()
WHERE LOWER(x_handle) = 'defiunknownking';

UPDATE inclawbator_projects
SET x_handle = 'abhiontwt', updated_at = now()
WHERE LOWER(x_handle) = 'defiunknownking';

UPDATE projects
SET x_handle = 'abhiontwt', updated_at = now()
WHERE LOWER(x_handle) = 'defiunknownking';

UPDATE inclawbate_ubi_contributions
SET x_handle = 'abhiontwt'
WHERE LOWER(x_handle) = 'defiunknownking';
