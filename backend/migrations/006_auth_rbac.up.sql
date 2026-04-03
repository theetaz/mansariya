-- Mansariya: Auth identity, roles, permissions, and RBAC
-- THE-113: Identity schema, roles, permissions, and bootstrap admin

-- ============ ROLES ============

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,                    -- 'super_admin', 'editor', 'map_contributor'
    name TEXT NOT NULL,                            -- Human-readable display name
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,              -- System roles cannot be deleted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ PERMISSIONS ============

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,                    -- 'routes.create', 'routes.edit', 'stops.delete'
    name TEXT NOT NULL,                            -- Human-readable display name
    family TEXT NOT NULL,                          -- Grouping: 'routes', 'stops', 'timetables', etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permissions_family ON permissions(family);

-- ============ ROLE-PERMISSION MAPPING ============

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============ USERS ============

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,                            -- NULL for invited users who haven't set password
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
    invite_token TEXT,                             -- One-time token for accepting invite
    invite_expires_at TIMESTAMPTZ,
    password_reset_token TEXT,
    password_reset_expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE UNIQUE INDEX idx_users_invite_token ON users(invite_token) WHERE invite_token IS NOT NULL;
CREATE UNIQUE INDEX idx_users_password_reset_token ON users(password_reset_token) WHERE password_reset_token IS NOT NULL;

-- ============ USER-ROLE MAPPING ============

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

-- ============ SEED DEFAULT ROLES ============

INSERT INTO roles (slug, name, description, is_system) VALUES
    ('super_admin', 'Super Admin', 'Full platform access — can manage users, roles, and all data', TRUE),
    ('editor', 'Editor', 'Can manage routes, stops, timetables, and operational data', TRUE),
    ('map_contributor', 'Map Contributor', 'Can edit route polylines, stop locations, and map data', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============ SEED PERMISSIONS ============

INSERT INTO permissions (slug, name, family) VALUES
    -- Routes
    ('routes.view',       'View routes',           'routes'),
    ('routes.create',     'Create routes',         'routes'),
    ('routes.edit',       'Edit routes',           'routes'),
    ('routes.delete',     'Delete routes',         'routes'),
    ('routes.activate',   'Activate/deactivate routes', 'routes'),
    -- Stops
    ('stops.view',        'View stops',            'stops'),
    ('stops.create',      'Create stops',          'stops'),
    ('stops.edit',        'Edit stops',            'stops'),
    ('stops.delete',      'Delete stops',          'stops'),
    -- Timetables
    ('timetables.view',   'View timetables',       'timetables'),
    ('timetables.edit',   'Edit timetables',       'timetables'),
    -- Polylines / map data
    ('map.edit_polyline', 'Edit route polylines',  'map'),
    ('map.edit_stops',    'Edit stop locations',   'map'),
    -- Simulations
    ('simulations.view',  'View simulations',      'simulations'),
    ('simulations.manage','Manage simulations',    'simulations'),
    -- Import/Export
    ('data.import',       'Import data',           'data'),
    ('data.export',       'Export data',            'data'),
    -- User management
    ('users.view',        'View users',            'users'),
    ('users.manage',      'Manage users and roles','users'),
    -- System
    ('system.health',     'View system health',    'system'),
    ('system.settings',   'Manage system settings','system')
ON CONFLICT (slug) DO NOTHING;

-- ============ ASSIGN PERMISSIONS TO ROLES ============

-- super_admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'super_admin'
ON CONFLICT DO NOTHING;

-- editor gets everything except user management and system settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'editor'
  AND p.slug NOT IN ('users.manage', 'system.settings')
ON CONFLICT DO NOTHING;

-- map_contributor gets view + map editing permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'map_contributor'
  AND p.slug IN (
    'routes.view', 'stops.view', 'timetables.view',
    'map.edit_polyline', 'map.edit_stops',
    'system.health'
  )
ON CONFLICT DO NOTHING;
