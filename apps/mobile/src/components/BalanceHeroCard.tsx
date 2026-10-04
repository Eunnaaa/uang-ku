import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Repeat, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react-native';
import { formatRupiah } from '@uangku/contracts';
import { colors } from '../theme/colors';
import { hapticMedium, hapticSelection } from '../theme/haptics';

interface BalanceHeroCardProps {
  totalNetWorth: number;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  onPressAdd: () => void;
  onPressTransfer: () => void;
}

export function BalanceHeroCard({
  totalNetWorth,
  totalIncome,
  totalExpense,
  netCashFlow,
  onPressAdd,
  onPressTransfer,
}: BalanceHeroCardProps) {
  const isNetPositive = netCashFlow >= 0;

  return (
    <View style={styles.cardContainer}>
      {/* Background Glow */}
      <View style={styles.glowOverlay} />

      {/* Header Label */}
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <ShieldCheck size={12} color={colors.gold.champagne} />
          <Text style={styles.badgeText}>TOTAL KEKAYAAN BERSIH</Text>
        </View>
        <Text style={styles.periodText}>Oktober 2026</Text>
      </View>

      {/* Hero Balance */}
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceAmount}>{formatRupiah(totalNetWorth)}</Text>
      </View>

      {/* Monthly Cash Flow Pills */}
      <View style={styles.flowRow}>
        <View style={styles.flowItem}>
          <View style={[styles.flowIconCircle, { backgroundColor: colors.flow.incomeBg }]}>
            <ArrowDownLeft size={14} color={colors.flow.income} />
          </View>
          <View>
            <Text style={styles.flowLabel}>Pemasukan</Text>
            <Text style={[styles.flowValue, { color: colors.flow.income }]}>
              +{formatRupiah(totalIncome)}
            </Text>
          </View>
        </View>

        <View style={styles.flowDivider} />

        <View style={styles.flowItem}>
          <View style={[styles.flowIconCircle, { backgroundColor: colors.flow.expenseBg }]}>
            <ArrowUpRight size={14} color={colors.flow.expense} />
          </View>
          <View>
            <Text style={styles.flowLabel}>Pengeluaran</Text>
            <Text style={[styles.flowValue, { color: colors.flow.expense }]}>
              -{formatRupiah(totalExpense)}
            </Text>
          </View>
        </View>
      </View>

      {/* Net Cash Flow Banner */}
      <View style={styles.netCashFlowBanner}>
        <Text style={styles.netCashFlowLabel}>Arus Kas Bersih Bulan Ini</Text>
        <Text style={[styles.netCashFlowValue, { color: isNetPositive ? colors.flow.income : colors.flow.expense }]}>
          {isNetPositive ? '+' : ''}{formatRupiah(netCashFlow)}
        </Text>
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.actionBtn, styles.primaryBtn]}
          onPress={() => {
            hapticMedium();
            onPressAdd();
          }}
        >
          <Plus size={18} color={colors.text.inverse} strokeWidth={2.5} />
          <Text style={styles.primaryBtnText}>Catat Transaksi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
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

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#12141D',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    shadowColor: colors.gold.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
  },
  glowOverlay: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
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
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  badgeText: {
    color: colors.gold.champagne,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  periodText: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  balanceContainer: {
    marginVertical: 10,
  },
  balanceAmount: {
    color: colors.text.primary,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  flowRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(26, 29, 39, 0.8)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  flowItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flowIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowLabel: {
    fontSize: 11,
    color: colors.text.muted,
  },
  flowValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  flowDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.subtle,
    marginHorizontal: 8,
  },
  netCashFlowBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  netCashFlowLabel: {
    fontSize: 12,
    color: colors.text.secondary,
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
  },
  primaryBtnText: {
    color: '#090A0E',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.gold.hairline,
  },
  secondaryBtnText: {
    color: colors.gold.champagne,
    fontSize: 13,
    fontWeight: '600',
  },
});
