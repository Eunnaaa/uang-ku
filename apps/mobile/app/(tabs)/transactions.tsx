import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Search, Filter, Trash2 } from 'lucide-react-native';
import { type TransactionModel } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import { TransactionItem } from '../../src/components/TransactionItem';
import { getLocalTransactions, deleteLocalTransaction } from '../../src/db/sqlite';
import { hapticSelection, hapticLight } from '../../src/theme/haptics';

export default function TransactionsScreen() {
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<TransactionModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      const items = await getLocalTransactions({
        type: activeTab === 'all' ? undefined : activeTab,
      });
      setTransactions(items);
    } catch (err) {
      console.error(err);
    }
  }, [activeTab]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const handleDelete = (tx: TransactionModel) => {
    Alert.alert(
      'Hapus Transaksi',
      `Yakin ingin menghapus transaksi "${tx.note || tx.category?.name || 'ini'}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            hapticLight();
            await deleteLocalTransaction(tx.id);
            await loadTransactions();
          },
        },
      ]
    );
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const noteMatch = tx.note?.toLowerCase().includes(q);
    const catMatch = tx.category?.name?.toLowerCase().includes(q);
    const accMatch = tx.account?.name?.toLowerCase().includes(q);
    return Boolean(noteMatch || catMatch || accMatch);
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histori Transaksi</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Search size={16} color={colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari transaksi, kategori, atau dompet..."
          placeholderTextColor={colors.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Segment Filter Tabs */}
      <View style={styles.tabsRow}>
        {(['all', 'expense', 'income', 'transfer'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'all' ? 'Semua' : tab === 'expense' ? 'Pengeluaran' : tab === 'income' ? 'Pemasukan' : 'Transfer';
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.7}
              style={[styles.tabBtn, isActive && styles.activeTabBtn]}
              onPress={() => {
                hapticSelection();
                setActiveTab(tab);
              }}
            >
              <Text style={[styles.tabBtnText, isActive && styles.activeTabBtnText]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Transactions List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.champagne}
          />
        }
      >
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
            <Text style={styles.emptySubtitle}>Transaksi yang kamu catat akan tampil rapi di sini.</Text>
          </View>
        ) : (
          filteredTransactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              onPress={() => handleDelete(tx)}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  activeTabBtn: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: colors.gold.champagne,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  activeTabBtnText: {
    color: colors.gold.champagne,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
