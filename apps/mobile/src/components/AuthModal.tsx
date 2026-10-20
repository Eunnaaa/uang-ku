import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Sparkles, Mail, Lock, User, X, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../auth/authContext';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError } from '../theme/haptics';

interface AuthModalProps {
  visible: boolean;
  onClose?: () => void;
}

export function AuthModal({ visible, onClose }: AuthModalProps) {
  const { login, register, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      hapticError();
      return;
    }

    setIsLoading(true);
    hapticMedium();

    let success = false;
    if (mode === 'login') {
      success = await login(email.trim(), password.trim());
    } else {
      success = await register(email.trim(), password.trim(), displayName.trim() || 'Pengguna UangKu');
    }

    setIsLoading(false);

    if (success) {
      hapticSuccess();
      onClose?.();
    } else {
      hapticError();
    }
  };

  const handleGuest = async () => {
    hapticSelection();
    await continueAsGuest();
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.brandingRow}>
              <View style={styles.brandIconWrap}>
                <Sparkles size={16} color={colors.gold.primary} />
              </View>
              <Text style={styles.brandTitle}>UangKu Cloud Sync</Text>
            </View>
            {onClose && (
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.headline}>
              {mode === 'login' ? 'Masuk ke Akun Anda' : 'Buat Akun Baru'}
            </Text>
            <Text style={styles.subheadline}>
              {mode === 'login'
                ? 'Sinkronkan catatan transaksi dan multi-rekening secara real-time.'
                : 'Catatan finansial Anda tetap tersimpan aman di SQLite lokal dan cloud.'}
            </Text>

            {/* Mode Switcher */}
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, mode === 'login' && styles.segmentBtnActive]}
                onPress={() => {
                  hapticSelection();
                  setMode('login');
                }}
              >
                <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>
                  Masuk
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, mode === 'register' && styles.segmentBtnActive]}
                onPress={() => {
                  hapticSelection();
                  setMode('register');
                }}
              >
                <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
                  Daftar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NAMA LENGKAP</Text>
                <View style={styles.inputWrap}>
                  <User size={16} color={colors.text.muted} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Contoh: Gary Hardyansyah"
                    placeholderTextColor={colors.text.muted}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ALAMAT EMAIL</Text>
              <View style={styles.inputWrap}>
                <Mail size={16} color={colors.text.muted} />
                <TextInput
                  style={styles.textInput}
                  placeholder="nama@email.com"
                  placeholderTextColor={colors.text.muted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>KATA SANDI</Text>
              <View style={styles.inputWrap}>
                <Lock size={16} color={colors.text.muted} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Minimal 8 karakter"
                  placeholderTextColor={colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Submit Primary Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.primaryBtn}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#090A0E" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {mode === 'login' ? 'Masuk ke Akun' : 'Daftar Sekarang'}
                  </Text>
                  <ArrowRight size={16} color="#090A0E" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>

            {/* Guest Offline Button */}
            <TouchableOpacity activeOpacity={0.7} style={styles.guestBtn} onPress={handleGuest}>
              <ShieldCheck size={14} color={colors.gold.champagne} />
              <Text style={styles.guestBtnText}>Lanjutkan Mode Tamu (Offline-First)</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 14, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#12141D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subheadline: {
    fontSize: 13,
    color: colors.text.muted,
    lineHeight: 18,
    marginBottom: 18,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.muted,
  },
  segmentTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090A0E',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  textInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold.primary,
    height: 50,
    borderRadius: 16,
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#090A0E',
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  guestBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
});
