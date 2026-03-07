// ─── Role-Based Permission Hooks ────────────────────────────────────
'use client';

import { useAuth } from '../lib/auth-context';
import type { UserRole } from '@v3grand/core';

const ROLE_PERMISSIONS: Record<string, {
  canEdit: boolean;
  canRecompute: boolean;
  canApprove: boolean;
  canManageConstruction: boolean;
  canCreateCO: boolean;
  canCreateRFI: boolean;
}> = {
  'lead-investor': {
    canEdit: true,
    canRecompute: true,
    canApprove: true,
    canManageConstruction: true,
    canCreateCO: true,
    canCreateRFI: true,
  },
  'co-investor': {
    canEdit: true,
    canRecompute: true,
    canApprove: false,
    canManageConstruction: false,
    canCreateCO: false,
    canCreateRFI: false,
  },
  'operator': {
    canEdit: true,
    canRecompute: true,
    canApprove: false,
    canManageConstruction: true,
    canCreateCO: true,
    canCreateRFI: true,
  },
  'viewer': {
    canEdit: false,
    canRecompute: false,
    canApprove: false,
    canManageConstruction: false,
    canCreateCO: false,
    canCreateRFI: false,
  },
};

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const perms = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['viewer'];

  return {
    role,
    ...perms,
    isAuthenticated: !!user,
  };
}
