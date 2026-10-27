import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react-native';
import { colors, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/themeContext';
import { hapticSuccess, hapticError, hapticMedium, hapticSelection } from '../theme/haptics';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showSuccess: (title: string, message?: string, duration?: number) => void;
  showError: (title: string, message?: string, duration?: number) => void;
  showInfo: (title: string, message?: string, duration?: number) => void;
  showWarning: (title: string, message?: string, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showSuccess: () => {},
  showError: () => {},
  showInfo: () => {},
  showWarning: () => {},
  hideToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [toast, setToast] = useState<ToastItem | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [translateY, opacity]);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 3500) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      setToast({ id: Math.random().toString(), type, title, message, duration });

      // Trigger respective haptic pattern
      if (type === 'success') {
        hapticSuccess();
      } else if (type === 'error') {
        hapticError();
      } else {
        hapticMedium();
      }

      // Animate entry
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      hideTimerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [translateY, opacity, hideToast]
  );

  const showSuccess = useCallback(
    (title: string, message?: string, duration?: number) => showToast('success', title, message, duration),
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string, duration?: number) => showToast('error', title, message, duration),
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string, duration?: number) => showToast('info', title, message, duration),
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string, duration?: number) => showToast('warning', title, message, duration),
    [showToast]
  );

  const getToastConfig = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 size={18} color={colors.flow.income} strokeWidth={2.5} />,
          borderColor: colors.flow.incomeBorder,
          bgColor: 'rgba(16, 185, 129, 0.14)',
          indicatorColor: colors.flow.income,
        };
      case 'error':
        return {
          icon: <AlertCircle size={18} color={colors.flow.expense} strokeWidth={2.5} />,
          borderColor: colors.flow.expenseBorder,
          bgColor: 'rgba(239, 68, 68, 0.16)',
          indicatorColor: colors.flow.expense,
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={18} color={colors.gold.primary} strokeWidth={2.5} />,
          borderColor: colors.gold.hairline,
          bgColor: 'rgba(212, 175, 55, 0.14)',
          indicatorColor: colors.gold.primary,
        };
      case 'info':
      default:
        return {
          icon: <Info size={18} color={colors.flow.transfer} strokeWidth={2.5} />,
          borderColor: colors.flow.transferBorder,
          bgColor: 'rgba(56, 189, 248, 0.14)',
          indicatorColor: colors.flow.transfer,
        };
    }
  };

  const currentConfig = toast ? getToastConfig(toast.type) : null;

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo, showWarning, hideToast }}>
      {children}
      {toast && currentConfig && (
        <SafeAreaView pointerEvents="box-none" style={styles.toastContainer}>
          <Animated.View
            style={[
              styles.toastCard,
              {
                backgroundColor: colors.bg.surface,
                borderColor: currentConfig.borderColor,
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={[styles.indicatorStrip, { backgroundColor: currentConfig.indicatorColor }]} />
            <View style={[styles.iconWrapper, { backgroundColor: currentConfig.bgColor }]}>
              {currentConfig.icon}
            </View>
            <View style={styles.textWrapper}>
              <Text style={styles.toastTitle} numberOfLines={1}>
                {toast.title}
              </Text>
              {Boolean(toast.message) && (
                <Text style={styles.toastMessage} numberOfLines={2}>
                  {toast.message}
                </Text>
              )}
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.closeBtn}
              onPress={() => {
                hapticSelection();
                hideToast();
              }}
            >
              <X size={14} color={colors.text.muted} strokeWidth={2.2} />
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 24 : 12,
    left: 16,
    right: 16,
    zIndex: 99999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  indicatorStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  toastMessage: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 15,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
