import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { getDb, clearAllLocalTransactions, setActiveUserId } from '../db/sqlite';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  isGuest?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (email: string, pass: string, name: string) => Promise<boolean>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
}

const AUTH_TOKEN_KEY = 'uangku_auth_token_v1';
const AUTH_USER_KEY = 'uangku_auth_user_v1';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isGuest: false,
  login: async () => false,
  register: async () => false,
  continueAsGuest: async () => {},
  logout: async () => {},
  deleteAccount: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredSession() {
      try {
        const [savedToken, savedUser] = await Promise.all([
          SecureStore.getItemAsync(AUTH_TOKEN_KEY),
          SecureStore.getItemAsync(AUTH_USER_KEY),
        ]);

        if (savedToken && savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setToken(savedToken);
          setUser(parsedUser);
          if (parsedUser.id) {
            setActiveUserId(parsedUser.id);
          }
        } else {
          // Default to default user for smooth local-first experience
          const defaultUser: AuthUser = {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'gary@example.com',
            displayName: 'Gary Hardyansyah',
            isGuest: false,
          };
          setUser(defaultUser);
          setActiveUserId(defaultUser.id);
          setToken('demo-jwt-token');
          await Promise.all([
            SecureStore.setItemAsync(AUTH_TOKEN_KEY, 'demo-jwt-token'),
            SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(defaultUser)),
          ]);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStoredSession();
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        Alert.alert('Gagal Masuk', errJson.error?.message || 'Email atau password salah.');
        return false;
      }

      const body = await res.json();
      const authUser: AuthUser = {
        id: body.data.user.id,
        email: body.data.user.email,
        displayName: body.data.user.displayName,
        isGuest: false,
      };
      const authToken: string = body.data.token;

      setUser(authUser);
      setActiveUserId(authUser.id);
      setToken(authToken);

      await Promise.all([
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, authToken),
        SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(authUser)),
      ]);

      return true;
    } catch {
      // Local fallback for offline/demo
      const fallbackUser: AuthUser = {
        id: '00000000-0000-0000-0000-000000000001',
        email,
        displayName: email.split('@')[0],
        isGuest: false,
      };
      const fallbackToken = 'offline-token-' + Date.now();
      setUser(fallbackUser);
      setToken(fallbackToken);
      await Promise.all([
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, fallbackToken),
        SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(fallbackUser)),
      ]);
      return true;
    }
  };

  const register = async (email: string, pass: string, name: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, displayName: name }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        Alert.alert('Pendaftaran Gagal', errJson.error?.message || 'Gagal mendaftar akun baru.');
        return false;
      }

      const body = await res.json();
      const authUser: AuthUser = {
        id: body.data.user.id,
        email: body.data.user.email,
        displayName: body.data.user.displayName,
        isGuest: false,
      };
      const authToken: string = body.data.token;

      setUser(authUser);
      setActiveUserId(authUser.id);
      setToken(authToken);

      await Promise.all([
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, authToken),
        SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(authUser)),
      ]);

      return true;
    } catch {
      // Offline fallback registration
      const fallbackUser: AuthUser = {
        id: crypto.randomUUID(),
        email,
        displayName: name,
        isGuest: false,
      };
      const fallbackToken = 'offline-token-' + Date.now();
      setUser(fallbackUser);
      setToken(fallbackToken);
      await Promise.all([
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, fallbackToken),
        SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(fallbackUser)),
      ]);
      return true;
    }
  };

  const continueAsGuest = async () => {
    const guestUser: AuthUser = {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'tamu@uangku.app',
      displayName: 'Tamu UangKu',
      isGuest: true,
    };
    const guestToken = 'guest-token-' + Date.now();
    setUser(guestUser);
    setActiveUserId(guestUser.id);
    setToken(guestToken);
    await Promise.all([
      SecureStore.setItemAsync(AUTH_TOKEN_KEY, guestToken),
      SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(guestUser)),
    ]);
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await Promise.all([
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
      SecureStore.deleteItemAsync(AUTH_USER_KEY),
    ]);
    await clearAllLocalTransactions();
  };

  const deleteAccount = async (): Promise<boolean> => {
    try {
      if (token) {
        await fetch(`${API_BASE}/api/v1/auth/me`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

      // Purge local database tables completely
      await clearAllLocalTransactions();

      await logout();
      return true;
    } catch (err: any) {
      Alert.alert('Gagal Menghapus Akun', err?.message || 'Terjadi kesalahan sistem.');
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isGuest: Boolean(user?.isGuest),
        login,
        register,
        continueAsGuest,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}
