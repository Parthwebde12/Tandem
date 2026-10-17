import { useCallback, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch, tokenStore } from "../api/client";
import type { Me, TokenResponse } from "../api/types";
import { AuthContext, type AuthState } from "./context";

async function fetchMe(): Promise<Me> {
  try {
    return await apiFetch<Me>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      tokenStore.clear(); // expired or invalid token
    }
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => tokenStore.get() !== null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: hasToken,
    retry: false,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      tokenStore.set(result.access_token);
      setHasToken(true);
      await queryClient.fetchQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        staleTime: 0,
      });
    },
    [queryClient],
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
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}