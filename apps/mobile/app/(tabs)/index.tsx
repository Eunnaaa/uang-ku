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
import {
  Sparkles,
  Wallet,
  ChevronRight,
  Plus,
  Landmark,
  Banknote,
  Smartphone,
  PieChart,
  Target,
  Repeat,
  Receipt,
} from 'lucide-react-native';
import { type TransactionModel, type AccountModel, formatRupiah } from '@uangku/contracts';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../../src/theme/colors';
import { BalanceHeroCard } from '../../src/components/BalanceHeroCard';
import { TransactionItem } from '../../src/components/TransactionItem';
import {
  getLocalTransactions,
  getLocalAccounts,
  getLocalDashboardSummary,
} from '../../src/db/sqlite';
import { SyncEngine } from '../../src/sync/syncEngine';
import { hapticMedium, hapticSelection } from '../../src/theme/haptics';
import { useAuth } from '../../src/auth/authContext';

function getAccountIcon(type: string) {
  switch (type) {
    case 'bank':
      return <Landmark size={15} color={colors.gold.champagne} />;
    case 'cash':
      return <Banknote size={15} color={colors.gold.champagne} />;
    case 'e_wallet':
      return <Smartphone size={15} color={colors.gold.champagne} />;
    default:
      return <Wallet size={15} color={colors.gold.champagne} />;
  }
}

