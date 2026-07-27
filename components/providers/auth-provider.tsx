"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { integrationContent } from "@/content/integracao";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { workspacesApi } from "@/lib/api/workspaces";
import type { FinancialWorkspace } from "@/types/acessos";
import type { AuthenticatedProfile } from "@/types/api";

type AuthContextValue = {
  user: AuthenticatedProfile | null;
  workspaces: FinancialWorkspace[];
  loading: boolean;
  error: string;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshWorkspaces: () => Promise<FinancialWorkspace[]>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshSession = useCallback(async () => {
    try {
      const profile = await authApi.me();
      setUser(profile);
      setError("");
    } catch (caught) {
      setUser(null);
      if (caught instanceof ApiError && caught.status === 401) setError("");
      else setError(caught instanceof Error ? caught.message : integrationContent.authenticationError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  async function login(email: string, password: string, remember: boolean) {
    const result = await authApi.login(email, password, remember);
    setUser(result.user);
    setError("");
  }

  async function register(name: string, email: string, password: string) {
    const result = await authApi.register(name, email, password);
    setUser(result.user);
    setError("");
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      window.location.replace("/login/");
    }
  }

  async function refreshWorkspaces() {
    const workspaces = await workspacesApi.list();
    setUser((current) => current ? { ...current, workspaces } : current);
    return workspaces;
  }

  const value: AuthContextValue = {
    user,
    workspaces: user?.workspaces ?? [],
    loading,
    error,
    login,
    register,
    logout,
    refreshSession,
    refreshWorkspaces,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
