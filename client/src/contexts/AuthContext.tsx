// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';

type UserRole = 'student' | 'faculty' | null;

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  role: UserRole;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  role: null,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const determineRole = (email: string): UserRole => {
    if (email.endsWith('@cloud.neduet.edu.pk')) return 'student';
    if (email.endsWith('@neduet.edu.pk')) return 'faculty';
    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = user.email || '';
        const userRole = determineRole(email);

        if (!userRole) {
          await signOut(auth);
          setCurrentUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        setCurrentUser(user);
        setRole(userRole);
      } else {
        setCurrentUser(null);
        setRole(null);
      }
      setLoading(false); // Ensure loading is set to false after auth state is determined
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setRole(null);
  };

  const value = {
    currentUser,
    loading,
    role,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
