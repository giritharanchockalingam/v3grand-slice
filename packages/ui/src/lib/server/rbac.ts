/**
 * RBAC enforcement for API route handlers.
 * Maps roles to permissions and provides middleware helpers.
 */

export type Role = 'admin' | 'lead-investor' | 'co-investor' | 'operator' | 'analyst' | 'auditor' | 'viewer';

export type Permission =
  | 'deals:read' | 'deals:write' | 'deals:delete'
  | 'risks:read' | 'risks:write'
  | 'engine:run' | 'engine:read'
  | 'agents:chat' | 'agents:read'
  | 'audit:read' | 'audit:write'
  | 'construction:read' | 'construction:write'
  | 'assumptions:read' | 'assumptions:write'
  | 'invest:analyze'
  | 'admin:manage';

/** Permission matrix: role → set of allowed permissions */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'deals:read', 'deals:write', 'deals:delete',
    'risks:read', 'risks:write',
    'engine:run', 'engine:read',
    'agents:chat', 'agents:read',
    'audit:read', 'audit:write',
    'construction:read', 'construction:write',
    'assumptions:read', 'assumptions:write',
    'invest:analyze',
    'admin:manage',
  ],
  'lead-investor': [
    'deals:read', 'deals:write',
    'risks:read', 'risks:write',
    'engine:run', 'engine:read',
    'agents:chat', 'agents:read',
    'audit:read',
    'construction:read', 'construction:write',
    'assumptions:read', 'assumptions:write',
    'invest:analyze',
  ],
  'co-investor': [
    'deals:read',
    'risks:read',
    'engine:read',
    'agents:chat', 'agents:read',
    'audit:read',
    'construction:read',
    'assumptions:read',
    'invest:analyze',
  ],
  operator: [
    'deals:read',
    'risks:read', 'risks:write',
    'engine:run', 'engine:read',
    'agents:chat', 'agents:read',
    'construction:read', 'construction:write',
    'assumptions:read', 'assumptions:write',
  ],
  analyst: [
    'deals:read',
    'risks:read',
    'engine:read',
    'agents:chat', 'agents:read',
    'audit:read',
    'assumptions:read',
    'invest:analyze',
  ],
  auditor: [
    'deals:read',
    'risks:read',
    'engine:read',
    'agents:read',
    'audit:read', 'audit:write',
    'construction:read',
    'assumptions:read',
  ],
  viewer: [
    'deals:read',
    'engine:read',
    'agents:read',
    'audit:read',
  ],
};

/** Check if a role has a specific permission */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Check if a role has ALL specified permissions */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/** Check if a role has ANY of the specified permissions */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Middleware: require a specific permission.
 * Returns a 403 NextResponse if unauthorized, or null if OK.
 */
export function requirePermission(
  userRole: string | undefined,
  permission: Permission
): { authorized: false; response: Response } | { authorized: true } {
  if (!userRole) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  if (!hasPermission(userRole as Role, permission)) {
    return {
      authorized: false,
      response: new Response(
        JSON.stringify({ error: 'Insufficient permissions', required: permission, role: userRole }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { authorized: true };
}
