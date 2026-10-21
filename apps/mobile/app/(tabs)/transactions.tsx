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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, Filter, Trash2, X, Cloud, CloudOff, Edit3, Check, Wallet, ZoomIn, Camera, Layers, Tag } from 'lucide-react-native';
import { formatRupiah, type TransactionModel, type CategoryModel } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import { TransactionItem } from '../../src/components/TransactionItem';
import { SyncEngine } from '../../src/sync/syncEngine';
import {
  getLocalTransactions,
  deleteLocalTransaction,
  updateLocalTransaction,
  bulkDeleteLocalTransactions,
  bulkRecategorizeTransactions,
  getLocalCategories,
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
  const params = useLocalSearchParams<{ accountId?: string }>();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(params.accountId || null);
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<TransactionModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionModel | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState('');
  const [isReceiptFullscreenOpen, setIsReceiptFullscreenOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isBulkCatModalOpen, setIsBulkCatModalOpen] = useState(false);
  const [amountFilter, setAmountFilter] = useState<'all' | 'lt_50k' | '50k_100k' | 'gt_100k'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>(['Kopi', 'Bensin', 'Gaji', 'Makan']);

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
  };

  const handleSaveNote = async () => {
    if (!selectedTx) return;
    try {
      hapticMedium();
      await updateLocalTransaction(selectedTx.id, { note: editNoteText.trim() || null });
      setSelectedTx((prev) => (prev ? { ...prev, note: editNoteText.trim() || null } : null));
      setIsEditingNote(false);
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
      const amountMatch = tx.amount.toString().includes(q);
      const formattedAmountMatch = formatRupiah(tx.amount).toLowerCase().includes(q);
      const dateMatch = tx.transactionDate.toLowerCase().includes(q);
      return Boolean(noteMatch || catMatch || accMatch || destAccMatch || amountMatch || formattedAmountMatch || dateMatch);
    });
  }, [transactions, searchQuery, amountFilter]);

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDate(filteredTransactions);
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
                : `${transactions.length} total transaksi tercatat`}
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
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={15} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Recent Searches (PRD Section 64) */}
      {!searchQuery && recentSearches.length > 0 && (
        <View style={styles.recentSearchContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentSearchScroll}>
            <Text style={styles.recentSearchLabel}>Cepat:</Text>
            {recentSearches.map((term, i) => (
              <TouchableOpacity
                key={i}
                style={styles.recentSearchChip}
                onPress={() => {
                  hapticSelection();
                  setSearchQuery(term);
                }}
              >
                <Text style={styles.recentSearchText}>{term}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick Amount Filter Chips (PRD Section 64) */}
      <View style={styles.amountFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.amountFilterScroll}>
          {(
            [
              { id: 'all', label: 'Semua Nominal' },
              { id: 'lt_50k', label: '< Rp 50rb' },
              { id: '50k_100k', label: 'Rp 50rb - 100rb' },
              { id: 'gt_100k', label: '> Rp 100rb' },
            ] as const
          ).map((item) => {
            const isSelected = amountFilter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.amountFilterChip, isSelected && styles.amountFilterChipActive]}
                onPress={() => {
                  hapticSelection();
                  setAmountFilter(item.id);
                }}
              >
                <Text style={[styles.amountFilterText, isSelected && styles.amountFilterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Active Account Filter Chip */}
      {selectedAccountId && (
        <View style={styles.activeFilterRow}>
          <View style={styles.activeFilterChip}>
            <Wallet size={12} color={colors.gold.champagne} />
            <Text style={styles.activeFilterChipText}>
              Dompet: {transactions.find((t) => t.accountId === selectedAccountId || t.destinationAccountId === selectedAccountId)?.account?.name || 'Terfilter'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticSelection();
                setSelectedAccountId(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={12} color={colors.gold.champagne} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Segment Filter Tabs */}
      <View style={styles.tabsRow}>
        {(['all', 'expense', 'income', 'transfer'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'all' ? 'Semua' : tab === 'expense' ? 'Pengeluaran' : tab === 'income' ? 'Pemasukan' : 'Transfer';
          const activeBorderColor =
            tab === 'income'
              ? colors.flow.income
              : tab === 'expense'
              ? colors.flow.expense
              : tab === 'transfer'
              ? colors.flow.transfer
              : colors.gold.champagne;
          const activeBg =
            tab === 'income'
              ? colors.flow.incomeBg
              : tab === 'expense'
              ? colors.flow.expenseBg
              : tab === 'transfer'
              ? colors.flow.transferBg
              : 'rgba(212, 175, 55, 0.16)';

          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.7}
              style={[
                styles.tabBtn,
                isActive && {
                  backgroundColor: activeBg,
                  borderColor: activeBorderColor,
                },
              ]}
              onPress={() => {
                hapticSelection();
                setActiveTab(tab);
              }}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  isActive && { color: activeBorderColor, fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
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
            <View style={styles.emptyIconWrap}>
              <Filter size={24} color={colors.gold.champagne} />
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
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141D',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
  },
  activeFilterRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
  dateGroupContainer: {
    marginBottom: 14,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 4,
  },
  dateGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  dailyNetBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dailyNetText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
    backgroundColor: '#12141D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
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
    paddingBottom: 28,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 14, 0.75)',
    justifyContent: 'flex-end',
  },
  modalDismissOverlay: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: '#12141D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalAmountCard: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCloseActionText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: '#161924',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
  recentSearchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  recentSearchScroll: {
    alignItems: 'center',
    gap: 8,
  },
  recentSearchLabel: {
    fontSize: 11,
    color: colors.text.muted,
    fontWeight: '600',
    marginRight: 2,
  },
  recentSearchChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#161924',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  recentSearchText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  amountFilterContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  amountFilterScroll: {
    alignItems: 'center',
    gap: 6,
  },
  amountFilterChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#12141D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  amountFilterChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: colors.gold.champagne,
  },
  amountFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
  },
  amountFilterTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
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
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
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
    backgroundColor: '#12141D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
});
