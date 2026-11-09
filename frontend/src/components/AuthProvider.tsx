import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchSession,
  login as apiLogin,
  logout as apiLogout,
} from "../api/auth";
import type { AuthSession } from "../api/auth";
import { AUTH_UNAUTHORIZED_EVENT } from "../api/client";

interface AuthContextValue {
  user: AuthSession | null;
  loading: boolean;
  sessionExpired: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    fetchSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setSessionExpired(true);
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [queryClient]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const session = await apiLogin(username, password);
      queryClient.clear();
      setSessionExpired(false);
      setUser(session);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // The UI must still sign out locally if the server is unreachable.
    } finally {
      queryClient.clear();
      setSessionExpired(false);
      setUser(null);
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, sessionExpired, signIn, signOut }),
    [user, loading, sessionExpired, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
