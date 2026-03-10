"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authApi } from "@/lib/api";
import { getCookie, setCookie, removeCookie } from "@/lib/cookies";

interface User {
  id: number;
  email: string;
  role: string;
  regionId: number | null;
  regionName: string | null;
  provinceId: number | null;
  provinceName: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = getCookie("user");
    const token = getCookie("accessToken");
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        removeCookie("user");
        removeCookie("accessToken");
        removeCookie("refreshToken");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const userData: User = {
      id: response.id,
      email: response.email,
      role: response.role,
      regionId: response.regionId,
      regionName: response.regionName,
      provinceId: response.provinceId,
      provinceName: response.provinceName,
    };

    setCookie("accessToken", response.accessToken, 1);
    setCookie("refreshToken", response.refreshToken, 7);
    setCookie("user", JSON.stringify(userData), 7);

    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    removeCookie("accessToken");
    removeCookie("refreshToken");
    removeCookie("user");
    setUser(null);
  }, []);

  return (
      <AuthContext.Provider
          value={{
            user,
            isLoading,
            login,
            logout,
            isAuthenticated: !!user,
          }}
      >
        {children}
      </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
