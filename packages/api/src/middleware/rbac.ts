// Enhanced Role-Based Access Control
// Maps 5 enterprise roles with a permission matrix

export const ROLES = {
  ADMIN: 'admin',
  ANALYST: 'analyst',
  INVESTOR: 'investor',
  PM: 'pm',
  AUDITOR: 'auditor',
} as const;

// Legacy role mapping
export const LEGACY_ROLE_MAP: Record<string, string> = {
  'lead-investor': ROLES.ADMIN,
  'co-investor': ROLES.INVESTOR,
  'operator': ROLES.PM,
  'viewer': ROLES.AUDITOR,
};

export type Permission =
  | 'deals.read' | 'deals.write' | 'deals.delete'
  | 'assumptions.read' | 'assumptions.write'
  | 'engines.run' | 'engines.read'
  | 'construction.read' | 'construction.write'
  | 'risks.read' | 'risks.write'
  | 'audit.read'
  | 'alerts.read' | 'alerts.write'
  | 'recommendations.read'
  | 'admin.users' | 'admin.settings';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [ROLES.ADMIN]: [
    'deals.read', 'deals.write', 'deals.delete',
    'assumptions.read', 'assumptions.write',
    'engines.run', 'engines.read',
    'construction.read', 'construction.write',
    'risks.read', 'risks.write',
    'audit.read', 'alerts.read', 'alerts.write',
    'recommendations.read',
    'admin.users', 'admin.settings',
  ],
  [ROLES.ANALYST]: [
    'deals.read', 'deals.write',
    'assumptions.read', 'assumptions.write',
    'engines.run', 'engines.read',
    'construction.read',
    'risks.read', 'risks.write',
    'audit.read', 'alerts.read',
    'recommendations.read',
  ],
  [ROLES.INVESTOR]: [
    'deals.read',
    'assumptions.read',
    'engines.read',
    'construction.read',
    'risks.read',
    'alerts.read',
    'recommendations.read',
  ],
  [ROLES.PM]: [
    'deals.read',
    'assumptions.read',
    'engines.read',
    'construction.read', 'construction.write',
    'risks.read', 'risks.write',
    'alerts.read', 'alerts.write',
    'recommendations.read',
  ],
  [ROLES.AUDITOR]: [
    'deals.read',
    'assumptions.read',
    'engines.read',
    'construction.read',
    'risks.read',
    'audit.read',
    'alerts.read',
    'recommendations.read',
  ],
};

export function resolveRole(role: string): string {
  return LEGACY_ROLE_MAP[role] ?? role;
}

export function hasPermission(role: string, permission: Permission): boolean {
  const resolved = resolveRole(role);
  return ROLE_PERMISSIONS[resolved]?.includes(permission) ?? false;
}

export function requirePermission(permission: Permission) {
  return async (req: any, reply: any) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Not authenticated' });
    if (!hasPermission(user.role, permission)) {
      return reply.code(403).send({ error: `Permission denied: ${permission}` });
    }
  };
}
