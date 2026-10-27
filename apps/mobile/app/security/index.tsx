import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ShieldCheck,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Check,
  X,
  Delete,
} from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
import {
  hapticMedium,
  hapticSelection,
  hapticSuccess,
  hapticError,
  hapticLight,
} from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

const BIOMETRIC_PREF_KEY = 'uangku_biometric_enabled';
const PIN_STORAGE_KEY = 'uangku_app_pin_hash';
const PRIVACY_MASK_KEY = 'uangku_privacy_mask_balance';
const AUTOLOCK_KEY = 'uangku_autolock_timeout';

export default function SecurityCenterScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [biometricType, setBiometricType] = useState('Face ID / Touch ID');

  const [privacyMaskEnabled, setPrivacyMaskEnabled] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState<'immediate' | '1m' | '5m'>('immediate');

  // Change PIN Flow (Step: 'current' | 'new' | 'confirm')
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinStep, setPinStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [currentPinAttempt, setCurrentPinAttempt] = useState('');
  const [newPinAttempt, setNewPinAttempt] = useState('');
  const [confirmPinAttempt, setConfirmPinAttempt] = useState('');
  const [pinErrorText, setPinErrorText] = useState('');

  const loadPreferences = useCallback(async () => {
    try {
      const [bioPref, maskPref, lockPref, hasHw, enrolled, authTypes] = await Promise.all([
        SecureStore.getItemAsync(BIOMETRIC_PREF_KEY),
        SecureStore.getItemAsync(PRIVACY_MASK_KEY),
        SecureStore.getItemAsync(AUTOLOCK_KEY),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      setBiometricEnabled(bioPref === '1');
      setPrivacyMaskEnabled(maskPref === '1');
      if (lockPref === '1m' || lockPref === '5m' || lockPref === 'immediate') {
        setAutoLockTimeout(lockPref as any);
      }
      setHasBiometricHardware(hasHw);
      setIsBiometricEnrolled(enrolled);

      if (authTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (authTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Touch ID / Fingerprint');
      }
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      if (!hasBiometricHardware || !isBiometricEnrolled) {
        Alert.alert(
          'Biometrik Belum Diatur',
          'Perangkat ini belum mengatur biometrik (Face ID atau Touch ID) di pengaturan sistem ponsel.'
        );
        return;
      }

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: `Aktifkan ${biometricType} untuk UangKu`,
        cancelLabel: 'Batal',
      });

      if (res.success) {
        hapticSuccess();
        await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, '1');
        setBiometricEnabled(true);
        toast.showSuccess('Biometrik Aktif', `${biometricType} akan diminta setiap aplikasi dibuka.`);
      } else {
        hapticLight();
      }
    } else {
      hapticSelection();
      await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, '0');
      setBiometricEnabled(false);
      toast.showInfo('Biometrik Dinonaktifkan', 'Aplikasi dapat diakses tanpa sensor biometrik.');
    }
  };

  const handleTogglePrivacyMask = async (value: boolean) => {
    hapticSelection();
    await SecureStore.setItemAsync(PRIVACY_MASK_KEY, value ? '1' : '0');
    setPrivacyMaskEnabled(value);
    toast.showInfo(
      value ? 'Mode Sensor Aktif' : 'Mode Sensor Dimatikan',
      value
        ? 'Nominal saldo disensor menjadi •••••• untuk menjaga privasi di tempat umum.'
        : 'Nominal saldo kembali ditampilkan seperti biasa.'
    );
  };

  const handleChangeAutoLock = async (timeout: 'immediate' | '1m' | '5m') => {
    hapticSelection();
    await SecureStore.setItemAsync(AUTOLOCK_KEY, timeout);
    setAutoLockTimeout(timeout);
    toast.showSuccess('Auto-Lock Diperbarui', `Kunci otomatis diset: ${timeout === 'immediate' ? 'Segera' : timeout}`);
  };

  // Change PIN Keypad Handlers
  const handleStartChangePin = () => {
    hapticMedium();
    setPinStep('current');
    setCurrentPinAttempt('');
    setNewPinAttempt('');
    setConfirmPinAttempt('');
    setPinErrorText('');
    setIsPinModalOpen(true);
  };

  const handlePressPinKey = async (digit: string) => {
    hapticLight();
    setPinErrorText('');

    if (pinStep === 'current') {
      const next = currentPinAttempt + digit;
      if (next.length <= 6) {
        setCurrentPinAttempt(next);
        if (next.length === 6) {
          const savedPin = (await SecureStore.getItemAsync(PIN_STORAGE_KEY)) || '123456';
          if (next === savedPin) {
            hapticSuccess();
            setPinStep('new');
          } else {
            hapticError();
            setCurrentPinAttempt('');
            setPinErrorText('PIN saat ini tidak cocok. Silakan coba lagi.');
          }
        }
      }
    } else if (pinStep === 'new') {
      const next = newPinAttempt + digit;
      if (next.length <= 6) {
        setNewPinAttempt(next);
        if (next.length === 6) {
          hapticMedium();
          setPinStep('confirm');
        }
      }
    } else if (pinStep === 'confirm') {
      const next = confirmPinAttempt + digit;
      if (next.length <= 6) {
        setConfirmPinAttempt(next);
        if (next.length === 6) {
          if (next === newPinAttempt) {
            hapticSuccess();
            await SecureStore.setItemAsync(PIN_STORAGE_KEY, next);
            setIsPinModalOpen(false);
            toast.showSuccess('PIN Diperbarui', 'PIN 6-digit baru Anda berhasil disimpan aman.');
          } else {
            hapticError();
            setConfirmPinAttempt('');
            setPinErrorText('PIN konfirmasi tidak sama. Silakan ulangi.');
          }
        }
      }
    }
  };

  const handleBackspacePin = () => {
    hapticLight();
    if (pinStep === 'current') {
      setCurrentPinAttempt((prev) => prev.slice(0, -1));
    } else if (pinStep === 'new') {
      setNewPinAttempt((prev) => prev.slice(0, -1));
    } else if (pinStep === 'confirm') {
      setConfirmPinAttempt((prev) => prev.slice(0, -1));
    }
  };

  const activeAttempt =
    pinStep === 'current'
      ? currentPinAttempt
      : pinStep === 'new'
      ? newPinAttempt
      : confirmPinAttempt;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              hapticSelection();
              router.back();
            }}
          >
            <ChevronLeft size={22} color={colors.gold.champagne} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Pusat Keamanan & PIN</Text>
            <Text style={styles.headerSubtitle}>Proteksi Hardware & Privasi Finansial</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Security Status Banner */}
        <View style={styles.securityBanner}>
          <View style={styles.shieldIconWrap}>
            <ShieldCheck size={28} color={colors.gold.champagne} />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>Proteksi Perangkat Aktif</Text>
            <Text style={styles.bannerDesc}>
              Database SQLite lokal dan PIN Anda dienkripsi dengan standar Secure Enclave. Data finansial tersimpan offline di ponsel Anda.
            </Text>
          </View>
        </View>

        {/* Biometrics Section */}
        <Text style={styles.sectionTitle}>AUTENTIKASI BIOMETRIK</Text>
        <View style={styles.cardGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.iconCircle}>
                <Smartphone size={16} color={colors.gold.champagne} />
              </View>
              <View style={styles.settingLabelCol}>
                <Text style={styles.settingLabel}>Kunci dengan {biometricType}</Text>
                <Text style={styles.settingSublabel}>
                  {hasBiometricHardware
                    ? 'Sensor biometrik terdeteksi dan siap digunakan'
                    : 'Perangkat tidak memiliki sensor biometrik'}
                </Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
              thumbColor={colors.text.primary}
              disabled={!hasBiometricHardware}
            />
          </View>
        </View>

        {/* App PIN Section */}
        <Text style={styles.sectionTitle}>KUNCI PIN 6-DIGIT</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={handleStartChangePin}
          >
            <View style={styles.settingLeft}>
              <View style={styles.iconCircle}>
                <KeyRound size={16} color={colors.gold.champagne} />
              </View>
              <View style={styles.settingLabelCol}>
                <Text style={styles.settingLabel}>Ubah PIN 6-Digit</Text>
                <Text style={styles.settingSublabel}>
                  PIN darurat jika Face ID / Touch ID tidak dapat digunakan
                </Text>
              </View>
            </View>
            <View style={styles.actionChip}>
              <Text style={styles.actionChipText}>Ubah PIN</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Privacy & Screen Protection (PRD §66, §70) */}
        <Text style={styles.sectionTitle}>PRIVASI & TAMPILAN SALDO</Text>
        <View style={styles.cardGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.iconCircle}>
                {privacyMaskEnabled ? (
                  <EyeOff size={16} color={colors.gold.champagne} />
                ) : (
                  <Eye size={16} color={colors.gold.champagne} />
                )}
              </View>
              <View style={styles.settingLabelCol}>
                <Text style={styles.settingLabel}>Sensor Saldo di Tempat Umum</Text>
                <Text style={styles.settingSublabel}>
                  Sembunyikan angka rupiah menjadi •••••• saat berada di keramaian
                </Text>
              </View>
            </View>
            <Switch
              value={privacyMaskEnabled}
              onValueChange={handleTogglePrivacyMask}
              trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
              thumbColor={colors.text.primary}
            />
          </View>

          <View style={[styles.settingRow, styles.rowBorderTop]}>
            <View style={styles.settingLeft}>
              <View style={styles.iconCircle}>
                <Clock size={16} color={colors.gold.champagne} />
              </View>
              <View style={styles.settingLabelCol}>
                <Text style={styles.settingLabel}>Waktu Kunci Otomatis (Auto-Lock)</Text>
                <Text style={styles.settingSublabel}>Kunci aplikasi setelah tidak aktif</Text>
              </View>
            </View>
          </View>

          {/* Auto lock options */}
          <View style={styles.autoLockOptionsRow}>
            {(['immediate', '1m', '5m'] as const).map((opt) => {
              const isSelected = autoLockTimeout === opt;
              const label =
                opt === 'immediate' ? 'Segera' : opt === '1m' ? '1 Menit' : '5 Menit';
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.autoLockBtn, isSelected && styles.autoLockBtnActive]}
                  onPress={() => handleChangeAutoLock(opt)}
                >
                  <Text
                    style={[
                      styles.autoLockBtnText,
                      isSelected && styles.autoLockBtnTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Security Checklist Card */}
        <View style={styles.auditCard}>
          <Text style={styles.auditTitle}>JAMINAN KEAMANAN UANGKU</Text>
          <View style={styles.checkItem}>
            <CheckCircle2 size={14} color="#10B981" />
            <Text style={styles.checkItemText}>
              Enkripsi Perangkat Keras Secure Enclave & Keystore
            </Text>
          </View>
          <View style={styles.checkItem}>
            <CheckCircle2 size={14} color="#10B981" />
            <Text style={styles.checkItemText}>
              Database SQLite Lokal Bersandbox Aman (No Cloud Leaks)
            </Text>
          </View>
          <View style={styles.checkItem}>
            <CheckCircle2 size={14} color="#10B981" />
            <Text style={styles.checkItemText}>
              App Switcher Auto-Blur Shield (Layar disensor saat multitasking)
            </Text>
          </View>
          <View style={styles.checkItem}>
            <CheckCircle2 size={14} color="#10B981" />
            <Text style={styles.checkItemText}>
              Sanitasi Injeksi CSV Formula (OWASP Standard)
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Change PIN Modal */}
      <Modal visible={isPinModalOpen} transparent animationType="slide">
        <View style={styles.pinModalBackdrop}>
          <View style={styles.pinModalContent}>
            <View style={styles.pinModalHeader}>
              <TouchableOpacity
                style={styles.pinCloseBtn}
                onPress={() => setIsPinModalOpen(false)}
              >
                <X size={20} color={colors.text.secondary} />
              </TouchableOpacity>
              <Text style={styles.pinModalHeaderTitle}>Ubah PIN Keamanan</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.pinStepContent}>
              <Text style={styles.pinStepTitle}>
                {pinStep === 'current'
                  ? 'Masukkan PIN Saat Ini'
                  : pinStep === 'new'
                  ? 'Buat 6-Digit PIN Baru'
                  : 'Konfirmasi PIN Baru'}
              </Text>
              <Text style={styles.pinStepSub}>
                {pinStep === 'current'
                  ? 'Masukkan PIN lama Anda untuk otorisasi perubahan.'
                  : pinStep === 'new'
                  ? 'Gunakan kombinasi angka yang mudah diingat namun aman.'
                  : 'Ketik ulang PIN baru untuk memastikan kecocokan.'}
              </Text>

              {/* Dots */}
              <View style={styles.pinDotsRow}>
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = idx < activeAttempt.length;
                  return (
                    <View
                      key={idx}
                      style={[styles.pinDot, isFilled && styles.pinDotFilled]}
                    />
                  );
                })}
              </View>

              {pinErrorText ? (
                <Text style={styles.pinErrorText}>{pinErrorText}</Text>
              ) : null}

              {/* Keypad */}
              <View style={styles.keypadContainer}>
                {[
                  ['1', '2', '3'],
                  ['4', '5', '6'],
                  ['7', '8', '9'],
                  ['', '0', 'delete'],
                ].map((row, rIdx) => (
                  <View key={rIdx} style={styles.keypadRow}>
                    {row.map((digit, dIdx) => {
                      if (digit === '') {
                        return <View key={dIdx} style={styles.keypadCell} />;
                      }
                      if (digit === 'delete') {
                        return (
                          <TouchableOpacity
                            key={dIdx}
                            style={styles.keypadCell}
                            onPress={handleBackspacePin}
                          >
                            <Delete size={22} color={colors.text.secondary} />
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={dIdx}
                          style={styles.keypadCell}
                          onPress={() => handlePressPinKey(digit)}
                        >
                          <Text style={styles.keypadDigitText}>{digit}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.bg.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.text.muted,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  shieldIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInfo: {
    flex: 1,
    gap: 3,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  bannerDesc: {
    fontSize: 11,
    color: colors.text.muted,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.text.muted,
    marginTop: 4,
  },
  cardGroup: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  rowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabelCol: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  settingSublabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  actionChip: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
  autoLockOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  autoLockBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  autoLockBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderColor: colors.gold.primary,
  },
  autoLockBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  autoLockBtnTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  auditCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 10,
    marginTop: 6,
  },
  auditTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.gold.champagne,
    marginBottom: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkItemText: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
  },
  // PIN Modal
  pinModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  pinModalContent: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  pinCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.elevated,
  },
  pinModalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  pinStepContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  pinStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  pinStepSub: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: colors.gold.primary,
    borderColor: colors.gold.primary,
  },
  pinErrorText: {
    fontSize: 12,
    color: colors.flow.expense,
    fontWeight: '600',
    marginBottom: 12,
  },
  keypadContainer: {
    width: '100%',
    maxWidth: 280,
    gap: 12,
    marginTop: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keypadCell: {
    width: 70,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  keypadDigitText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
});
