import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  Repeat,
  Play,
  Trash2,
  X,
  Calendar,
  Wallet,
  Clock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Tag,
} from 'lucide-react-native';
import {
  formatRupiah,
  type AccountModel,
  type CategoryModel,
  type RecurringRuleModel,
  type RecurringFrequency,
} from '@uangku/contracts';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
import {
  getLocalRecurringRules,
  insertLocalRecurringRule,
  toggleLocalRecurringRule,
  deleteLocalRecurringRule,
  executeRecurringRule,
  getLocalAccounts,
  getLocalCategories,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError, hapticLight } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

type FilterType = 'all' | 'expense' | 'income' | 'inactive';

const FREQUENCY_OPTIONS: { key: RecurringFrequency; label: string; period: string }[] = [
  { key: 'daily', label: 'Harian', period: 'Hari' },
  { key: 'weekly', label: 'Mingguan', period: 'Minggu' },
  { key: 'biweekly', label: '2 Mingguan', period: '2 Minggu' },
  { key: 'monthly', label: 'Bulanan', period: 'Bulan' },
  { key: 'yearly', label: 'Tahunan', period: 'Tahun' },
];

export default function RecurringScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<RecurringRuleModel[]>([]);
  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Add Rule Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [ruleType, setRuleType] = useState<'expense' | 'income'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [noteInput, setNoteInput] = useState('');
  const [nextDueDateInput, setNextDueDateInput] = useState(new Date().toISOString().slice(0, 10));

  const loadData = useCallback(async () => {
    try {
      const [allRules, allAccs, allCats] = await Promise.all([
        getLocalRecurringRules(),
        getLocalAccounts(),
        getLocalCategories(),
      ]);
      setRules(allRules);
      setAccounts(allAccs.filter((a) => !a.isArchived));
      setCategories(allCats.filter((c) => !c.isArchived));

      if (allAccs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(allAccs[0].id);
      }
    } catch (err: any) {
      console.error(err);
      toast.showError('Gagal Memuat Data', err.message);
    }
  }, [selectedAccountId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleToggle = async (rule: RecurringRuleModel) => {
    try {
      hapticSelection();
      const nextActive = !rule.isActive;
      await toggleLocalRecurringRule(rule.id, nextActive);
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: nextActive } : r))
      );
      toast.showInfo(
        nextActive ? 'Jadwal Diaktifkan' : 'Jadwal Dijeda',
        `${rule.note || 'Transaksi'} ${nextActive ? 'akan berjalan otomatis' : 'dijeda'}.`
      );
    } catch (err: any) {
      hapticError();
      toast.showError('Gagal Mengubah Status', err.message);
    }
  };

  const handleExecute = async (rule: RecurringRuleModel) => {
    try {
      hapticMedium();
      const tx = await executeRecurringRule(rule.id);
      hapticSuccess();
      toast.showSuccess(
        'Transaksi Dicatat',
        `${formatRupiah(tx.amount)} berhasil dicatat ke saldo ${rule.accountName || 'akun'}.`
      );
      await loadData();
    } catch (err: any) {
      hapticError();
      toast.showError('Gagal Mencatat', err.message);
    }
  };

  const handleDelete = (rule: RecurringRuleModel) => {
    hapticLight();
    Alert.alert(
      'Hapus Jadwal Berulang',
      `Yakin ingin menghapus jadwal "${rule.note || rule.categoryName || 'Transaksi'}"? Transaksi yang sudah dicatat sebelumnya tidak akan hilang.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticSuccess();
              await deleteLocalRecurringRule(rule.id);
              toast.showSuccess('Jadwal Dihapus', rule.note || 'Aturan berhasil dihapus.');
              await loadData();
            } catch (err: any) {
              hapticError();
              toast.showError('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleSaveRule = async () => {
    const rawDigits = amountInput.replace(/\D/g, '');
    const numericAmount = parseInt(rawDigits, 10);

    if (!numericAmount || numericAmount <= 0) {
      toast.showWarning('Nominal Kosong', 'Masukkan nominal transaksi berulang yang valid.');
      return;
    }

    if (!selectedAccountId) {
      toast.showWarning('Pilih Rekening', 'Tentukan rekening atau dompet untuk transaksi ini.');
      return;
    }

    try {
      hapticMedium();
      await insertLocalRecurringRule({
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        type: ruleType,
        amount: numericAmount,
        frequency,
        note: noteInput.trim() || undefined,
        nextDueDate: nextDueDateInput || undefined,
      });

      hapticSuccess();
      toast.showSuccess('Jadwal Dibuat', `${formatRupiah(numericAmount)} (${frequency})`);
      setIsAddModalOpen(false);
      setAmountInput('');
      setNoteInput('');
      await loadData();
    } catch (err: any) {
      hapticError();
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  // Calculations
  const activeRules = rules.filter((r) => r.isActive);
  const monthlyEstimatedExpense = activeRules.reduce((acc, r) => {
    if (r.type !== 'expense') return acc;
    if (r.frequency === 'daily') return acc + r.amount * 30;
    if (r.frequency === 'weekly') return acc + r.amount * 4.3;
    if (r.frequency === 'biweekly') return acc + r.amount * 2.15;
    if (r.frequency === 'monthly') return acc + r.amount;
    if (r.frequency === 'yearly') return acc + Math.round(r.amount / 12);
    return acc;
  }, 0);

  const filteredRules = rules.filter((r) => {
    if (activeFilter === 'expense') return r.type === 'expense' && r.isActive;
    if (activeFilter === 'income') return r.type === 'income' && r.isActive;
    if (activeFilter === 'inactive') return !r.isActive;
    return true;
  });

  const getFrequencyLabel = (freq: RecurringFrequency) => {
    const match = FREQUENCY_OPTIONS.find((f) => f.key === freq);
    return match ? match.label : freq;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              hapticSelection();
              router.back();
            }}
          >
            <ChevronLeft size={22} color={colors.gold.champagne} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Transaksi Berulang</Text>
            <Text style={styles.headerSubtitle}>Jadwal Otomatis & Tagihan Rutin</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setIsAddModalOpen(true);
          }}
        >
          <Plus size={14} color={isDark ? '#090A0E' : '#FFFFFF'} />
          <Text style={styles.addBtnText}>Jadwal Baru</Text>
        </TouchableOpacity>
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
        {/* Metric Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Repeat size={14} color={colors.gold.champagne} />
            <Text style={styles.summaryHeaderLabel}>TOTAL KOMITMEN RUTIN</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Estimasi Beban Bulanan</Text>
              <Text style={styles.summaryValueExpense}>
                {formatRupiah(Math.round(monthlyEstimatedExpense))}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Jadwal Berjalan</Text>
              <Text style={styles.summaryValueCount}>
                {activeRules.length} <Text style={styles.summarySubUnit}>/ {rules.length} Aturan</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(['all', 'expense', 'income', 'inactive'] as FilterType[]).map((tab) => {
            const isSelected = activeFilter === tab;
            const label =
              tab === 'all'
                ? `Semua (${rules.length})`
                : tab === 'expense'
                ? 'Pengeluaran'
                : tab === 'income'
                ? 'Pemasukan'
                : 'Dijeda';
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => {
                  hapticSelection();
                  setActiveFilter(tab);
                }}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Rules List */}
        {filteredRules.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Repeat size={24} color={colors.gold.champagne} />
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Transaksi Berulang</Text>
            <Text style={styles.emptySubtitle}>
              Otomatiskan pencatatan tagihan bulanan seperti Netflix, sewa tempat, internet, atau gaji rutin tanpa repot input berulang kali.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => {
                hapticSelection();
                setIsAddModalOpen(true);
              }}
            >
              <Plus size={14} color={isDark ? '#090A0E' : '#FFFFFF'} />
              <Text style={styles.emptyActionText}>Buat Jadwal Pertama</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredRules.map((rule) => {
            const isIncome = rule.type === 'income';
            return (
              <View key={rule.id} style={[styles.ruleCard, !rule.isActive && styles.ruleCardInactive]}>
                <View style={styles.ruleTopRow}>
                  <View style={styles.ruleLeft}>
                    <View
                      style={[
                        styles.ruleIconCircle,
                        {
                          backgroundColor: isIncome
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        },
                      ]}
                    >
                      {isIncome ? (
                        <TrendingUp size={16} color={colors.flow.income} />
                      ) : (
                        <TrendingDown size={16} color={colors.flow.expense} />
                      )}
                    </View>
                    <View style={styles.ruleInfoCol}>
                      <View style={styles.ruleTitleRow}>
                        <Text style={styles.ruleTitle} numberOfLines={1}>
                          {rule.note || rule.categoryName || 'Transaksi Berulang'}
                        </Text>
                        <View style={styles.freqBadge}>
                          <Clock size={10} color={colors.gold.champagne} />
                          <Text style={styles.freqBadgeText}>
                            {getFrequencyLabel(rule.frequency)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.ruleAccountSub}>
                        {rule.accountName || 'Rekening'} • {rule.categoryName || 'Umum'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ruleRightCol}>
                    <Text
                      style={[
                        styles.ruleAmount,
                        { color: isIncome ? colors.flow.income : colors.text.primary },
                      ]}
                    >
                      {isIncome ? '+' : '-'}{formatRupiah(rule.amount)}
                    </Text>
                    <Switch
                      value={rule.isActive}
                      onValueChange={() => handleToggle(rule)}
                      trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
                      thumbColor={colors.text.primary}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                </View>

                {/* Bottom Actions Row */}
                <View style={styles.ruleBottomRow}>
                  <View style={styles.ruleDueCol}>
                    <Calendar size={11} color={colors.text.muted} />
                    <Text style={styles.ruleDueText}>
                      Jatuh Tempo: {rule.nextDueDate || 'Hari ini'}
                    </Text>
                  </View>

                  <View style={styles.ruleBtnActions}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.executeBtn}
                      onPress={() => handleExecute(rule)}
                    >
                      <Play size={11} color="#090A0E" fill="#090A0E" />
                      <Text style={styles.executeBtnText}>Catat Sekarang</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(rule)}
                    >
                      <Trash2 size={13} color={colors.flow.expense} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsAddModalOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Jadwal Berulang</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {/* Type Switcher */}
              <View style={styles.typeSwitcher}>
                <TouchableOpacity
                  style={[styles.typeBtn, ruleType === 'expense' && styles.typeBtnActiveExpense]}
                  onPress={() => {
                    hapticSelection();
                    setRuleType('expense');
                  }}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      ruleType === 'expense' && styles.typeBtnTextActive,
                    ]}
                  >
                    Pengeluaran Rutin
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, ruleType === 'income' && styles.typeBtnActiveIncome]}
                  onPress={() => {
                    hapticSelection();
                    setRuleType('income');
                  }}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      ruleType === 'income' && styles.typeBtnTextActive,
                    ]}
                  >
                    Pemasukan Rutin
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NOMINAL TRANSAKSI</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencyPrefix}>Rp</Text>
                  <TextInput
                    style={styles.amountTextInput}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={amountInput}
                    onChangeText={(val) => {
                      const num = parseInt(val.replace(/\D/g, ''), 10);
                      setAmountInput(isNaN(num) ? '' : num.toLocaleString('id-ID'));
                    }}
                  />
                </View>
              </View>

              {/* Note / Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NAMA JADWAL / TAGIHAN</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="cth. Langganan Netflix, Kontrakan, Wifi"
                  placeholderTextColor={colors.text.muted}
                  value={noteInput}
                  onChangeText={setNoteInput}
                />
              </View>

              {/* Frequency Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FREKUENSI PERULANGAN</Text>
                <View style={styles.freqRow}>
                  {FREQUENCY_OPTIONS.map((f) => {
                    const isSelected = frequency === f.key;
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.freqChip, isSelected && styles.freqChipActive]}
                        onPress={() => {
                          hapticSelection();
                          setFrequency(f.key);
                        }}
                      >
                        <Text
                          style={[
                            styles.freqChipText,
                            isSelected && styles.freqChipTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Account Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>REKENING / DOMPET SUMBER</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                  {accounts.map((acc) => {
                    const isSelected = selectedAccountId === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        style={[styles.selectChip, isSelected && styles.selectChipActive]}
                        onPress={() => {
                          hapticSelection();
                          setSelectedAccountId(acc.id);
                        }}
                      >
                        <Wallet size={12} color={isSelected ? '#090A0E' : colors.gold.champagne} />
                        <Text style={[styles.selectChipText, isSelected && styles.selectChipTextActive]}>
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Category Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>KATEGORI</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                  {categories
                    .filter((c) => c.type === ruleType)
                    .map((cat) => {
                      const isSelected = selectedCategoryId === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.selectChip, isSelected && styles.selectChipActive]}
                          onPress={() => {
                            hapticSelection();
                            setSelectedCategoryId(cat.id);
                          }}
                        >
                          <Tag size={12} color={isSelected ? '#090A0E' : colors.text.secondary} />
                          <Text style={[styles.selectChipText, isSelected && styles.selectChipTextActive]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>

              {/* Next Due Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TANGGAL MULAI / JATUH TEMPO (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.text.muted}
                  value={nextDueDateInput}
                  onChangeText={setNextDueDateInput}
                />
              </View>

              <TouchableOpacity
                style={styles.saveSubmitBtn}
                activeOpacity={0.8}
                onPress={handleSaveRule}
              >
                <Sparkles size={16} color={isDark ? '#090A0E' : '#FFFFFF'} />
                <Text style={styles.saveSubmitText}>Simpan Jadwal Rutin</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.bg.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.text.muted,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDark ? '#090A0E' : '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    gap: 14,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.gold.champagne,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCol: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border.subtle,
    marginHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 4,
  },
  summaryValueExpense: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: -0.3,
  },
  summaryValueCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  summarySubUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.muted,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  filterChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.gold.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: isDark ? '#090A0E' : '#FFFFFF',
  },
  ruleCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 12,
  },
  ruleCardInactive: {
    opacity: 0.6,
  },
  ruleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  ruleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleInfoCol: {
    flex: 1,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flexShrink: 1,
  },
  freqBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  freqBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  ruleAccountSub: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  ruleRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  ruleAmount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  ruleBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  ruleDueCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ruleDueText: {
    fontSize: 11,
    color: colors.text.muted,
  },
  ruleBtnActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  executeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  executeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: isDark ? '#090A0E' : '#FFFFFF',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalDismissOverlay: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.subtle,
    alignSelf: 'center',
    marginVertical: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.bg.elevated,
  },
  modalScroll: {
    gap: 16,
    paddingBottom: 20,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    padding: 3,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  typeBtnActiveExpense: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  typeBtnActiveIncome: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  typeBtnTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.text.muted,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold.champagne,
    marginRight: 6,
  },
  amountTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    paddingVertical: 12,
  },
  textInput: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  freqChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  freqChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.gold.primary,
  },
  freqChipText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  freqChipTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  chipsScroll: {
    gap: 8,
  },
  selectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  selectChipActive: {
    backgroundColor: colors.gold.primary,
    borderColor: colors.gold.primary,
  },
  selectChipText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  selectChipTextActive: {
    color: isDark ? '#090A0E' : '#FFFFFF',
    fontWeight: '700',
  },
  saveSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  saveSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: isDark ? '#090A0E' : '#FFFFFF',
  },
});
