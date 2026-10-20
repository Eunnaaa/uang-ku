import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Easing,
  Platform,
} from 'react-native';
import { Sparkles, Shield, ChevronRight, Zap } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { hapticMedium, hapticSuccess, hapticSelection } from '../theme/haptics';

interface IntroAnimationScreenProps {
  onFinish: () => void;
}

const { width, height } = Dimensions.get('window');

export function IntroAnimationScreen({ onFinish }: IntroAnimationScreenProps) {
  // Animation values
  const logoScale = useRef(new Animated.Value(0.2)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.85)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(24)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    hapticSelection();

    // 1. Rotating Halo Ring Loop
    const rotateLoop = Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateLoop.start();

    // 2. Pulsing Ring Scale Loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.08,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 0.95,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 3. Staggered sequence for logo entrance
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(badgeOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Progress bar loading to 100%
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Auto transition to welcome page after completion
      hapticSuccess();
      setTimeout(handleComplete, 300);
    });

    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  const handleComplete = () => {
    hapticMedium();
    Animated.timing(screenFade, {
      toValue: 0,
      duration: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      onFinish();
    });
  };

  const spin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenFade }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header with Skip Button */}
        <View style={styles.topBar}>
          <View style={styles.statusPill}>
            <Zap size={11} color={colors.gold.champagne} />
            <Text style={styles.statusPillText}>FAST & SECURE</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.skipBtn}
            onPress={handleComplete}
          >
            <Text style={styles.skipText}>Lewati</Text>
            <ChevronRight size={14} color={colors.gold.champagne} />
          </TouchableOpacity>
        </View>

        {/* Central Animation Sphere */}
        <View style={styles.centerStage}>
          {/* Ambient Gold Glow Aura */}
          <Animated.View
            style={[
              styles.ambientGlow,
              {
                opacity: glowOpacity,
              },
            ]}
          />

          {/* Outer Dashed Rotating Ring */}
          <Animated.View
            style={[
              styles.outerRing,
              {
                transform: [{ rotate: spin }, { scale: ringScale }],
              },
            ]}
          />

          {/* Inner Shimmering Ring */}
          <Animated.View
            style={[
              styles.innerRing,
              {
                transform: [{ scale: ringScale }],
              },
            ]}
          />

          {/* Center Luxury Emblem */}
          <Animated.View
            style={[
              styles.emblemContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <View style={styles.emblemInner}>
              <Sparkles size={46} color="#D4AF37" strokeWidth={2.4} />
            </View>
          </Animated.View>

          {/* Luxury Brand Typography */}
          <Animated.View
            style={[
              styles.brandTextWrap,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            <Text style={styles.brandTitle}>UANGKU</Text>
            <Text style={styles.brandSubtitle}>KEMEWAHAN FINANSIAL DALAM GENGGAMAN</Text>
          </Animated.View>

          {/* Luxury Feature Badge */}
          <Animated.View style={[styles.badgeWrap, { opacity: badgeOpacity }]}>
            <View style={styles.badgePill}>
              <Shield size={12} color={colors.gold.champagne} />
              <Text style={styles.badgeText}>SQLite Local-First • 10-Second Entry</Text>
            </View>
          </Animated.View>
        </View>

        {/* Bottom Loading Progress Indicator */}
        <View style={styles.bottomSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressStatusText}>Menyiapkan Ruang Finansial...</Text>
            <Text style={styles.versionText}>v1.0.0</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressWidth,
                },
              ]}
            />
          </View>

          {/* Action Trigger Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.continueBtn}
            onPress={handleComplete}
          >
            <Text style={styles.continueBtnText}>Lanjutkan ke Pengenalan</Text>
            <ChevronRight size={16} color="#090A0E" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#07080B',
    zIndex: 999999,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 0.8,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: 0.8,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
  },
  outerRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    borderStyle: 'dashed',
  },
  innerRing: {
    position: 'absolute',
    width: 135,
    height: 135,
    borderRadius: 67.5,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  emblemContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#12141D',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },
  emblemInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  brandTextWrap: {
    alignItems: 'center',
    marginTop: 36,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F3E5AB',
    letterSpacing: 8,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.muted,
    letterSpacing: 2,
    marginTop: 6,
    textAlign: 'center',
  },
  badgeWrap: {
    marginTop: 22,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  bottomSection: {
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    width: '100%',
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStatusText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.muted,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gold.champagne,
    letterSpacing: 0.5,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D4AF37',
    borderRadius: 2,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 8,
    shadowColor: colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  continueBtnText: {
    color: '#090A0E',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
