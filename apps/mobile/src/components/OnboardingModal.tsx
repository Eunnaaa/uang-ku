import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Sparkles, Zap, ShieldCheck, Lock, ChevronRight, X } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { hapticSelection, hapticSuccess, hapticLight } from '../theme/haptics';

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

export function OnboardingModal({ visible, onClose }: OnboardingModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      hapticSelection();
      setCurrentSlide((prev) => prev + 1);
    } else {
      hapticSuccess();
      setCurrentSlide(0);
      onClose();
    }
  };

  const handleSkip = () => {
    hapticLight();
    setCurrentSlide(0);
    onClose();
  };

  const slide = SLIDES[currentSlide];
  const IconComponent = slide.icon;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
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
                  <ChevronRight size={16} color="#090A0E" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.finishBtn} onPress={handleNext}>
                <Text style={styles.finishBtnText}>Mulai Gunakan UangKu</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 14, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#12141D',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#090A0E',
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
    color: '#090A0E',
  },
});
