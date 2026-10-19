import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { api, setUnauthorizedHandler } from "@/api/client";
import { fetchMe } from "@/api/hooks";
import type { Token, UserOut } from "@/api/types";

import { clearToken, getToken, setToken } from "./storage";

type AuthStatus = "checking" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: UserOut | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    getToken() ? "checking" : "anonymous",
  );
  const [user, setUser] = useState<UserOut | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const endSession = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus("anonymous");
    // Drop cached server state so the next account never sees the last one's data.
    queryClient.clear();
  }, [queryClient]);

  // The axios interceptor fires this when the API rejects a live session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      endSession();
      navigate("/login", { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession, navigate]);

  /*
   * Session restore on load.
   *
   * A token in localStorage is not proof of a usable session -- it may have
   * expired, or been signed with a key the server no longer uses. So the app
   * stays in "checking" until GET /auth/me confirms it, which also gives us the
   * user's name for the top bar.
   */
  useEffect(() => {
    if (!getToken()) return;

    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // The backend uses OAuth2PasswordRequestForm, so this is form-encoded and
    // the email travels in the `username` field.
    const body = new URLSearchParams({ username: email, password });
    const { data } = await api.post<Token>("/auth/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    setToken(data.access_token);
    const me = await fetchMe();
    setUser(me);
    setStatus("authenticated");
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      await api.post("/auth/register", {
        email,
        password,
        full_name: fullName,
      });
      // Registration does not return a token, so sign in straight away rather
      // than making the user type their password a second time.
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    endSession();
    navigate("/login", { replace: true });
  }, [endSession, navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
