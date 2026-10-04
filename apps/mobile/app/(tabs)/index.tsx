import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, Wallet, ChevronRight, Plus } from 'lucide-react-native';
import { type TransactionModel, type AccountModel, formatRupiah } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import { BalanceHeroCard } from '../../src/components/BalanceHeroCard';
import { TransactionItem } from '../../src/components/TransactionItem';
import {
  getLocalTransactions,
  getLocalAccounts,
  getLocalDashboardSummary,
} from '../../src/db/sqlite';
import { SyncEngine } from '../../src/sync/syncEngine';
import { hapticMedium } from '../../src/theme/haptics';

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionModel[]>([]);
  const [summary, setSummary] = useState({
    totalNetWorth: 0,
    totalIncome: 0,
    totalExpense: 0,
    netCashFlow: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const [accs, txs, sum] = await Promise.all([
        getLocalAccounts(),
        getLocalTransactions(),
        getLocalDashboardSummary(currentMonth),
      ]);
      setAccounts(accs);
      setRecentTransactions(txs.slice(0, 5));
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load local data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await SyncEngine.processOutbox();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.champagne}
            colors={[colors.gold.champagne]}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingText}>Selamat Datang,</Text>
            <Text style={styles.userNameText}>Gary Hardyansyah</Text>
          </View>
          <View style={styles.badgeLuxury}>
            <Sparkles size={14} color={colors.gold.champagne} />
            <Text style={styles.badgeLuxuryText}>UANGKU ELITE</Text>
          </View>
        </View>

        {/* Hero Balance Card */}
        <BalanceHeroCard
          totalNetWorth={summary.totalNetWorth}
          totalIncome={summary.totalIncome}
          totalExpense={summary.totalExpense}
          netCashFlow={summary.netCashFlow}
          onPressAdd={() => router.push('/transaction/new')}
          onPressTransfer={() => router.push({ pathname: '/transaction/new', params: { initialType: 'transfer' } })}
        />

        {/* Accounts / Wallets Horizontal Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dompet & Rekening</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.sectionAction}>Kelola</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountsScroll}
        >
          {accounts.map((acc) => (
            <View key={acc.id} style={styles.accountCard}>
              <View style={styles.accountCardTop}>
                <View style={styles.accountIconBg}>
                  <Wallet size={16} color={colors.gold.champagne} />
                </View>
                <Text style={styles.accountType}>{acc.type.toUpperCase()}</Text>
              </View>
              <Text style={styles.accountName} numberOfLines={1}>{acc.name}</Text>
              <Text style={styles.accountBalance}>{formatRupiah(acc.currentBalance || 0)}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Recent Transactions Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transaksi Terbaru</Text>
          <TouchableOpacity
            style={styles.seeAllBtn}
            onPress={() => router.push('/(tabs)/transactions')}
          >
            <Text style={styles.sectionAction}>Lihat Semua</Text>
            <ChevronRight size={14} color={colors.gold.champagne} />
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Belum ada transaksi. Yuk catat transaksi pertamamu.</Text>
          </View>
        ) : (
          recentTransactions.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.fab}
        onPress={() => {
          hapticMedium();
          router.push('/transaction/new');
        }}
      >
        <Plus size={24} color="#090A0E" strokeWidth={2.8} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 13,
    color: colors.text.muted,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  badgeLuxury: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    borderWidth: 0.5,
    borderColor: colors.gold.hairline,
  },
  badgeLuxuryText: {
    color: colors.gold.champagne,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionAction: {
    fontSize: 13,
    color: colors.gold.champagne,
    fontWeight: '600',
  },
  accountsScroll: {
    gap: 10,
    paddingBottom: 16,
  },
  accountCard: {
    width: 140,
    backgroundColor: colors.bg.surface,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  accountCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  accountIconBg: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountType: {
    fontSize: 9,
    color: colors.text.muted,
    fontWeight: '700',
  },
  accountName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
