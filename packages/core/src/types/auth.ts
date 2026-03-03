// ─── Authentication and Authorization Types ───────────────────────
export type UserRole = 'lead-investor' | 'co-investor' | 'operator' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthToken {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const ROLE_PERMISSIONS = {
  'lead-investor': {
    canEdit: true,
    canRecompute: true,
    canApprove: true,
    canManageConstruction: true,
    canViewAllDeals: true,
  },
  'co-investor': {
    canEdit: true,
    canRecompute: true,
    canApprove: false,
    canManageConstruction: false,
    canViewAllDeals: true,
  },
  'operator': {
    canEdit: true,
    canRecompute: true,
    canApprove: false,
    canManageConstruction: true,
    canViewAllDeals: true,
  },
  'viewer': {
    canEdit: false,
    canRecompute: false,
    canApprove: false,
    canManageConstruction: false,
    canViewAllDeals: true,
  },
} as const;

export type RolePermissions = typeof ROLE_PERMISSIONS[UserRole];
