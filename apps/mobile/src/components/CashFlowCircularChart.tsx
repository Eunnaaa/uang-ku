import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
} from 'lucide-react-native';
import { formatRupiah, formatCompactRupiah } from '@uangku/contracts';
import { type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/themeContext';
import { hapticSelection } from '../theme/haptics';

interface CashFlowCircularChartProps {
  inflow: number;
  outflow: number;
  netCashFlow: number;
  totalFees?: number;
}

export function CashFlowCircularChart({
  inflow,
  outflow,
  netCashFlow,
  totalFees = 0,
}: CashFlowCircularChartProps) {
  const { colors, isDark } = useTheme();
  const [selectedSegment, setSelectedSegment] = useState<'all' | 'inflow' | 'outflow' | 'net'>('all');

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const totalFlow = inflow + outflow;
  const isZero = totalFlow === 0;

  // Percentage calculations
  const inflowRatio = totalFlow > 0 ? Math.round((inflow / totalFlow) * 100) : 0;
  const outflowRatio = totalFlow > 0 ? 100 - inflowRatio : 0;
  const savingsRate =
    inflow > 0 ? Math.max(0, Math.round(((inflow - outflow - totalFees) / inflow) * 100)) : 0;

  // SVG Geometry
  const size = 190;
  const strokeWidth = 16;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  // Arcs
  const inflowStroke = totalFlow > 0 ? (inflowRatio / 100) * circumference : 0;
  const outflowStroke = totalFlow > 0 ? (outflowRatio / 100) * circumference : 0;

  // Subtle gap between arcs if both exist for modern aesthetics
  const hasBoth = inflow > 0 && outflow > 0;
  const gap = hasBoth ? 4 : 0;
  const adjInflowStroke = Math.max(0, inflowStroke - gap);
  const adjOutflowStroke = Math.max(0, outflowStroke - gap);

  const isNetPositive = netCashFlow > 0;
  const isNetZero = netCashFlow === 0;

  const handlePressSegment = (segment: 'all' | 'inflow' | 'outflow' | 'net') => {
    hapticSelection();
    setSelectedSegment((prev) => (prev === segment ? 'all' : segment));
  };

  return (
    <View style={styles.cardContainer}>
      {/* 1. Header Row */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.headerTagRow}>
            <PieChart size={12} color={colors.gold.champagne} />
            <Text style={styles.headerTag}>ANALISIS ARUS KAS</Text>
          </View>
          <Text style={styles.headerMainTitle}>Komposisi Inflow vs Outflow</Text>
        </View>

        <View style={styles.savingsRateBadge}>
          <Sparkles size={11} color={colors.gold.champagne} />
          <Text style={styles.savingsRateText}>
            {isZero ? '0% Rasio' : `${savingsRate}% Tabungan`}
          </Text>
        </View>
      </View>

      {/* 2. Donut Graphic Center Stage */}
      <View style={styles.chartWrapper}>
        <View style={styles.svgContainer}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <G rotation="-90" origin={`${center}, ${center}`}>
              {/* Background Track Ring */}
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
                strokeWidth={strokeWidth}
                fill="none"
              />

              {/* Inflow Arc (Pemasukan) */}
              {!isZero && inflow > 0 && (
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={colors.flow.income}
                  strokeWidth={selectedSegment === 'inflow' ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={`${adjInflowStroke} ${circumference}`}
                  strokeDashoffset={0}
                  strokeLinecap={hasBoth ? 'round' : 'butt'}
                  fill="none"
                  opacity={selectedSegment === 'all' || selectedSegment === 'inflow' ? 1 : 0.3}
                />
              )}

              {/* Outflow Arc (Pengeluaran) */}
              {!isZero && outflow > 0 && (
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={colors.flow.expense}
                  strokeWidth={selectedSegment === 'outflow' ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={`${adjOutflowStroke} ${circumference}`}
                  strokeDashoffset={-inflowStroke}
                  strokeLinecap={hasBoth ? 'round' : 'butt'}
                  fill="none"
                  opacity={selectedSegment === 'all' || selectedSegment === 'outflow' ? 1 : 0.3}
                />
              )}
            </G>
          </Svg>

          {/* Center Hole Content */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.centerOverlay}
            onPress={() => handlePressSegment('net')}
          >
            <Text style={styles.centerSubLabel}>
              {selectedSegment === 'inflow'
                ? 'TOTAL INFLOW'
                : selectedSegment === 'outflow'
                ? 'TOTAL OUTFLOW'
                : 'SISA KAS BERSIH'}
            </Text>
            <Text
              style={[
                styles.centerMainValue,
                {
                  color:
                    selectedSegment === 'inflow'
                      ? colors.flow.income
                      : selectedSegment === 'outflow'
                      ? colors.flow.expense
                      : isNetZero
                      ? colors.text.secondary
                      : isNetPositive
                      ? colors.flow.income
                      : colors.flow.expense,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {selectedSegment === 'inflow'
                ? `+${formatCompactRupiah(inflow)}`
                : selectedSegment === 'outflow'
                ? `-${formatCompactRupiah(outflow)}`
                : isNetPositive
                ? `+${formatCompactRupiah(netCashFlow)}`
                : formatCompactRupiah(netCashFlow)}
            </Text>

            <View
              style={[
                styles.centerStatusBadge,
                {
                  backgroundColor:
                    selectedSegment === 'inflow'
                      ? colors.flow.incomeBg
                      : selectedSegment === 'outflow'
                      ? colors.flow.expenseBg
                      : isNetZero
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.05)'
                      : isNetPositive
                      ? colors.flow.incomeBg
                      : colors.flow.expenseBg,
                  borderColor:
                    selectedSegment === 'inflow'
                      ? colors.flow.incomeBorder
                      : selectedSegment === 'outflow'
                      ? colors.flow.expenseBorder
                      : isNetZero
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.08)'
                      : isNetPositive
                      ? colors.flow.incomeBorder
                      : colors.flow.expenseBorder,
                },
              ]}
            >
              {isZero ? (
                <Text style={styles.centerStatusTextMuted}>Belum Ada Kas</Text>
              ) : selectedSegment === 'inflow' ? (
                <Text style={[styles.centerStatusText, { color: colors.flow.income }]}>
                  {inflowRatio}% Inflow
                </Text>
              ) : selectedSegment === 'outflow' ? (
                <Text style={[styles.centerStatusText, { color: colors.flow.expense }]}>
                  {outflowRatio}% Outflow
                </Text>
              ) : isNetPositive ? (
                <View style={styles.badgeRow}>
                  <TrendingUp size={11} color={colors.flow.income} />
                  <Text style={[styles.centerStatusText, { color: colors.flow.income }]}>
                    Surplus
                  </Text>
                </View>
              ) : isNetZero ? (
                <Text style={styles.centerStatusTextMuted}>Seimbang</Text>
              ) : (
                <View style={styles.badgeRow}>
                  <TrendingDown size={11} color={colors.flow.expense} />
                  <Text style={[styles.centerStatusText, { color: colors.flow.expense }]}>
                    Defisit
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Balanced Two-Column Flow Cards (Inflow & Outflow) */}
      <View style={styles.flowCardsRow}>
        {/* Inflow Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.flowCard,
            selectedSegment === 'inflow' && styles.flowCardActive,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.07)',
              borderColor:
                selectedSegment === 'inflow'
                  ? colors.flow.income
                  : isDark
                  ? 'rgba(16, 185, 129, 0.22)'
                  : 'rgba(16, 185, 129, 0.25)',
            },
          ]}
          onPress={() => handlePressSegment('inflow')}
        >
          <View style={styles.flowCardHeader}>
            <View
              style={[
                styles.flowIconBadge,
                { backgroundColor: colors.flow.incomeBg, borderColor: colors.flow.incomeBorder },
              ]}
            >
              <ArrowDownLeft size={13} color={colors.flow.income} strokeWidth={2.4} />
            </View>
            <View style={styles.flowCardTitleCol}>
              <Text style={styles.flowCardTypeLabel}>Inflow</Text>
              <Text style={styles.flowCardSubText}>Pemasukan</Text>
            </View>
            <View style={[styles.flowPctPill, { backgroundColor: colors.flow.incomeBg }]}>
              <Text style={[styles.flowPctText, { color: colors.flow.income }]}>{inflowRatio}%</Text>
            </View>
          </View>

          <Text
            style={[styles.flowAmountValue, { color: colors.flow.income }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            +{formatRupiah(inflow)}
          </Text>

          {/* Mini Ratio Bar */}
          <View style={styles.miniBarTrack}>
            <View
              style={[
                styles.miniBarFill,
                {
                  width: `${Math.min(100, Math.max(isZero ? 0 : 3, inflowRatio))}%`,
                  backgroundColor: colors.flow.income,
                },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* Outflow Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.flowCard,
            selectedSegment === 'outflow' && styles.flowCardActive,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.07)',
              borderColor:
                selectedSegment === 'outflow'
                  ? colors.flow.expense
                  : isDark
                  ? 'rgba(239, 68, 68, 0.22)'
                  : 'rgba(239, 68, 68, 0.25)',
            },
          ]}
          onPress={() => handlePressSegment('outflow')}
        >
          <View style={styles.flowCardHeader}>
            <View
              style={[
                styles.flowIconBadge,
                { backgroundColor: colors.flow.expenseBg, borderColor: colors.flow.expenseBorder },
              ]}
            >
              <ArrowUpRight size={13} color={colors.flow.expense} strokeWidth={2.4} />
            </View>
            <View style={styles.flowCardTitleCol}>
              <Text style={styles.flowCardTypeLabel}>Outflow</Text>
              <Text style={styles.flowCardSubText}>Pengeluaran</Text>
            </View>
            <View style={[styles.flowPctPill, { backgroundColor: colors.flow.expenseBg }]}>
              <Text style={[styles.flowPctText, { color: colors.flow.expense }]}>
                {outflowRatio}%
              </Text>
            </View>
          </View>

          <Text
            style={[styles.flowAmountValue, { color: colors.flow.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            -{formatRupiah(outflow)}
          </Text>

          {/* Mini Ratio Bar */}
          <View style={styles.miniBarTrack}>
            <View
              style={[
                styles.miniBarFill,
                {
                  width: `${Math.min(100, Math.max(isZero ? 0 : 3, outflowRatio))}%`,
                  backgroundColor: colors.flow.expense,
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* 4. Full-Width Net Cashflow Hero Row */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.netCashHeroCard,
          selectedSegment === 'net' && styles.netCashHeroActive,
        ]}
        onPress={() => handlePressSegment('net')}
      >
        <View style={styles.netCashLeft}>
          <View
            style={[
              styles.netIconBadge,
              {
                backgroundColor: isNetZero
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.05)'
                  : isNetPositive
                  ? 'rgba(212, 175, 55, 0.14)'
                  : colors.flow.expenseBg,
                borderColor: isNetZero
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.08)'
                  : isNetPositive
                  ? 'rgba(212, 175, 55, 0.35)'
                  : colors.flow.expenseBorder,
              },
            ]}
          >
            {isNetZero ? (
              <Wallet size={16} color={colors.text.muted} strokeWidth={2.2} />
            ) : isNetPositive ? (
              <Sparkles size={16} color={colors.gold.champagne} strokeWidth={2.2} />
            ) : (
              <TrendingDown size={16} color={colors.flow.expense} strokeWidth={2.2} />
            )}
          </View>
          <View style={styles.netCashInfoCol}>
            <Text style={styles.netCashTitle}>Arus Kas Bersih (Net Cashflow)</Text>
            <Text style={styles.netCashDescription}>
              {isZero
                ? 'Belum ada mutasi kas periode ini'
                : isNetPositive
                ? `Rasio tabungan ${savingsRate}% dari total pemasukan`
                : 'Pengeluaran melebihi total pemasukan'}
            </Text>
          </View>
        </View>

        <View style={styles.netCashRight}>
          <Text
            style={[
              styles.netCashValueText,
              {
                color: isNetZero
                  ? colors.text.secondary
                  : isNetPositive
                  ? colors.flow.income
                  : colors.flow.expense,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {isNetPositive && !isNetZero ? '+' : ''}
            {formatRupiah(netCashFlow)}
          </Text>
          <View
            style={[
              styles.netCashSavingsPill,
              {
                backgroundColor: isNetZero
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.05)'
                  : isNetPositive
                  ? colors.flow.incomeBg
                  : colors.flow.expenseBg,
              },
            ]}
          >
            <Text
              style={[
                styles.netCashSavingsText,
                {
                  color: isNetZero
                    ? colors.text.muted
                    : isNetPositive
                    ? colors.flow.income
                    : colors.flow.expense,
                },
              ]}
            >
              {isNetZero ? '0% Rasio' : isNetPositive ? `${savingsRate}% Disimpan` : 'Defisit'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* 5. Transfer Fees Notice if exists */}
      {totalFees > 0 && (
        <View style={styles.feesNoticeContainer}>
          <Text style={styles.feesNoticeLabel}>Termasuk biaya admin/transfer:</Text>
          <Text style={styles.feesNoticeValue}>-{formatRupiah(totalFees)}</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    cardContainer: {
      backgroundColor: colors.bg.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.22)' : 'rgba(180, 83, 9, 0.2)',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.35 : 0.05,
      shadowRadius: 10,
      elevation: isDark ? 0 : 3,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitleWrap: {
      flex: 1,
    },
    headerTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 2,
    },
    headerTag: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.gold.champagne,
      letterSpacing: 1.2,
    },
    headerMainTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
      letterSpacing: -0.3,
    },
    savingsRateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 0.8,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.32)' : 'rgba(180, 83, 9, 0.25)',
    },
    savingsRateText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold.champagne,
      fontVariant: ['tabular-nums'],
    },

    // Chart Center Stage
    chartWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 8,
    },
    svgContainer: {
      width: 190,
      height: 190,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerOverlay: {
      position: 'absolute',
      width: 126,
      height: 126,
      borderRadius: 63,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    centerSubLabel: {
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 1,
      marginBottom: 2,
      textAlign: 'center',
    },
    centerMainValue: {
      fontSize: 18,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.5,
      marginBottom: 5,
      textAlign: 'center',
    },
    centerStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3.5,
      borderRadius: 8,
      borderWidth: 0.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerStatusText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    centerStatusTextMuted: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text.muted,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },

    // 2 Flow Cards Row
    flowCardsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
      marginBottom: 10,
    },
    flowCard: {
      flex: 1,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
    },
    flowCardActive: {
      borderWidth: 1.8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    flowCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    flowIconBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.6,
      marginRight: 6,
    },
    flowCardTitleCol: {
      flex: 1,
    },
    flowCardTypeLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.text.primary,
    },
    flowCardSubText: {
      fontSize: 9.5,
      color: colors.text.muted,
    },
    flowPctPill: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
    },
    flowPctText: {
      fontSize: 10.5,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    flowAmountValue: {
      fontSize: 14,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      marginBottom: 8,
    },
    miniBarTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      overflow: 'hidden',
    },
    miniBarFill: {
      height: '100%',
      borderRadius: 2,
    },

    // Net Cashflow Hero Row
    netCashHeroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.bg.elevated,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(180, 83, 9, 0.18)',
    },
    netCashHeroActive: {
      borderWidth: 1.8,
      borderColor: colors.gold.primary,
    },
    netCashLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 10,
    },
    netIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.8,
      marginRight: 10,
    },
    netCashInfoCol: {
      flex: 1,
    },
    netCashTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 2,
    },
    netCashDescription: {
      fontSize: 10,
      color: colors.text.muted,
    },
    netCashRight: {
      alignItems: 'flex-end',
    },
    netCashValueText: {
      fontSize: 14,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      marginBottom: 3,
    },
    netCashSavingsPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    netCashSavingsText: {
      fontSize: 9.5,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },

    // Fees Notice
    feesNoticeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 0.8,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    },
    feesNoticeLabel: {
      fontSize: 10.5,
      color: colors.text.muted,
    },
    feesNoticeValue: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.flow.expense,
      fontVariant: ['tabular-nums'],
    },
  });
}
