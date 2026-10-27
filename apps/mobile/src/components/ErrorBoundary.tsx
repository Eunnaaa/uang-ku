import React, { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { ShieldAlert, RefreshCw } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { hapticMedium } from '../theme/haptics';
import { telemetryService } from '../services/telemetryService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled React Error in UangKu Mobile:', error, errorInfo);
    telemetryService.recordCrash(error, {
      screen: 'ErrorBoundaryRoot',
      action: 'react_lifecycle_render_error',
      extra: { componentStack: errorInfo.componentStack?.slice(0, 500) },
    });
  }

  handleReload = () => {
    hapticMedium();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.iconCircle}>
              <ShieldAlert size={42} color={colors.gold.primary} strokeWidth={2} />
            </View>

            <Text style={styles.title}>Terjadi Kendala Tampilan</Text>
            <Text style={styles.description}>
              Tenang, data finansial Anda tetap tersimpan aman di basis data lokal. Ketuk tombol di bawah untuk memuat ulang halaman.
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.debugBox}>
                <Text style={styles.debugText} numberOfLines={4}>
                  {this.state.error.message}
                </Text>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.reloadBtn}
              onPress={this.handleReload}
            >
              <RefreshCw size={18} color="#090A0E" strokeWidth={2.4} />
              <Text style={styles.reloadBtnText}>Muat Ulang Halaman</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  debugBox: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: colors.flow.expenseBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  debugText: {
    color: colors.flow.expense,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
    width: '100%',
    shadowColor: colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  reloadBtnText: {
    color: '#090A0E',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
