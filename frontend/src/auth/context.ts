import { createContext } from "react";
import type { Me, RegisterPayload } from "../api/types";

export interface AuthState {
  user: Me | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);