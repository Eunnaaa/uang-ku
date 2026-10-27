import React, { useState, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Sparkles, Zap, ShieldCheck, Lock, ChevronRight, X, Wallet, Check } from 'lucide-react-native';
import { formatRupiah } from '@uangku/contracts';
import { colors, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/themeContext';
import { hapticSelection, hapticSuccess, hapticLight } from '../theme/haptics';
import { getLocalAccounts, updateLocalAccount } from '../db/sqlite';

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    step: 1,
    icon: Sparkles,
    badge: 'LUXURY & SPEED',
    title: 'Catat Uangmu Dalam 10 Detik',
    desc: 'UangKu dirancang khusus untuk kenyamanan pencatatan keuangan premium. Akses kilat, tampilan mewah, dan bebas distraksi.',
  },
  {
    step: 2,
    icon: Zap,
    badge: 'KEYPAD KHUSUS',
    title: 'Pencatatan Cepat & Taktil',
    desc: 'Keypad numerik responsif dengan feedback haptik intuitif, template favorit, dan kalkulator nominal otomatis.',
  },
  {
    step: 3,
    icon: ShieldCheck,
    badge: 'OFFLINE-FIRST',
    title: 'Selalu Tersimpan & Siap Pakai',
    desc: 'Menggunakan basis data SQLite lokal berkecepatan tinggi. Tetap lancar mencatat transaksi di mana saja tanpa perlu sinyal internet.',
  },
  {
    step: 4,
    icon: Lock,
    badge: 'PRIVASI MAKSIMAL',
    title: 'Keamanan Standar Apple 5.1',
    desc: 'Dilindungi enkripsi lokal dan biometrik Face ID. Tanpa iklan, tanpa pelacak pihak ketiga—data finansialmu 100% milikmu.',
  },
];

const PRESET_BALANCES = [0, 100000, 500000, 1000000, 5000000];

export function OnboardingModal({ visible, onClose }: OnboardingModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSettingInitialBalance, setIsSettingInitialBalance] = useState(false);
  const [initialBalanceAmount, setInitialBalanceAmount] = useState<number>(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      hapticSelection();
      setCurrentSlide((prev) => prev + 1);
    } else {
      hapticSelection();
      // PRD Section 72.2: Alur Initial Balance Setup tepat setelah onboarding slide selesai
      setIsSettingInitialBalance(true);
    }
  };

  const handleSkip = () => {
    hapticLight();
    // Beri opsi isi saldo awal meski skip tour
    setIsSettingInitialBalance(true);
  };

  const handleFinishOnboarding = async () => {
    try {
      const accounts = await getLocalAccounts();
      const defaultAccount = accounts.find((a) => a.isDefault) || accounts[0];
      if (defaultAccount && initialBalanceAmount > 0) {
        await updateLocalAccount(defaultAccount.id, { initialBalance: initialBalanceAmount });
      }
    } catch {}
    hapticSuccess();
    setIsSettingInitialBalance(false);
    setCurrentSlide(0);
    onClose();
  };

  const slide = SLIDES[currentSlide];
  const IconComponent = slide.icon;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        {!isSettingInitialBalance ? (
          <View style={styles.card}>
            {/* Header Bar */}
            <View style={styles.topRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {slide.step} / {SLIDES.length}
                </Text>
              </View>
              <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            {/* Icon Circle */}
            <View style={styles.iconCircle}>
              <IconComponent size={34} color={colors.gold.primary} />
            </View>

            {/* Badge & Title */}
            <Text style={styles.subBadge}>{slide.badge}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.desc}>{slide.desc}</Text>

            {/* Dots Indicator */}
            <View style={styles.dotsRow}>
              {SLIDES.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentSlide && styles.dotActive,
                  ]}
                />
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              {currentSlide < SLIDES.length - 1 ? (
                <>
                  <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                    <Text style={styles.skipBtnText}>Lewati</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                    <Text style={styles.nextBtnText}>Lanjut</Text>
                    <ChevronRight size={16} color={isDark ? '#090A0E' : '#FFFFFF'} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.finishBtn} onPress={handleNext}>
                  <Text style={styles.finishBtnText}>Atur Saldo Awal Dompet</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* PRD Section 72.2: Initial Balance Setup Card */
          <View style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Langkah Terakhir</Text>
              </View>
              <TouchableOpacity onPress={handleFinishOnboarding} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.iconCircle}>
              <Wallet size={34} color={colors.gold.primary} />
            </View>

            <Text style={styles.subBadge}>SALDO AWAL</Text>
            <Text style={styles.title}>Berapa Saldo Kas / Dompetmu Sekarang?</Text>
            <Text style={styles.desc}>
              Atur saldo awal Dompet Tunai agar ringkasan asetmu langsung akurat sejak hari pertama.
            </Text>

            {/* Display Nominal */}
            <View style={styles.balanceDisplayContainer}>
              <Text style={styles.balanceDisplayText}>
                {formatRupiah(initialBalanceAmount)}
              </Text>
            </View>

            {/* Preset Pills */}
            <View style={styles.presetRow}>
              {PRESET_BALANCES.map((p) => {
                const isSelected = initialBalanceAmount === p;
                const label = p === 0 ? 'Rp 0' : p >= 1000000 ? `Rp ${p / 1000000} jt` : `Rp ${p / 1000} rb`;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.presetChip, isSelected && styles.presetChipActive]}
                    onPress={() => {
                      hapticSelection();
                      setInitialBalanceAmount(p);
                    }}
                  >
                    <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Confirm Button */}
            <TouchableOpacity style={styles.finishBtn} activeOpacity={0.8} onPress={handleFinishOnboarding}>
              <Text style={styles.finishBtnText}>
                {initialBalanceAmount === 0 ? 'Mulai dengan Rp 0' : 'Simpan Saldo & Masuk'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(9, 10, 14, 0.85)' : 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.bg.surface,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.5 : 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
    fontVariant: ['tabular-nums'],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  subBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.gold.primary,
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.muted,
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: isDark ? '#090A0E' : '#FFFFFF',
  },
  finishBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: isDark ? '#090A0E' : '#FFFFFF',
  },
  balanceDisplayContainer: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.bg.elevated,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginVertical: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 83, 9, 0.2)',
    width: '100%',
  },
  balanceDisplayText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.gold.champagne,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 20,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border.subtle,
  },
  presetChipActive: {
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(180, 83, 9, 0.15)',
    borderColor: colors.gold.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  presetChipTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
});
