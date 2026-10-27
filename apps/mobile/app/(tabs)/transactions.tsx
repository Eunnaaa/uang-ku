import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Search, Filter, Trash2, X, Cloud, CloudOff, Edit3, Check, Wallet, ZoomIn, Camera, Layers, Tag } from 'lucide-react-native';
import { formatRupiah, type TransactionModel, type CategoryModel } from '@uangku/contracts';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
import { TransactionItem } from '../../src/components/TransactionItem';
import { SyncEngine } from '../../src/sync/syncEngine';
import {
  getLocalTransactions,
  deleteLocalTransaction,
  updateLocalTransaction,
  bulkDeleteLocalTransactions,
  bulkRecategorizeTransactions,
  getLocalCategories,
  getLocalTransactionHistory,
  type TransactionHistoryModel,
} from '../../src/db/sqlite';
import { hapticSelection, hapticLight, hapticMedium, hapticSuccess } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

function groupTransactionsByDate(items: TransactionModel[]) {
  const groups: { dateKey: string; label: string; items: TransactionModel[]; dailyNet: number }[] = [];
  const map = new Map<string, { label: string; items: TransactionModel[]; dailyNet: number }>();

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  for (const item of items) {
    const itemDateStr = item.transactionDate.slice(0, 10);
    let group = map.get(itemDateStr);
    if (!group) {
      let label = '';
      let dateObj = new Date(item.transactionDate);
      if (isNaN(dateObj.getTime())) {
        dateObj = new Date();
      }
      const dateFormatted = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(dateObj);

      if (itemDateStr === todayStr) {
        label = `Hari Ini • ${dateFormatted}`;
      } else if (itemDateStr === yesterdayStr) {
        label = `Kemarin • ${dateFormatted}`;
      } else {
        label = dateFormatted;
      }

      group = { label, items: [], dailyNet: 0 };
      map.set(itemDateStr, group);
      groups.push({ dateKey: itemDateStr, ...group });
    }
    group.items.push(item);
    if (item.type === 'income') {
      group.dailyNet += item.amount;
    } else if (item.type === 'expense') {
      group.dailyNet -= item.amount;
    } else if (item.type === 'transfer' && item.transferFee) {
      group.dailyNet -= item.transferFee;
    }
  }

  return groups;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(params.accountId || null);
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<TransactionModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionModel | null>(null);
  const [txHistory, setTxHistory] = useState<TransactionHistoryModel[]>([]);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState('');
  const [isReceiptFullscreenOpen, setIsReceiptFullscreenOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isBulkCatModalOpen, setIsBulkCatModalOpen] = useState(false);
  const [amountFilter, setAmountFilter] = useState<'all' | 'lt_50k' | '50k_100k' | 'gt_100k'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>(['Kopi', 'Bensin', 'Gaji', 'Makan']);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    if (params.accountId) {
      setSelectedAccountId(params.accountId);
    }
  }, [params.accountId]);

  useEffect(() => {
    getLocalCategories().then(setCategories).catch(console.error);
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const items = await getLocalTransactions({
        type: activeTab === 'all' ? undefined : activeTab,
        accountId: selectedAccountId || undefined,
      });
      setTransactions(items);
    } catch (err) {
      console.error(err);
    }
  }, [activeTab, selectedAccountId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await SyncEngine.syncAll();
      await loadTransactions();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenDetail = (tx: TransactionModel) => {
    hapticSelection();
    setSelectedTx(tx);
    setIsEditingNote(false);
    setEditNoteText(tx.note || '');
    getLocalTransactionHistory(tx.id).then(setTxHistory).catch(() => setTxHistory([]));
  };

  const handleSaveNote = async () => {
    if (!selectedTx) return;
    try {
      hapticMedium();
      await updateLocalTransaction(selectedTx.id, { note: editNoteText.trim() || null });
      setSelectedTx((prev) => (prev ? { ...prev, note: editNoteText.trim() || null } : null));
      setIsEditingNote(false);
      getLocalTransactionHistory(selectedTx.id).then(setTxHistory).catch(() => {});
      toast.showSuccess('Catatan Diperbarui');
      await loadTransactions();
    } catch (err: any) {
      toast.showError('Gagal Mengubah', err.message);
    }
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
            try {
              hapticLight();
              await deleteLocalTransaction(tx.id);
              if (selectedTx?.id === tx.id) {
                setSelectedTx(null);
              }
              toast.showSuccess('Transaksi Dihapus');
              await loadTransactions();
            } catch (err: any) {
              toast.showError('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteReceipt = () => {
    if (!selectedTx) return;
    hapticLight();
    Alert.alert(
      'Hapus Foto Bukti',
      'Yakin ingin menghapus foto bukti struk dari transaksi ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await updateLocalTransaction(selectedTx.id, { receiptUrl: null });
              setSelectedTx({ ...selectedTx, receiptUrl: null });
              toast.showSuccess('Foto Bukti Dihapus');
              await loadTransactions();
            } catch (err: any) {
              toast.showError('Gagal Menghapus Foto', err.message);
            }
          },
        },
      ]
    );
  };

  // Multi-Select Bulk Actions (PRD Section 74)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  const toggleTxSelection = (id: string) => {
    hapticSelection();
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const enterMultiSelect = (initialId?: string) => {
    hapticMedium();
    setIsMultiSelectMode(true);
    if (initialId) {
      setSelectedTxIds(new Set([initialId]));
    }
  };

  const exitMultiSelect = () => {
    hapticLight();
    setIsMultiSelectMode(false);
    setSelectedTxIds(new Set());
  };

  const handleSelectAll = () => {
    hapticSelection();
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedTxIds.size === 0) return;
    const count = selectedTxIds.size;
    hapticMedium();
    Alert.alert(
      'Hapus Transaksi Terpilih',
      `Hapus ${count} transaksi yang dipilih? Data akan diarsipkan dan saldo dompet diperbarui.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await bulkDeleteLocalTransactions(Array.from(selectedTxIds));
              exitMultiSelect();
              toast.showSuccess('Berhasil Dihapus', `${count} transaksi telah dihapus.`);
              await loadTransactions();
            } catch (err: any) {
              toast.showError('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleBulkRecategorize = async (catId: string) => {
    if (selectedTxIds.size === 0) return;
    const count = selectedTxIds.size;
    try {
      hapticMedium();
      await bulkRecategorizeTransactions(Array.from(selectedTxIds), catId);
      setIsBulkCatModalOpen(false);
      exitMultiSelect();
      toast.showSuccess('Kategori Diperbarui', `${count} transaksi berhasil diubah kategorinya.`);
      await loadTransactions();
    } catch (err: any) {
      toast.showError('Gagal Mengubah Kategori', err.message);
    }
  };

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    if (amountFilter === 'lt_50k') {
      result = result.filter((tx) => tx.amount < 50000);
    } else if (amountFilter === '50k_100k') {
      result = result.filter((tx) => tx.amount >= 50000 && tx.amount <= 100000);
    } else if (amountFilter === 'gt_100k') {
      result = result.filter((tx) => tx.amount > 100000);
    }

    if (!searchQuery) return result;
    const q = searchQuery.toLowerCase().trim();
    return result.filter((tx) => {
      const noteMatch = tx.note?.toLowerCase().includes(q);
      const catMatch = tx.category?.name?.toLowerCase().includes(q);
      const accMatch = tx.account?.name?.toLowerCase().includes(q);
      const destAccMatch = tx.destinationAccount?.name?.toLowerCase().includes(q);
      const pocketMatch = tx.pocket?.name?.toLowerCase().includes(q);
      const amountMatch = tx.amount.toString().includes(q);
      const formattedAmountMatch = formatRupiah(tx.amount).toLowerCase().includes(q);
      const dateMatch = tx.transactionDate ? tx.transactionDate.toLowerCase().includes(q) : false;
      return Boolean(noteMatch || catMatch || accMatch || destAccMatch || pocketMatch || amountMatch || formattedAmountMatch || dateMatch);
    });
  }, [transactions, searchQuery, amountFilter]);

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDate(filteredTransactions);
  }, [filteredTransactions]);

  const filteredNet = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      if (t.type === 'income') return acc + t.amount;
      if (t.type === 'expense') return acc - t.amount;
      if (t.type === 'transfer' && t.transferFee) return acc - t.transferFee;
      return acc;
    }, 0);
  }, [filteredTransactions]);

  const isIncome = selectedTx?.type === 'income';
  const isExpense = selectedTx?.type === 'expense';
  const isTransfer = selectedTx?.type === 'transfer';
  const amountColor = isIncome ? colors.flow.income : isExpense ? colors.flow.expense : colors.flow.transfer;
  const amountPrefix = isIncome ? '+' : isExpense ? '-' : '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Histori Transaksi</Text>
            <Text style={styles.headerSubtitle}>
              {isMultiSelectMode
                ? `${selectedTxIds.size} dari ${filteredTransactions.length} dipilih`
                : `${filteredTransactions.length} transaksi tercatat`}
            </Text>
          </View>
          {filteredTransactions.length > 0 && (
            <View style={styles.headerActionRow}>
              {isMultiSelectMode ? (
                <>
                  <TouchableOpacity style={styles.selectActionBtn} onPress={handleSelectAll}>
                    <Text style={styles.selectActionText}>
                      {selectedTxIds.size === filteredTransactions.length ? 'Batal Semua' : 'Semua'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelActionBtn} onPress={exitMultiSelect}>
                    <Text style={styles.cancelActionText}>Selesai</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.multiSelectToggleBtn} onPress={() => enterMultiSelect()}>
                  <Text style={styles.multiSelectToggleText}>Pilih</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* 1. Fluid Segmented Control Tabs */}
        <View style={styles.segmentContainer}>
          {(['all', 'expense', 'income', 'transfer'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'all' ? 'Semua' : tab === 'expense' ? 'Pengeluaran' : tab === 'income' ? 'Pemasukan' : 'Transfer';
            const activeColor =
              tab === 'income'
                ? colors.flow.income
                : tab === 'expense'
                ? colors.flow.expense
                : tab === 'transfer'
                ? colors.flow.transfer
                : colors.gold.champagne;

            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.7}
                style={[
                  styles.segmentTab,
                  isActive && styles.segmentTabActive,
                ]}
                onPress={() => {
                  hapticSelection();
                  setActiveTab(tab);
                }}
              >
                <Text
                  style={[
                    styles.segmentTabText,
                    isActive && { color: activeColor, fontWeight: '700' },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 2. Sleek Rounded Search Bar */}
        <View style={styles.searchBar}>
          <Search size={15} color={colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari catatan, kategori, nominal..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={14} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Single Unified Filter Carousel Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterStripScroll}
        >
          {selectedAccountId && (
            <View style={styles.activeAccountChip}>
              <Wallet size={11} color={colors.gold.champagne} />
              <Text style={styles.activeAccountChipText} numberOfLines={1}>
                {transactions.find((t) => t.accountId === selectedAccountId || t.destinationAccountId === selectedAccountId)?.account?.name || 'Dompet'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  hapticSelection();
                  setSelectedAccountId(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={11} color={colors.gold.champagne} />
              </TouchableOpacity>
            </View>
          )}

          {(
            [
              { id: 'all', label: 'Semua Nominal' },
              { id: 'lt_50k', label: '< 50rb' },
              { id: '50k_100k', label: '50rb - 100rb' },
              { id: 'gt_100k', label: '> 100rb' },
            ] as const
          ).map((item) => {
            const isSelected = amountFilter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => {
                  hapticSelection();
                  setAmountFilter(item.id);
                }}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {!searchQuery && recentSearches.map((term, i) => (
            <TouchableOpacity
              key={i}
              style={styles.suggestionChip}
              onPress={() => {
                hapticSelection();
                setSearchQuery(term);
              }}
            >
              <Text style={styles.suggestionChipText}>{term}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filtered Net Summary Breadcrumb */}
      {filteredTransactions.length > 0 && (
        <View style={styles.listSubHeader}>
          <Text style={styles.listSubHeaderTitle}>AKTIVITAS TERBARU</Text>
          <Text
            style={[
              styles.listSubHeaderNet,
              { color: filteredNet >= 0 ? colors.flow.income : colors.flow.expense },
            ]}
          >
            {filteredNet >= 0 ? '+' : ''}{formatRupiah(filteredNet)}
          </Text>
        </View>
      )}

      {/* Transactions List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          filteredTransactions.length === 0 && styles.listContentEmpty,
        ]}
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
            <View style={styles.emptyIconWrap}>
              <Filter size={26} color={colors.gold.champagne} />
            </View>
            <Text style={styles.emptyTitle}>Tidak ada transaksi</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}".` : 'Belum ada transaksi pada filter ini.'}
            </Text>
          </View>
        ) : (
          groupedTransactions.map((group) => (
            <View key={group.dateKey} style={styles.dateGroupContainer}>
              <View style={styles.dateGroupHeader}>
                <Text style={styles.dateGroupLabel}>{group.label}</Text>
                {group.dailyNet !== 0 && (
                  <View style={[styles.dailyNetBadge, { backgroundColor: group.dailyNet > 0 ? colors.flow.incomeBg : colors.flow.expenseBg }]}>
                    <Text
                      style={[
                        styles.dailyNetText,
                        { color: group.dailyNet > 0 ? colors.flow.income : colors.flow.expense },
                      ]}
                    >
                      {group.dailyNet > 0 ? '+' : ''}{formatRupiah(group.dailyNet)}
                    </Text>
                  </View>
                )}
              </View>
              {group.items.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  isMultiSelectMode={isMultiSelectMode}
                  isSelected={selectedTxIds.has(tx.id)}
                  onPress={() => {
                    if (isMultiSelectMode) {
                      toggleTxSelection(tx.id);
                    } else {
                      handleOpenDetail(tx);
                    }
                  }}
                  onLongPress={() => {
                    if (!isMultiSelectMode) {
                      enterMultiSelect(tx.id);
                    }
                  }}
                  onDelete={() => handleDelete(tx)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating Bulk Action Bar (PRD Section 74) */}
      {isMultiSelectMode && selectedTxIds.size > 0 && (
        <View style={styles.bulkActionBar}>
          <View style={styles.bulkActionInfo}>
            <Text style={styles.bulkActionCount}>{selectedTxIds.size}</Text>
            <Text style={styles.bulkActionLabel}>dipilih</Text>
          </View>
          <View style={styles.bulkActionButtons}>
            <TouchableOpacity
              style={styles.bulkCatBtn}
              activeOpacity={0.7}
              onPress={() => {
                hapticSelection();
                setIsBulkCatModalOpen(true);
              }}
            >
              <Tag size={14} color={colors.gold.champagne} />
              <Text style={styles.bulkCatText}>Kategori</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bulkDeleteBtn}
              activeOpacity={0.7}
              onPress={handleBulkDelete}
            >
              <Trash2 size={14} color="#FFF" />
              <Text style={styles.bulkDeleteText}>Hapus ({selectedTxIds.size})</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bulk Category Selection Modal (PRD Section 74) */}
      <Modal visible={isBulkCatModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsBulkCatModalOpen(false)}
          />
          <View style={styles.bulkCatModalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Pilih Kategori Baru</Text>
            <Text style={styles.bulkCatSubtitle}>
              Terapkan kategori ini untuk {selectedTxIds.size} transaksi terpilih
            </Text>
            <ScrollView style={{ maxHeight: 280, marginTop: 12 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.bulkCatItem}
                  onPress={() => handleBulkRecategorize(cat.id)}
                >
                  <Text style={styles.bulkCatItemText}>{cat.name}</Text>
                  <Text style={styles.bulkCatItemType}>{cat.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.cancelBulkCatBtn}
              onPress={() => setIsBulkCatModalOpen(false)}
            >
              <Text style={styles.cancelActionText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transaction Detail & Action Modal */}
      <Modal visible={Boolean(selectedTx)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setSelectedTx(null)}
          />
          {selectedTx && (
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rincian Transaksi</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedTx(null)}
                >
                  <X size={18} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Amount Box */}
              <View style={styles.modalAmountCard}>
                <Text style={[styles.modalAmountText, { color: amountColor }]}>
                  {amountPrefix}{formatRupiah(selectedTx.amount)}
                </Text>
                <View style={styles.statusBadge}>
                  {selectedTx.syncStatus === 'synced' ? (
                    <>
                      <Cloud size={12} color={colors.flow.income} />
                      <Text style={[styles.statusBadgeText, { color: colors.flow.income }]}>Tersinkronisasi</Text>
                    </>
                  ) : (
                    <>
                      <CloudOff size={12} color={colors.gold.champagne} />
                      <Text style={[styles.statusBadgeText, { color: colors.gold.champagne }]}>Lokal (Pending Sync)</Text>
                    </>
                  )}
                </View>
              </View>

              {/* Metadata Info Card */}
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Tipe</Text>
                  <Text style={styles.metaValue}>
                    {isIncome ? 'Pemasukan' : isExpense ? 'Pengeluaran' : 'Transfer Antar Akun'}
                  </Text>
                </View>

                {!isTransfer && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Kategori</Text>
                    <Text style={styles.metaValue}>{selectedTx.category?.name || 'Lainnya'}</Text>
                  </View>
                )}

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{isTransfer ? 'Dari Akun' : 'Akun / Dompet'}</Text>
                  <Text style={styles.metaValue}>{selectedTx.account?.name || 'Kas'}</Text>
                </View>

                {isTransfer && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Ke Akun Tujuan</Text>
                    <Text style={styles.metaValue}>{selectedTx.destinationAccount?.name || '-'}</Text>
                  </View>
                )}

                {isTransfer && selectedTx.transferFee > 0 && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Biaya Admin</Text>
                    <Text style={[styles.metaValue, { color: colors.flow.expense }]}>
                      {formatRupiah(selectedTx.transferFee)}
                    </Text>
                  </View>
                )}

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Waktu Transaksi</Text>
                  <Text style={styles.metaValue}>
                    {new Date(selectedTx.transactionDate).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              {/* Note Section */}
              <View style={styles.noteCard}>
                <View style={styles.noteHeaderRow}>
                  <Text style={styles.noteLabel}>CATATAN</Text>
                  {!isEditingNote && (
                    <TouchableOpacity
                      style={styles.noteEditBtn}
                      onPress={() => setIsEditingNote(true)}
                    >
                      <Edit3 size={13} color={colors.gold.champagne} />
                      <Text style={styles.noteEditText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {isEditingNote ? (
                  <View>
                    <TextInput
                      style={styles.noteInput}
                      value={editNoteText}
                      onChangeText={setEditNoteText}
                      placeholder="Tulis catatan transaksi..."
                      placeholderTextColor={colors.text.muted}
                      autoFocus
                      multiline
                    />
                    <View style={styles.noteActionRow}>
                      <TouchableOpacity
                        style={styles.noteCancelBtn}
                        onPress={() => setIsEditingNote(false)}
                      >
                        <Text style={styles.noteCancelText}>Batal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.noteSaveBtn}
                        onPress={handleSaveNote}
                      >
                        <Text style={styles.noteSaveText}>Simpan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noteText}>
                    {selectedTx.note || 'Tidak ada catatan'}
                  </Text>
                )}
              </View>

              {/* Receipt Photo Section (PRD Section 63) */}
              {selectedTx.receiptUrl ? (
                <View style={styles.detailReceiptCard}>
                  <View style={styles.detailReceiptHeader}>
                    <Text style={styles.noteLabel}>FOTO BUKTI / STRUK (NOTA)</Text>
                    <TouchableOpacity
                      style={styles.detailReceiptDeleteBtn}
                      onPress={handleDeleteReceipt}
                    >
                      <Trash2 size={12} color={colors.flow.expense} />
                      <Text style={styles.detailReceiptDeleteText}>Hapus Foto</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.detailReceiptImageWrap}
                    onPress={() => setIsReceiptFullscreenOpen(true)}
                  >
                    <Image
                      source={{ uri: selectedTx.receiptUrl }}
                      style={styles.detailReceiptImage}
                      resizeMode="cover"
                    />
                    <View style={styles.detailReceiptBadge}>
                      <ZoomIn size={12} color="#FFF" />
                      <Text style={styles.detailReceiptBadgeText}>Ketuk untuk perbesar</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Riwayat Perubahan / Audit Log (PRD Section 69) */}
              {txHistory.length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.historySectionTitle}>RIWAYAT PERUBAHAN</Text>
                  {txHistory.map((h) => (
                    <View key={h.id} style={styles.historyRow}>
                      <View style={styles.historyBullet} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historySummaryText}>{h.summary}</Text>
                        <Text style={styles.historyDateText}>
                          {new Date(h.changedAt).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalEditFullBtn}
                  onPress={() => {
                    const txId = selectedTx.id;
                    setSelectedTx(null);
                    router.push({ pathname: '/transaction/new', params: { editId: txId } });
                  }}
                >
                  <Edit3 size={15} color="#090A0E" strokeWidth={2.2} />
                  <Text style={styles.modalEditFullText}>Edit Transaksi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={() => handleDelete(selectedTx)}
                >
                  <Trash2 size={16} color={colors.flow.expense} />
                  <Text style={styles.modalDeleteText}>Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Full-Screen Receipt Modal (PRD Section 63) */}
      {selectedTx?.receiptUrl && (
        <Modal visible={isReceiptFullscreenOpen} transparent animationType="fade">
          <View style={styles.fullReceiptOverlay}>
            <SafeAreaView style={styles.fullReceiptSafeArea}>
              <View style={styles.fullReceiptHeader}>
                <Text style={styles.fullReceiptTitle}>Bukti Transaksi</Text>
                <TouchableOpacity
                  style={styles.fullReceiptCloseBtn}
                  onPress={() => setIsReceiptFullscreenOpen(false)}
                >
                  <X size={20} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.fullReceiptImageContainer}>
                <Image
                  source={{ uri: selectedTx.receiptUrl }}
                  style={styles.fullReceiptImage}
                  resizeMode="contain"
                />
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: colors.text.muted,
    marginTop: 1,
    fontWeight: '500',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#11131C' : colors.bg.elevated,
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.border.subtle,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  segmentTabActive: {
    backgroundColor: isDark ? '#1B1F2C' : colors.bg.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.25 : 0.08,
    shadowRadius: 3,
    elevation: isDark ? 0 : 2,
  },
  segmentTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#11131C' : colors.bg.surface,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.border.subtle,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 13,
  },
  filterStripScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingBottom: 4,
  },
  activeAccountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
    borderWidth: 0.8,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.35)' : 'rgba(180, 83, 9, 0.3)',
  },
  activeAccountChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
    maxWidth: 85,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 9,
    backgroundColor: isDark ? '#11131C' : colors.bg.surface,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.border.subtle,
  },
  filterChipActive: {
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(180, 83, 9, 0.12)',
    borderColor: colors.gold.champagne,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.muted,
  },
  filterChipTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  suggestionChip: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 9,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : colors.bg.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border.subtle,
  },
  suggestionChipText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  listSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  listSubHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
  },
  listSubHeaderNet: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dateGroupContainer: {
    marginBottom: 12,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 6,
  },
  dateGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dailyNetBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dailyNetText: {
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(9, 10, 14, 0.75)' : 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalDismissOverlay: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 83, 9, 0.2)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
  },
  modalAmountCard: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.bg.elevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border.subtle,
    marginBottom: 18,
  },
  modalAmountText: {
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.bg.elevated,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaCard: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.bg.elevated,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border.subtle,
    marginBottom: 16,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 13,
    color: colors.text.muted,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  noteCard: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.bg.elevated,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border.subtle,
    marginBottom: 20,
  },
  noteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.6,
  },
  noteEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteEditText: {
    fontSize: 12,
    color: colors.gold.champagne,
    fontWeight: '600',
  },
  noteText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  noteInput: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.bg.surface,
    borderWidth: isDark ? 0 : 1,
    borderColor: colors.border.subtle,
    borderRadius: 12,
    padding: 10,
    color: colors.text.primary,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  noteActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  noteCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)',
  },
  noteCancelText: {
    fontSize: 12,
    color: colors.text.muted,
    fontWeight: '600',
  },
  noteSaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.gold.primary,
  },
  noteSaveText: {
    fontSize: 12,
    color: '#090A0E',
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalEditFullBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.gold.primary,
    gap: 6,
  },
  modalEditFullText: {
    color: '#090A0E',
    fontSize: 14,
    fontWeight: '700',
  },
  modalDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    gap: 6,
  },
  modalDeleteText: {
    color: colors.flow.expense,
    fontSize: 14,
    fontWeight: '700',
  },
  modalCloseActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border.subtle,
  },
  modalCloseActionText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiSelectToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 83, 9, 0.2)',
  },
  multiSelectToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  selectActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
  },
  selectActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  cancelActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.gold.primary,
  },
  cancelActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#090A0E',
  },
  bulkActionBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: isDark ? '#161924' : colors.bg.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : colors.border.subtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.4 : 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  bulkActionInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bulkActionCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold.champagne,
    fontVariant: ['tabular-nums'],
  },
  bulkActionLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.flow.expense,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bulkDeleteText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  detailReceiptCard: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.bg.elevated,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border.subtle,
  },
  detailReceiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailReceiptDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  detailReceiptDeleteText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.flow.expense,
  },
  detailReceiptImageWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    height: 160,
    backgroundColor: '#000',
  },
  detailReceiptImage: {
    width: '100%',
    height: '100%',
  },
  detailReceiptBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailReceiptBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  fullReceiptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fullReceiptSafeArea: {
    flex: 1,
  },
  fullReceiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  fullReceiptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  fullReceiptCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullReceiptImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fullReceiptImage: {
    width: '100%',
    height: '100%',
  },
  bulkActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(180, 83, 9, 0.1)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(180, 83, 9, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bulkCatText: {
    color: colors.gold.champagne,
    fontSize: 12,
    fontWeight: '700',
  },
  bulkCatModalContent: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 83, 9, 0.2)',
  },
  bulkCatSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
    marginBottom: 8,
  },
  bulkCatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.bg.elevated,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.border.subtle,
  },
  bulkCatItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  bulkCatItemType: {
    fontSize: 11,
    color: colors.text.muted,
  },
  cancelBulkCatBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
  },
  historySection: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.bg.elevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border.subtle,
    marginBottom: 16,
  },
  historySectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold.champagne,
    letterSpacing: 1,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  historyBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold.primary,
    marginTop: 5,
  },
  historySummaryText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '500',
  },
  historyDateText: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 2,
  },
});
