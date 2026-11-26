import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { getActiveUserId, selectLocalUser, GUEST_ID } from '../db/sqlite';
import { deleteAccountData } from './deleteAccount';
import { onPinExhausted, pinState } from './pin';

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
  login: (email: string, pass: string, expectedOwner?: string) => Promise<boolean>;
  register: (email: string, pass: string, name: string) => Promise<boolean>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<boolean>;
  deleteAccount: (password?: string) => Promise<boolean>;
}

const AUTH_TOKEN_KEY = 'uangku_auth_token_v1';
const AUTH_USER_KEY = 'uangku_auth_user_v1';
const SESSION_KEY = 'uangku_session_v2';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isGuest: false,
  login: async () => false,
  register: async () => false,
  continueAsGuest: async () => {},
  logout: async () => false,
  deleteAccount: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function saveSession(authUser: AuthUser, authToken: string | null) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ user: authUser, token: authToken }));
    await selectLocalUser(authUser.id);
    setUser(authUser);
    setToken(authToken);
  }

  async function revokeCurrentSession() {
    if (!token) return true;
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST',
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
      return response.ok || response.status === 401;
    } catch { return false; }
  }

  useEffect(() => {
    async function loadStoredSession() {
      try {
        const session = await SecureStore.getItemAsync(SESSION_KEY);
        if (session) {
          const saved = JSON.parse(session);
          if (saved.token && (await pinState()).requiresLogin) {
            await saveSession(saved.user, null);
            return;
          }
          await selectLocalUser(saved.user.id);
          setUser(saved.user);
          setToken(saved.token);
          return;
        }
        const [savedToken, savedUser] = await Promise.all([
          SecureStore.getItemAsync(AUTH_TOKEN_KEY),
          SecureStore.getItemAsync(AUTH_USER_KEY),
        ]);

        if (savedUser) {
          const parsedUser: AuthUser = JSON.parse(savedUser);
          const cloudToken = savedToken?.split('.').length === 3 ? savedToken : null;
          if (savedToken === 'demo-jwt-token' || savedToken?.startsWith('offline-token-')) parsedUser.isGuest = true;
          await saveSession(parsedUser, cloudToken);
          await Promise.all([SecureStore.deleteItemAsync(AUTH_USER_KEY), SecureStore.deleteItemAsync(AUTH_TOKEN_KEY)]);
        } else {
          await continueAsGuest();
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStoredSession();
  }, []);

  useEffect(() => onPinExhausted(() => {
    if (!user || !token) return;
    setToken(null);
    void SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ user, token: null })).catch(() => {});
    void revokeCurrentSession();
  }), [user, token]);

  const login = async (email: string, pass: string, expectedOwner?: string): Promise<boolean> => {
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
      if (expectedOwner && (body.data.user.id !== expectedOwner || getActiveUserId() !== expectedOwner)) return false;
      const authUser: AuthUser = {
        id: body.data.user.id,
        email: body.data.user.email,
        displayName: body.data.user.displayName,
        isGuest: false,
      };
      const authToken: string = body.data.token;

      if (token) await revokeCurrentSession();
      await saveSession(authUser, authToken);
      return true;
    } catch {
      Alert.alert('Gagal Masuk', 'Tidak dapat memverifikasi akun. Periksa koneksi lalu coba lagi.');
      return false;
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

      if (token) await revokeCurrentSession();
      await saveSession(authUser, authToken);
      return true;
    } catch {
      Alert.alert('Pendaftaran Gagal', 'Periksa koneksi lalu coba lagi.');
      return false;
    }
  };

  const localGuest = async () => {
    const guestUser: AuthUser = {
      id: GUEST_ID,
      email: 'tamu@uangku.app',
      displayName: 'Tamu UangKu',
      isGuest: true,
    };
    await saveSession(guestUser, null);
  };

  const logout = async () => {
    const confirmed = await revokeCurrentSession();
    await localGuest();
    return confirmed;
  };
  const continueAsGuest = async () => {
    if (!await logout()) Alert.alert('Keluar dari perangkat', 'Pencabutan sesi server belum terkonfirmasi.');
  };

  const deleteAccount = async (password?: string): Promise<boolean> => {
    try {
      if (!user) return false;
      await deleteAccountData(API_BASE, user, token, password);

      await localGuest();
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
      {!isLoading && <React.Fragment key={user?.id || 'signed-out'}>{children}</React.Fragment>}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function getStoredToken(owner = getActiveUserId()): Promise<string | null> {
  try {
    const session = JSON.parse((await SecureStore.getItemAsync(SESSION_KEY)) || 'null');
    return session?.user.id === owner && !session.user.isGuest && !(await pinState()).requiresLogin ? session.token : null;
  } catch {
    return null;
  }
}
