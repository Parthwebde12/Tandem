import { useCallback, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch, tokenStore } from "../api/client";
import type { Me, RegisterPayload, TokenResponse } from "../api/types";
import { AuthContext, type AuthState } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => tokenStore.get() !== null);

  const fetchMe = useCallback(async (): Promise<Me> => {
    try {
      return await apiFetch<Me>("/auth/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        tokenStore.clear();
        setHasToken(false);
      }
      throw error;
    }
  }, []);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: hasToken,
    retry: false,
  });

  const startSession = useCallback(
    async (result: TokenResponse) => {
      tokenStore.set(result.access_token);
      setHasToken(true);
      await queryClient.fetchQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        staleTime: 0,
      });
    },
    [fetchMe, queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await startSession(result);
    },
    [startSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const result = await apiFetch<TokenResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await startSession(result);
    },
    [startSession],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setHasToken(false);
    queryClient.clear();
  }, [queryClient]);

  const value: AuthState = {
    user: hasToken ? (meQuery.data ?? null) : null,
    isLoading: hasToken && meQuery.isPending,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}