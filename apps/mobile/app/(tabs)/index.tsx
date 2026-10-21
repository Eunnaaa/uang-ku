import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Layers,
  RefreshCw,
} from 'lucide-react-native';
import { type TransactionModel, type AccountModel, formatRupiah } from '@uangku/contracts';
import * as SecureStore from 'expo-secure-store';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
import { BalanceHeroCard } from '../../src/components/BalanceHeroCard';
import { TransactionItem } from '../../src/components/TransactionItem';
import {
  getLocalTransactions,
  getLocalAccounts,
  getLocalDashboardSummary,
  getLocalBankMutations,
} from '../../src/db/sqlite';
import { SyncEngine } from '../../src/sync/syncEngine';
import { hapticMedium, hapticSelection } from '../../src/theme/haptics';
import { useAuth } from '../../src/auth/authContext';

function getAccountIcon(type: string, iconColor = colors.gold.champagne) {
  switch (type) {
    case 'bank':
      return <Landmark size={15} color={iconColor} />;
    case 'cash':
      return <Banknote size={15} color={iconColor} />;
    case 'e_wallet':
      return <Smartphone size={15} color={iconColor} />;
    default:
      return <Wallet size={15} color={iconColor} />;
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'Selamat Pagi';
  if (hour >= 11 && hour < 15) return 'Selamat Siang';
  if (hour >= 15 && hour < 19) return 'Selamat Sore';
  return 'Selamat Malam';
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
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
  const [pendingMutationsCount, setPendingMutationsCount] = useState<number>(0);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const loadData = useCallback(async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const [accs, txs, sum, maskPref, pendingMuts] = await Promise.all([
        getLocalAccounts(),
        getLocalTransactions(),
        getLocalDashboardSummary(currentMonth),
        SecureStore.getItemAsync('uangku_privacy_mask_balance'),
        getLocalBankMutations('pending'),
      ]);
      setAccounts(accs);
      setRecentTransactions(txs.slice(0, 5));
      setSummary(sum);
      setIsPrivacyMasked(maskPref === '1');
      setPendingMutationsCount(pendingMuts.length);
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
      await SyncEngine.syncAll();
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
            <Text style={styles.greetingText}>{getGreeting()},</Text>
            <Text style={styles.userNameText}>{user?.displayName || 'Tamu UangKu'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.syncStatusBtn}
              onPress={onRefresh}
            >
              <RefreshCw
                size={12}
                color={colors.gold.champagne}
                style={refreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
              />
              <Text style={styles.syncStatusText}>Tersinkron</Text>
            </TouchableOpacity>
            <View style={styles.badgeLuxury}>
              <Sparkles size={11} color={colors.gold.champagne} />
              <Text style={styles.badgeLuxuryText}>{isGuest ? 'GUEST' : 'ELITE'}</Text>
            </View>
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
                  {getAccountIcon(acc.type, colors.gold.champagne)}
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

        {/* Quick Tools Grid (6 Tools) */}
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
        </View>

        <View style={[styles.quickToolsRow, { marginTop: 8 }]}>
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

          <TouchableOpacity
            style={styles.quickToolBtn}
            activeOpacity={0.75}
            onPress={() => {
              hapticSelection();
              router.push('/pockets');
            }}
          >
            <View style={styles.quickToolIconBg}>
              <Layers size={16} color={colors.gold.champagne} />
            </View>
            <Text style={styles.quickToolLabel}>Kantong</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickToolBtn}
            activeOpacity={0.75}
            onPress={() => {
              hapticSelection();
              router.push('/bank-sync');
            }}
          >
            <View style={styles.quickToolIconBg}>
              <Landmark size={16} color={colors.gold.champagne} />
              {pendingMutationsCount > 0 && (
                <View style={styles.quickToolBadgeDot}>
                  <Text style={styles.quickToolBadgeDotText}>{pendingMutationsCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.quickToolLabel}>Bank Sync</Text>
          </TouchableOpacity>
        </View>

        {/* Smart Reconciliation Inbox Banner (PRD Section 80.4) */}
        {pendingMutationsCount > 0 && (
          <TouchableOpacity
            style={styles.reconcileInboxCard}
            activeOpacity={0.8}
            onPress={() => {
              hapticSelection();
              router.push('/bank-sync');
            }}
          >
            <View style={styles.reconcileInboxLeft}>
              <View style={styles.reconcileInboxIconWrap}>
                <Landmark size={18} color={colors.gold.champagne} />
              </View>
              <View style={styles.reconcileInboxTextCol}>
                <Text style={styles.reconcileInboxTitle}>Inbox Rekonsiliasi Bank</Text>
                <Text style={styles.reconcileInboxSub}>
                  {pendingMutationsCount} mutasi baru menunggu konfirmasi & pencocokan
                </Text>
              </View>
            </View>
            <View style={styles.reconcileInboxAction}>
              <Text style={styles.reconcileInboxActionText}>Tinjau</Text>
              <ChevronRight size={14} color={colors.gold.champagne} />
            </View>
          </TouchableOpacity>
        )}

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

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
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
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  syncStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
  },
  syncStatusText: {
    fontSize: 10,
    color: colors.gold.champagne,
    fontWeight: '600',
  },
  badgeLuxury: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.1)',
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
    backgroundColor: colors.bg.surface,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0 : 0.04,
    shadowRadius: 8,
    elevation: isDark ? 0 : 1,
  },
  accountCardDefault: {
    borderColor: isDark ? 'rgba(212, 175, 55, 0.4)' : 'rgba(180, 83, 9, 0.4)',
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.03)' : 'rgba(180, 83, 9, 0.03)',
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
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
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
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(180, 83, 9, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addAccountIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.1)',
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
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 4,
    elevation: isDark ? 0 : 1,
  },
  quickToolIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  quickToolBadgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.flow.expense,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  quickToolBadgeDotText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  quickToolLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  reconcileInboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#161925' : colors.bg.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.35)' : 'rgba(180, 83, 9, 0.35)',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0 : 0.04,
    shadowRadius: 6,
    elevation: isDark ? 0 : 1,
  },
  reconcileInboxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  reconcileInboxIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(180, 83, 9, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reconcileInboxTextCol: {
    flex: 1,
  },
  reconcileInboxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  reconcileInboxSub: {
    fontSize: 11.5,
    color: colors.text.muted,
    marginTop: 2,
  },
  reconcileInboxAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
  },
  reconcileInboxActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 83, 9, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.16)' : 'rgba(180, 83, 9, 0.16)',
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
    shadowOpacity: isDark ? 0.35 : 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
});
