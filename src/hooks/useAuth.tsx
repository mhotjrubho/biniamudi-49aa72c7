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
      setRole((roleRes.data as AppRole) || null);
      setProfile((profileRes.data as Profile) || null);
    } catch (error) {
      console.error("Error fetching user data:", error);
      // Clear data on error to prevent inconsistent state
      setRole(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchUserData(initialSession.user.id);
        }
      } catch (error) {
        console.error("Error initializing session:", error);
      } finally {
        setLoading(false);
      }
    };
    
    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setLoading(true);
        setSession(newSession);
        const newUser = newSession?.user ?? null;
        setUser(newUser);
        if (newUser) {
          await fetchUserData(newUser.id);
        } else {
          setRole(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchUserData]);
  
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
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
