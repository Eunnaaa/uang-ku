import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Repeat, PieChart, Sparkles } from 'lucide-react-native';
import { formatRupiah } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import { getLocalTransactions } from '../../src/db/sqlite';

interface CategoryBreakdownItem {
  id: string;
  name: string;
  amount: number;
  percentage: number;
}

export default function ReportsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    totalFees: 0,
    netCashFlow: 0,
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);

  const loadReportData = useCallback(async () => {
    try {
      const allTx = await getLocalTransactions();
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const monthlyTx = allTx.filter((t) => t.transactionDate.startsWith(currentMonth));

      let income = 0;
      let expense = 0;
      let fees = 0;
      const catMap = new Map<string, { id: string; name: string; amount: number }>();

      for (const t of monthlyTx) {
        if (t.type === 'income') {
          income += t.amount;
        } else if (t.type === 'expense') {
          expense += t.amount;
          const catId = t.categoryId || 'other';
          const catName = t.category?.name || 'Lainnya';
          const existing = catMap.get(catId);
          if (existing) {
            existing.amount += t.amount;
          } else {
            catMap.set(catId, { id: catId, name: catName, amount: t.amount });
          }
        } else if (t.type === 'transfer') {
          fees += t.transferFee || 0;
        }
      }

      setSummary({
        totalIncome: income,
        totalExpense: expense,
        totalFees: fees,
        netCashFlow: income - expense - fees,
      });

      const list: CategoryBreakdownItem[] = Array.from(catMap.values()).map((c) => ({
        id: c.id,
        name: c.name,
        amount: c.amount,
        percentage: expense > 0 ? Math.round((c.amount / expense) * 100) : 0,
      }));

      list.sort((a, b) => b.amount - a.amount);
      setCategoryBreakdown(list);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const isNetPositive = summary.netCashFlow >= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Laporan Keuangan</Text>
        <Text style={styles.periodText}>Periode: Oktober 2026</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.champagne}
          />
        }
      >
        {/* Cash Flow Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardSectionLabel}>ARUS KAS BULAN INI</Text>

          <View style={styles.flowRow}>
            <View style={styles.flowCol}>
              <View style={styles.labelWithIcon}>
                <ArrowDownLeft size={14} color={colors.flow.income} />
                <Text style={styles.flowLabel}>Total Pemasukan</Text>
              </View>
              <Text style={[styles.flowValue, { color: colors.flow.income }]}>
                +{formatRupiah(summary.totalIncome)}
              </Text>
            </View>

            <View style={styles.flowCol}>
              <View style={styles.labelWithIcon}>
                <ArrowUpRight size={14} color={colors.flow.expense} />
                <Text style={styles.flowLabel}>Total Pengeluaran</Text>
              </View>
              <Text style={[styles.flowValue, { color: colors.flow.expense }]}>
                -{formatRupiah(summary.totalExpense)}
              </Text>
            </View>
          </View>

          {summary.totalFees > 0 && (
            <View style={styles.feeNoticeRow}>
              <Text style={styles.feeNoticeText}>Biaya Admin / Transfer:</Text>
              <Text style={styles.feeNoticeVal}>-{formatRupiah(summary.totalFees)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.netCashFlowRow}>
            <Text style={styles.netLabel}>Arus Kas Bersih</Text>
            <Text style={[styles.netVal, { color: isNetPositive ? colors.flow.income : colors.flow.expense }]}>
              {isNetPositive ? '+' : ''}{formatRupiah(summary.netCashFlow)}
            </Text>
          </View>
        </View>

        {/* Expenses by Category Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pengeluaran per Kategori</Text>
        </View>

        {categoryBreakdown.length === 0 ? (
          <View style={styles.emptyContainer}>
            <PieChart size={36} color={colors.text.muted} />
            <Text style={styles.emptyText}>Belum cukup data untuk menampilkan laporan.</Text>
          </View>
        ) : (
          categoryBreakdown.map((item) => (
            <View key={item.id} style={styles.categoryCard}>
              <View style={styles.catHeader}>
                <Text style={styles.catName}>{item.name}</Text>
                <Text style={styles.catAmount}>{formatRupiah(item.amount)} ({item.percentage}%)</Text>
              </View>
              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.min(item.percentage, 100)}%` }]} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  periodText: {
    fontSize: 13,
    color: colors.gold.champagne,
    fontWeight: '500',
    marginTop: 2,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    marginBottom: 24,
  },
  cardSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  flowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  flowCol: {
    flex: 1,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  flowLabel: {
    fontSize: 12,
    color: colors.text.muted,
  },
  flowValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  feeNoticeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  feeNoticeText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  feeNoticeVal: {
    fontSize: 12,
    color: colors.flow.expense,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: 12,
  },
  netCashFlowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  netVal: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  categoryCard: {
    backgroundColor: colors.bg.surface,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold.champagne,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.bg.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.gold.primary,
    borderRadius: 3,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 12,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});
