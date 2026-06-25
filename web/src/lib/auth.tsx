import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onUnauthorized } from "./api";

interface AuthState {
  authed: boolean;
  setAuthed: (v: boolean) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "oja.authed";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Optimistically assume authed if we have an authed flag from a prior session;
  // any /api 401 immediately flips us to the login screen.
  const [authed, setAuthedState] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === "1",
  );

  const setAuthed = useCallback((v: boolean) => {
    setAuthedState(v);
    if (v) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    return onUnauthorized(() => setAuthed(false));
  }, [setAuthed]);

  return (
    <AuthContext.Provider value={{ authed, setAuthed }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
