/**
 * ─── RoleGate Component ───────────────────────────────────────────────
 * Conditionally renders children based on user role.
 * Uses auth context to check current user role.
 * Shows fallback (or nothing) if role not in allowed list.
 */

import React, { useContext, useMemo } from 'react';

/**
 * Auth context type (customize based on your actual auth implementation)
 */
interface AuthContextType {
  user?: {
    id: string;
    email: string;
    role: string;
  } | null;
  isAuthenticated: boolean;
}

/**
 * Create auth context (consumers should provide via context provider)
 */
export const AuthContext = React.createContext<AuthContextType | null>(null);

interface RoleGateProps {
  allowed: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Hook to use auth context
 */
function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider. Wrap your component tree with <AuthProvider>'
    );
  }
  return context;
}

/**
 * RoleGate: conditionally renders children based on user role
 */
export const RoleGate: React.FC<RoleGateProps> = ({
  allowed,
  children,
  fallback = null,
}) => {
  const auth = useAuth();

  const isAuthorized = useMemo(() => {
    if (!auth.isAuthenticated || !auth.user) {
      return false;
    }

    // Check if user's role is in the allowed list
    return allowed.includes(auth.user.role);
  }, [auth.isAuthenticated, auth.user, allowed]);

  if (isAuthorized) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
};

/**
 * AuthProvider: wraps app to provide auth context
 */
interface AuthProviderProps {
  user?: {
    id: string;
    email: string;
    role: string;
  } | null;
  isAuthenticated: boolean;
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  user = null,
  isAuthenticated = false,
  children,
}) => {
  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

/**
 * Export hook for internal use
 */
export { useAuth };
