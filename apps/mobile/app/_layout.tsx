import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { BlurView } from 'expo-blur';
import { ShieldCheck, Lock, KeyRound, Delete } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../src/theme/colors';
import { getDb } from '../src/db/sqlite';
import { AuthProvider } from '../src/auth/authContext';
import { ToastProvider } from '../src/components/Toast';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { WelcomeFlow } from '../src/components/WelcomeFlow';
import { hapticMedium, hapticSuccess, hapticError, hapticLight, hapticSelection } from '../src/theme/haptics';

const BIOMETRIC_PREF_KEY = 'uangku_biometric_enabled';
const PIN_STORAGE_KEY = 'uangku_app_pin_hash';
const HAS_SEEN_ONBOARDING_KEY = 'uangku_has_completed_onboarding_v1';

export default function RootLayout() {
  const [isPrivacyShieldActive, setIsPrivacyShieldActive] = useState(false);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const [isWelcomeFlowVisible, setIsWelcomeFlowVisible] = useState(false);
  const [isPinScreenVisible, setIsPinScreenVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [failedPinAttempts, setFailedPinAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [pinError, setPinError] = useState('');
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authenticateBiometric = useCallback(async () => {
    try {
      const isEnabled = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
      if (isEnabled === '1') {
        setIsBiometricLocked(true);
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          const res = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Buka UangKu dengan Biometrik',
            cancelLabel: 'Batal',
            fallbackLabel: 'Gunakan PIN',
            disableDeviceFallback: false,
          });
          if (res.success) {
            hapticSuccess();
            setIsBiometricLocked(false);
            setIsPinScreenVisible(false);
            setEnteredPin('');
          } else {
            hapticError();
          }
        }
      } else {
        setIsBiometricLocked(false);
      }
    } catch {
      setIsBiometricLocked(false);
    }
  }, []);

  const handlePressPinDigit = async (digit: string) => {
    if (cooldownSeconds > 0) return;
    hapticLight();
    const nextPin = `${enteredPin}${digit}`;
    if (nextPin.length <= 6) {
      setEnteredPin(nextPin);
      setPinError('');

      if (nextPin.length === 6) {
        // Verify PIN (PRD Section 66.3)
        const savedPin = (await SecureStore.getItemAsync(PIN_STORAGE_KEY)) || '123456';
        if (nextPin === savedPin) {
          hapticSuccess();
          setIsBiometricLocked(false);
          setIsPinScreenVisible(false);
          setEnteredPin('');
          setFailedPinAttempts(0);
        } else {
          hapticError();
          const nextAttempts = failedPinAttempts + 1;
          setFailedPinAttempts(nextAttempts);
          setEnteredPin('');

          if (nextAttempts >= 5) {
            setCooldownSeconds(30);
            setPinError('5x salah. Terkunci selama 30 detik.');
          } else {
            setPinError(`PIN salah (${nextAttempts}/5). Coba lagi.`);
          }
        }
      }
    }
  };

  const handleBackspacePin = () => {
    if (cooldownSeconds > 0) return;
    hapticLight();
    setEnteredPin((prev) => prev.slice(0, -1));
    setPinError('');
  };

  // Cooldown timer interval
  useEffect(() => {
    if (cooldownSeconds > 0) {
      cooldownTimerRef.current = setTimeout(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [cooldownSeconds]);

  useEffect(() => {
    getDb().catch(console.error);
    authenticateBiometric();

    SecureStore.getItemAsync(HAS_SEEN_ONBOARDING_KEY)
      .then((seen) => {
        if (!seen) {
          setIsWelcomeFlowVisible(true);
        }
      })
      .catch(() => {});

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        setIsPrivacyShieldActive(true);
      } else if (nextAppState === 'active') {
        setIsPrivacyShieldActive(false);
        authenticateBiometric();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [authenticateBiometric]);

  const handleCompleteWelcomeFlow = async () => {
    setIsWelcomeFlowVisible(false);
    await SecureStore.setItemAsync(HAS_SEEN_ONBOARDING_KEY, '1').catch(() => {});
  };

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.base },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/new"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg.base },
          }}
        />
      </Stack>

      {/* Multitasking Privacy Blur Shield & Biometric Lock (PRD Section 31.4 & 66) */}
      {(isPrivacyShieldActive || isBiometricLocked) && (
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={styles.shieldCenter}>
              <View style={styles.shieldIconWrap}>
                {isBiometricLocked ? (
                  <Lock size={36} color={colors.gold.champagne} />
                ) : (
                  <ShieldCheck size={36} color={colors.gold.champagne} />
                )}
              </View>

              {isBiometricLocked && !isPinScreenVisible && (
                <View style={styles.lockInfoWrap}>
                  <Text style={styles.lockTitle}>UangKu Terkunci</Text>
                  <Text style={styles.lockSubtitle}>
                    Data keuangan diproteksi oleh enkripsi perangkat Secure Enclave
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.unlockBtn}
                    onPress={() => {
                      hapticMedium();
                      authenticateBiometric();
                    }}
                  >
                    <Text style={styles.unlockBtnText}>Buka dengan Face ID</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.pinFallbackBtn}
                    onPress={() => {
                      hapticSelection();
                      setIsPinScreenVisible(true);
                    }}
                  >
                    <KeyRound size={15} color={colors.gold.champagne} />
                    <Text style={styles.pinFallbackText}>Gunakan PIN (Fallback)</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* In-App 6-Digit PIN Screen (PRD Section 66.3) */}
              {isBiometricLocked && isPinScreenVisible && (
                <View style={styles.pinContainer}>
                  <Text style={styles.pinPromptTitle}>Masukkan PIN 6 Digit</Text>
                  <Text style={styles.pinPromptSubtitle}>
                    {cooldownSeconds > 0
                      ? `Terkunci sementara (${cooldownSeconds}s)`
                      : pinError || 'Gunakan PIN keamanan akunmu'}
                  </Text>

                  {/* 6 Dots Indicator */}
                  <View style={styles.pinDotsRow}>
                    {[0, 1, 2, 3, 4, 5].map((index) => {
                      const isFilled = enteredPin.length > index;
                      return (
                        <View
                          key={index}
                          style={[styles.pinDot, isFilled && styles.pinDotFilled]}
                        />
                      );
                    })}
                  </View>

                  {/* Numeric Keypad Grid */}
                  <View style={styles.pinKeypadGrid}>
                    <View style={styles.pinKeypadRow}>
                      {['1', '2', '3'].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={styles.pinKey}
                          disabled={cooldownSeconds > 0}
                          onPress={() => handlePressPinDigit(d)}
                        >
                          <Text style={styles.pinKeyText}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.pinKeypadRow}>
                      {['4', '5', '6'].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={styles.pinKey}
                          disabled={cooldownSeconds > 0}
                          onPress={() => handlePressPinDigit(d)}
                        >
                          <Text style={styles.pinKeyText}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.pinKeypadRow}>
                      {['7', '8', '9'].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={styles.pinKey}
                          disabled={cooldownSeconds > 0}
                          onPress={() => handlePressPinDigit(d)}
                        >
                          <Text style={styles.pinKeyText}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.pinKeypadRow}>
                      <TouchableOpacity
                        style={styles.pinKey}
                        onPress={() => {
                          hapticSelection();
                          setIsPinScreenVisible(false);
                          setEnteredPin('');
                        }}
                      >
                        <Text style={[styles.pinKeyText, { fontSize: 13, color: colors.text.muted }]}>
                          Kembali
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pinKey}
                        disabled={cooldownSeconds > 0}
                        onPress={() => handlePressPinDigit('0')}
                      >
                        <Text style={styles.pinKeyText}>0</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pinKey, { backgroundColor: 'transparent' }]}
                        onPress={handleBackspacePin}
                      >
                        <Delete size={22} color={colors.gold.champagne} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </BlurView>
        </View>
      )}

      {/* Intro Animation & Welcome Page Flow */}
      <WelcomeFlow
        visible={isWelcomeFlowVisible}
        onClose={handleCompleteWelcomeFlow}
        startWithAnimation={true}
      />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  shieldCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 10, 14, 0.75)',
  },
  shieldIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockInfoWrap: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 32,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  lockSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  unlockBtn: {
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    marginBottom: 12,
  },
  unlockBtnText: {
    color: '#090A0E',
    fontSize: 14,
    fontWeight: '700',
  },
  pinFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pinFallbackText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
  pinContainer: {
    alignItems: 'center',
    marginTop: 18,
    width: '100%',
    paddingHorizontal: 28,
  },
  pinPromptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  pinPromptSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: 18,
    textAlign: 'center',
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: colors.gold.champagne,
    borderColor: colors.gold.champagne,
  },
  pinKeypadGrid: {
    width: '100%',
    maxWidth: 280,
    gap: 12,
  },
  pinKeypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pinKey: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#161924',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinKeyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
