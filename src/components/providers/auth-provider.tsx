"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useSession, signOut as nextAuthSignOut, SessionProvider } from "next-auth/react";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthInner({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const user = session?.user
    ? { id: session.user.id!, email: session.user.email! }
    : null;

  const profile: UserProfile | null = session?.user
    ? {
        id: session.user.id!,
        email: session.user.email!,
        display_name:
          session.user.name || session.user.email?.split("@")[0] || "User",
        avatar_url: session.user.image || null,
      }
    : null;

  const handleSignOut = async () => {
    await nextAuthSignOut({ redirectTo: "/login" });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading: status === "loading",
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthInner>{children}</AuthInner>
    </SessionProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
