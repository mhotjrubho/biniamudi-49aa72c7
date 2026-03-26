import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "community_manager" | "tiferet_david" | null;

interface Profile {
  id: string;
  display_name: string;
  email: string | null;
  community_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getAuthStorageKeys = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return [`sb-${projectId}-auth-token`, "supabase.auth.token"];
};

const clearPersistedSession = () => {
  if (typeof window === "undefined") return;

  for (const key of getAuthStorageKeys()) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const [roleRes, profileRes] = await Promise.all([
        supabase.rpc("get_user_role", { _user_id: userId }),
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
      ]);

      return {
        role: (roleRes.data as AppRole) || null,
        profile: (profileRes.data as Profile) || null,
      };
    } catch (error) {
      console.error("Error fetching user data:", error);
      return { role: null as AppRole, profile: null as Profile | null };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const userData = await fetchUserData(nextUser.id);
      if (!isMounted) return;

      setRole(userData.role);
      setProfile(userData.profile);
      setLoading(false);
    };

    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Error restoring session:", error);
        clearPersistedSession();
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!data.session) {
        clearPersistedSession();
      }

      void applySession(data.session ?? null);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    clearPersistedSession();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    clearPersistedSession();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
