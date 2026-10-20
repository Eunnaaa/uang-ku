import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  PieChart,
  AlertTriangle,
  CheckCircle2,
  X,
  Sliders,
  TrendingDown,
  ShoppingBag,
  Utensils,
  Car,
  FileText,
  Film,
  Heart,
  Book,
  Briefcase,
  Gift,
  Laptop,
  MoreHorizontal,
} from 'lucide-react-native';
import { formatRupiah, type CategoryModel } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import {
  getLocalBudgets,
  saveLocalBudget,
  getLocalCategories,
  getLocalTransactions,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

const PRESET_LIMITS = [500000, 1000000, 2000000, 5000000];

export default function BudgetsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});

  // Set Budget Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [limitInput, setLimitInput] = useState('');

  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [cats, localBudgets, txs] = await Promise.all([
        getLocalCategories('expense'),
        getLocalBudgets(),
        getLocalTransactions(),
      ]);

      setCategories(cats);
      setBudgets(localBudgets);

      // Aggregate expenses by category for current month
      const spending: Record<string, number> = {};
      for (const t of txs) {
        if (t.type === 'expense' && t.categoryId && t.transactionDate.startsWith(currentMonthKey)) {
          spending[t.categoryId] = (spending[t.categoryId] || 0) + t.amount;
        }
      }
      setSpentMap(spending);

      if (cats.length > 0 && !selectedCatId) {
        setSelectedCatId(cats[0].id);
      }
    } catch (err) {
      console.error('Failed to load budgets data:', err);
    }
  }, [selectedCatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleOpenSetBudget = (catId?: string) => {
    hapticSelection();
    const targetCat = catId || (categories.length > 0 ? categories[0].id : '');
    setSelectedCatId(targetCat);
    const existing = budgets[targetCat] || 0;
    setLimitInput(existing > 0 ? String(existing) : '');
    setIsModalOpen(true);
  };

  const handleSaveBudget = async () => {
    const numeric = parseInt(limitInput.replace(/\D/g, ''), 10);
    if (!numeric || numeric <= 0 || !selectedCatId) {
      toast.showWarning('Perhatian', 'Masukkan nominal batas anggaran yang valid.');
      return;
    }

    try {
      hapticMedium();
      await saveLocalBudget(selectedCatId, numeric);
      setIsModalOpen(false);
      setLimitInput('');
      const cat = categories.find((c) => c.id === selectedCatId);
      toast.showSuccess('Anggaran Disimpan', `Batas ${cat?.name || 'kategori'}: ${formatRupiah(numeric)}`);
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  const handleResetBudget = async (catId: string) => {
    try {
      hapticMedium();
      await saveLocalBudget(catId, 0);
      toast.showSuccess('Anggaran Direset');
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Mereset', err.message);
    }
  };

  // Calculations
  const totalBudget = Object.values(budgets).reduce((sum, b) => sum + (b || 0), 0);
  const totalSpentOnBudgeted = Object.entries(budgets).reduce((sum, [catId, limit]) => {
    if (limit > 0) {
      return sum + (spentMap[catId] || 0);
    }
    return sum;
  }, 0);
  const remainingBudget = Math.max(0, totalBudget - totalSpentOnBudgeted);
  const overallPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpentOnBudgeted / totalBudget) * 100)) : 0;

  const getCategoryIcon = (name?: string) => {
    const size = 18;
    const color = colors.gold.champagne;
    const lower = (name || '').toLowerCase();
    if (lower.includes('makan') || lower.includes('food')) return <Utensils size={size} color={color} />;
    if (lower.includes('transport') || lower.includes('bensin')) return <Car size={size} color={color} />;
    if (lower.includes('belanja') || lower.includes('shop')) return <ShoppingBag size={size} color={color} />;
    if (lower.includes('tagihan') || lower.includes('bill')) return <FileText size={size} color={color} />;
    if (lower.includes('hiburan') || lower.includes('film')) return <Film size={size} color={color} />;
    if (lower.includes('kesehatan') || lower.includes('sehat')) return <Heart size={size} color={color} />;
    if (lower.includes('edukasi') || lower.includes('buku')) return <Book size={size} color={color} />;
    if (lower.includes('kerja') || lower.includes('bisnis')) return <Briefcase size={size} color={color} />;
    if (lower.includes('hadiah') || lower.includes('gift')) return <Gift size={size} color={color} />;
    if (lower.includes('gadget') || lower.includes('elektronik')) return <Laptop size={size} color={color} />;
    return <MoreHorizontal size={size} color={color} />;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
        >
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anggaran Fleksibel</Text>
        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => handleOpenSetBudget()}
        >
          <Plus size={18} color="#090A0E" strokeWidth={2.6} />
        </TouchableOpacity>
      </View>

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
        {/* Overall Health Card */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewTop}>
            <View>
              <Text style={styles.overviewLabel}>Kesehatan Anggaran Bulan Ini</Text>
              <Text style={styles.overviewTitle}>
                {totalBudget > 0 ? `${overallPercentage}% Terpakai` : 'Belum Ada Anggaran'}
              </Text>
            </View>
            <View style={styles.overviewIconCircle}>
              <PieChart size={22} color={colors.gold.champagne} />
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${overallPercentage}%`,
                  backgroundColor:
                    overallPercentage > 100
                      ? colors.flow.expense
                      : overallPercentage > 80
                      ? colors.gold.primary
                      : colors.flow.income,
                },
              ]}
            />
          </View>

          <View style={styles.overviewMetricsRow}>
            <View>
              <Text style={styles.metricLabel}>Total Pagu</Text>
              <Text style={styles.metricValue}>{formatRupiah(totalBudget)}</Text>
            </View>
            <View>
              <Text style={styles.metricLabel}>Sudah Dibelanjakan</Text>
              <Text style={[styles.metricValue, { color: colors.flow.expense }]}>
                {formatRupiah(totalSpentOnBudgeted)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metricLabel}>Sisa Aman</Text>
              <Text style={[styles.metricValue, { color: colors.flow.income }]}>
                {formatRupiah(remainingBudget)}
              </Text>
            </View>
          </View>
        </View>

        {/* Categories Budget List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pagu Kategori Pengeluaran</Text>
          <Text style={styles.sectionSubtitle}>Pantau dan hindari pengeluaran berlebih</Text>
        </View>

        {categories.map((cat) => {
          const limit = budgets[cat.id] || 0;
          const spent = spentMap[cat.id] || 0;
          const hasBudget = limit > 0;
          const pct = hasBudget ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
          const isOver = hasBudget && spent > limit;
          const overAmount = spent - limit;

          return (
            <View key={cat.id} style={styles.budgetItemCard}>
              <View style={styles.itemTopRow}>
                <View style={styles.itemLeft}>
                  <View style={styles.catIconCircle}>{getCategoryIcon(cat.name)}</View>
                  <View>
                    <Text style={styles.catName}>{cat.name}</Text>
                    <Text style={styles.spentText}>
                      Terpakai: <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{formatRupiah(spent)}</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.itemRight}>
                  {hasBudget ? (
                    <TouchableOpacity
                      style={styles.editPencilBtn}
                      onPress={() => handleOpenSetBudget(cat.id)}
                    >
                      <Sliders size={14} color={colors.gold.champagne} />
                      <Text style={styles.limitText}>{formatRupiah(limit)}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.setBudgetBtn}
                      onPress={() => handleOpenSetBudget(cat.id)}
                    >
                      <Plus size={12} color="#090A0E" strokeWidth={2.4} />
                      <Text style={styles.setBudgetText}>Atur Pagu</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {hasBudget && (
                <>
                  <View style={styles.itemProgressTrack}>
                    <View
                      style={[
                        styles.itemProgressFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: isOver ? colors.flow.expense : pct > 80 ? colors.gold.primary : colors.flow.income,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.itemStatusRow}>
                    {isOver ? (
                      <View style={styles.warningPill}>
                        <AlertTriangle size={11} color={colors.flow.expense} />
                        <Text style={styles.warningText}>Melebihi batas +{formatRupiah(overAmount)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.remainingText}>
                        Sisa: {formatRupiah(limit - spent)} ({100 - pct}%)
                      </Text>
                    )}
                    <TouchableOpacity onPress={() => handleResetBudget(cat.id)}>
                      <Text style={styles.resetText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Set Budget Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atur Batas Anggaran</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Pilih Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catChipsScroll}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, selectedCatId === c.id && styles.catChipActive]}
                  onPress={() => {
                    hapticSelection();
                    setSelectedCatId(c.id);
                  }}
                >
                  <Text style={[styles.catChipText, selectedCatId === c.id && styles.catChipTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Batas Maksimal Bulanan</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
              value={limitInput ? `Rp ${parseInt(limitInput, 10).toLocaleString('id-ID')}` : ''}
              onChangeText={(val) => setLimitInput(val.replace(/\D/g, ''))}
            />

            {/* Quick Preset Chips */}
            <View style={styles.presetRow}>
              {PRESET_LIMITS.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.presetChip}
                  onPress={() => {
                    hapticSelection();
                    setLimitInput(String(amount));
                  }}
                >
                  <Text style={styles.presetText}>{formatRupiah(amount)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveBudget}>
              <Text style={styles.saveSubmitText}>Simpan Anggaran</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  overviewCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    marginBottom: 20,
  },
  overviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.muted,
    marginBottom: 4,
  },
  overviewTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.gold.light,
    letterSpacing: -0.4,
  },
  overviewIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.hairline,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  overviewMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.text.muted,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  budgetItemCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.gold.hairline,
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  spentText: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  editPencilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.gold.hairline,
  },
  limitText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  setBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  setBudgetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#090A0E',
  },
  itemProgressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginTop: 12,
  },
  itemProgressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  itemStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  warningText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.flow.expense,
  },
  remainingText: {
    fontSize: 11,
    color: colors.text.muted,
  },
  resetText: {
    fontSize: 11,
    color: colors.text.muted,
    textDecorationLine: 'underline',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: colors.border.subtle,
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
    marginTop: 12,
  },
  catChipsScroll: {
    marginBottom: 6,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.bg.elevated,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  catChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.gold.primary,
  },
  catChipText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
  },
  presetText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
  saveSubmitBtn: {
    backgroundColor: colors.gold.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  saveSubmitText: {
    color: '#090A0E',
    fontSize: 15,
    fontWeight: '700',
  },
});
