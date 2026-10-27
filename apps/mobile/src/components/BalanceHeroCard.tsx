import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Repeat, ArrowUpRight, ArrowDownLeft, ShieldCheck, Eye, EyeOff, TrendingUp, TrendingDown } from 'lucide-react-native';
import { formatRupiah } from '@uangku/contracts';
import { colors, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/themeContext';
import { hapticMedium, hapticSelection, hapticLight } from '../theme/haptics';

interface BalanceHeroCardProps {
  totalNetWorth: number;
  availableNetWorth?: number;
  totalReserved?: number;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  initialMasked?: boolean;
  onPressAdd: () => void;
  onPressTransfer: () => void;
}

export function BalanceHeroCard({
  totalNetWorth,
  availableNetWorth,
  totalReserved = 0,
  totalIncome,
  totalExpense,
  netCashFlow,
  initialMasked = false,
  onPressAdd,
  onPressTransfer,
}: BalanceHeroCardProps) {
  const { colors, isDark } = useTheme();
  const [isBalanceVisible, setIsBalanceVisible] = useState(!initialMasked);

  React.useEffect(() => {
    setIsBalanceVisible(!initialMasked);
  }, [initialMasked]);

  const isNetPositive = netCashFlow >= 0;
  const currentPeriod = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date());

  const effectiveAvailable = availableNetWorth ?? Math.max(0, totalNetWorth - totalReserved);

  const toggleVisibility = () => {
    hapticLight();
    setIsBalanceVisible((prev) => !prev);
  };

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.cardContainer}>
      {/* Header Label */}
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <ShieldCheck size={12} color={colors.gold.champagne} />
          <Text style={styles.badgeText}>TOTAL ASSETS</Text>
        </View>
        <View style={styles.periodPill}>
          <Text style={styles.periodText}>{currentPeriod}</Text>
        </View>
      </View>

      {/* Main Net Worth Balance Amount with Mask Toggle */}
      <View style={styles.balanceContainer}>
        <Text
          style={styles.balanceAmount}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {isBalanceVisible ? formatRupiah(totalNetWorth) : '••••••••••••'}
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={toggleVisibility}
          style={styles.eyeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {isBalanceVisible ? (
            <Eye size={18} color={colors.text.muted} />
          ) : (
            <EyeOff size={18} color={colors.gold.champagne} />
          )}
        </TouchableOpacity>
      </View>

      {/* Reserved / Locked Balance Breakdown (PRD Section 66.2 & Section 75) */}
      {totalReserved > 0 && (
        <View style={styles.reservedSubRow}>
          <Text style={styles.reservedSubText}>
            Dapat Dibelanjakan:{' '}
            <Text style={styles.reservedHighlight}>
              {isBalanceVisible ? formatRupiah(effectiveAvailable) : '••••••'}
            </Text>
            {'  '}•{'  '}Terkunci:{' '}
            <Text style={styles.reservedMuted}>
              {isBalanceVisible ? formatRupiah(totalReserved) : '••••••'}
            </Text>
          </Text>
        </View>
      )}

      {/* Monthly Cash Flow Split Row */}
      <View style={styles.flowRow}>
        {/* Income Column */}
        <View style={styles.flowCol}>
          <View style={styles.flowHeaderRow}>
            <View style={[styles.flowIconCircle, { backgroundColor: colors.flow.incomeBg, borderColor: colors.flow.incomeBorder }]}>
              <ArrowDownLeft size={11} color={colors.flow.income} />
            </View>
            <Text style={styles.flowLabel}>Pemasukan</Text>
          </View>
          <Text
            style={[styles.flowValue, { color: colors.flow.income }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {isBalanceVisible ? `+${formatRupiah(totalIncome)}` : '••••••'}
          </Text>
        </View>

        {/* Vertical Divider */}
        <View style={styles.flowDivider} />

        {/* Expense Column */}
        <View style={[styles.flowCol, styles.flowColRight]}>
          <View style={styles.flowHeaderRow}>
            <View style={[styles.flowIconCircle, { backgroundColor: colors.flow.expenseBg, borderColor: colors.flow.expenseBorder }]}>
              <ArrowUpRight size={11} color={colors.flow.expense} />
            </View>
            <Text style={styles.flowLabel}>Pengeluaran</Text>
          </View>
          <Text
            style={[styles.flowValue, { color: colors.flow.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {isBalanceVisible ? `-${formatRupiah(totalExpense)}` : '••••••'}
          </Text>
        </View>
      </View>

      {/* Net Cash Flow Capsule Banner */}
      <View
        style={[
          styles.netCashFlowBanner,
          {
            backgroundColor: isNetPositive ? colors.flow.incomeBg : colors.flow.expenseBg,
            borderColor: isNetPositive ? colors.flow.incomeBorder : colors.flow.expenseBorder,
          },
        ]}
      >
        <View style={styles.netCashFlowLeft}>
          {isNetPositive ? (
            <TrendingUp size={13} color={colors.flow.income} />
          ) : (
            <TrendingDown size={13} color={colors.flow.expense} />
          )}
          <Text style={styles.netCashFlowLabel}>Arus Kas Bersih Bulan Ini</Text>
        </View>
        <Text
          style={[
            styles.netCashFlowValue,
            { color: isNetPositive ? colors.flow.income : colors.flow.expense },
          ]}
        >
          {isBalanceVisible
            ? `${isNetPositive ? '+' : ''}${formatRupiah(netCashFlow)}`
            : '••••••'}
        </Text>
      </View>

      {/* Primary Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.actionBtn, styles.primaryBtn]}
          onPress={() => {
            hapticMedium();
            onPressAdd();
          }}
        >
          <Plus size={16} color="#090A0E" strokeWidth={2.5} />
          <Text style={styles.primaryBtnText}>Catat Transaksi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.actionBtn, styles.secondaryBtn]}
          onPress={() => {
            hapticSelection();
            onPressTransfer();
          }}
        >
          <Repeat size={16} color={colors.gold.champagne} />
          <Text style={styles.secondaryBtnText}>Transfer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    cardContainer: {
      backgroundColor: colors.bg.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: isDark ? colors.gold.hairline : colors.border.subtle,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.35 : 0.06,
      shadowRadius: 14,
      elevation: 3,
      position: 'relative',
      overflow: 'hidden',
      marginBottom: 20,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.08)',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      gap: 5,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 83, 9, 0.2)',
    },
    badgeText: {
      color: colors.gold.champagne,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    periodPill: {
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 83, 9, 0.06)',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(180, 83, 9, 0.15)',
    },
    periodText: {
      color: colors.gold.champagne,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    balanceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 10,
    },
    balanceAmount: {
      color: colors.text.primary,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
      flex: 1,
    },
    eyeBtn: {
      padding: 6,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
      borderWidth: 0.5,
      borderColor: colors.border.subtle,
      marginLeft: 8,
    },
    reservedSubRow: {
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 83, 9, 0.08)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      alignSelf: 'flex-start',
      marginBottom: 6,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(180, 83, 9, 0.2)',
    },
    reservedSubText: {
      fontSize: 11,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    reservedHighlight: {
      color: colors.gold.champagne,
      fontWeight: '700',
    },
    reservedMuted: {
      color: colors.text.muted,
      fontWeight: '600',
    },
    flowRow: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.bg.elevated,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    flowCol: {
      flex: 1,
      paddingRight: 14,
    },
    flowColRight: {
      paddingRight: 0,
      paddingLeft: 14,
    },
    flowHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 5,
    },
    flowIconCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
    },
    flowLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.text.muted,
    },
    flowValue: {
      fontSize: 14,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    flowDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border.subtle,
    },
    netCashFlowBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 16,
    },
    netCashFlowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    netCashFlowLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    netCashFlowValue: {
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      gap: 6,
    },
    primaryBtn: {
      flex: 1.6,
      backgroundColor: colors.gold.primary,
      shadowColor: colors.gold.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
    },
    primaryBtnText: {
      color: '#090A0E',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    secondaryBtn: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(180, 83, 9, 0.3)',
    },
    secondaryBtnText: {
      color: colors.gold.champagne,
      fontSize: 13,
      fontWeight: '600',
    },
  });