function getAccountTypeName(type: string) {
  switch (type) {
    case 'bank': return 'BANK';
    case 'cash': return 'TUNAI';
    case 'e_wallet': return 'E-WALLET';
    default: return 'LAINNYA';
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(false);
  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionModel[]>([]);
  const [summary, setSummary] = useState({
    totalNetWorth: 0,
    totalIncome: 0,
    totalExpense: 0,
    netCashFlow: 0,
    availableNetWorth: 0,
    totalReserved: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const [accs, txs, sum, maskPref] = await Promise.all([
        getLocalAccounts(),
        getLocalTransactions(),
        getLocalDashboardSummary(currentMonth),
        SecureStore.getItemAsync('uangku_privacy_mask_balance'),
      ]);
      setAccounts(accs);
      setRecentTransactions(txs.slice(0, 5));
      setSummary(sum);
      setIsPrivacyMasked(maskPref === '1');
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
            <Text style={styles.userNameText}>{user?.displayName || 'Tamu UangKu'}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.badgeLuxury}>
              <Sparkles size={12} color={colors.gold.champagne} />
              <Text style={styles.badgeLuxuryText}>{isGuest ? 'GUEST' : 'ELITE'}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.headerAddBtn}
              onPress={() => {
                hapticMedium();
                router.push('/transaction/new');
              }}
            >
              <Plus size={16} color="#090A0E" strokeWidth={2.8} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Balance Card */}
        <BalanceHeroCard
          totalNetWorth={summary.totalNetWorth}
          availableNetWorth={summary.availableNetWorth}
          totalReserved={summary.totalReserved}
          totalIncome={summary.totalIncome}
          totalExpense={summary.totalExpense}
          netCashFlow={summary.netCashFlow}
          initialMasked={isPrivacyMasked}
          onPressAdd={() => router.push('/transaction/new')}
          onPressTransfer={() => router.push({ pathname: '/transaction/new', params: { initialType: 'transfer' } })}
        />

        {/* Accounts / Wallets Horizontal Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dompet & Rekening</Text>
          <TouchableOpacity onPress={() => router.push('/accounts')}>
            <Text style={styles.sectionAction}>Kelola</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountsScroll}
        >
          {accounts.map((acc) => (
            <TouchableOpacity
              key={acc.id}
              activeOpacity={0.75}
              onPress={() => {
                hapticSelection();
                router.push({ pathname: '/(tabs)/transactions', params: { accountId: acc.id } });
              }}
              style={[
                styles.accountCard,
                acc.isDefault && styles.accountCardDefault,
              ]}
            >
              <View style={styles.accountCardTop}>
                <View style={styles.accountIconBg}>
                  {getAccountIcon(acc.type)}
                </View>
                <View style={styles.accountTypeBadge}>
                  <Text style={styles.accountType}>{getAccountTypeName(acc.type)}</Text>
                </View>
              </View>
              <Text style={styles.accountName} numberOfLines={1}>{acc.name}</Text>
              <Text style={styles.accountBalance}>
                {isPrivacyMasked ? 'Rp ••••••' : formatRupiah(acc.currentBalance || 0)}
              </Text>
              {Boolean(acc.reservedAmount && acc.reservedAmount > 0) && (
                <Text style={styles.accountAvailableText} numberOfLines={1}>
                  Tersedia: {isPrivacyMasked ? '••••••' : formatRupiah(Math.max(0, (acc.currentBalance || 0) - (acc.reservedAmount || 0)))}
                </Text>
              )}
            </TouchableOpacity>
          ))}

          {/* Quick Add Wallet Card */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.addAccountCard}
            onPress={() => {
              hapticSelection();
              router.push('/accounts');
            }}
          >
            <View style={styles.addAccountIconBg}>
              <Plus size={16} color={colors.gold.champagne} strokeWidth={2.5} />
            </View>
            <Text style={styles.addAccountText}>+ Tambah</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Quick Tools Grid */}
        <View style={styles.quickToolsRow}>
          <TouchableOpacity
            style={styles.quickToolBtn}
            activeOpacity={0.75}
            onPress={() => {
              hapticSelection();
              router.push('/budgets');
            }}
          >
            <View style={styles.quickToolIconBg}>
              <PieChart size={16} color={colors.gold.champagne} />
            </View>
            <Text style={styles.quickToolLabel}>Anggaran</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickToolBtn}
            activeOpacity={0.75}
            onPress={() => {
              hapticSelection();
              router.push('/goals');
            }}
          >
            <View style={styles.quickToolIconBg}>
              <Target size={16} color={colors.gold.champagne} />
            </View>
            <Text style={styles.quickToolLabel}>Target</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickToolBtn}
            activeOpacity={0.75}
            onPress={() => {
              hapticSelection();
              router.push('/recurring');
            }}
          >
            <View style={styles.quickToolIconBg}>
              <Repeat size={16} color={colors.gold.champagne} />
            </View>
            <Text style={styles.quickToolLabel}>Berulang</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickToolBtn}
            activeOpacity={0.75}
            onPress={() => {
              hapticSelection();
              router.push('/split-bill');
            }}
          >
            <View style={styles.quickToolIconBg}>
              <Receipt size={16} color={colors.gold.champagne} />
            </View>
            <Text style={styles.quickToolLabel}>Split Bill</Text>
          </TouchableOpacity>
        </View>

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
            <View style={styles.emptyIconCircle}>
              <Wallet size={22} color={colors.gold.champagne} />
            </View>
            <Text style={styles.emptyText}>Belum ada transaksi. Yuk catat transaksi pertamamu.</Text>
          </View>
        ) : (
          recentTransactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              onPress={() => router.push('/(tabs)/transactions')}
            />
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
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  greetingText: {
    fontSize: 12,
    color: colors.text.muted,
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLuxury: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
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
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
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
    fontSize: 12,
    color: colors.gold.champagne,
    fontWeight: '600',
  },
  accountsScroll: {
    gap: 10,
    paddingBottom: 14,
  },
  accountCard: {
    width: 148,
    backgroundColor: '#12141D',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  accountCardDefault: {
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(212, 175, 55, 0.03)',
  },
  accountCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  accountIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  accountType: {
    fontSize: 9,
    color: colors.text.muted,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  accountName: {
    fontSize: 12,
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
  accountAvailableText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gold.champagne,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  addAccountCard: {
    width: 112,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addAccountIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  quickToolsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  quickToolBtn: {
    flex: 1,
    backgroundColor: '#12141D',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  quickToolIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickToolLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12141D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
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
