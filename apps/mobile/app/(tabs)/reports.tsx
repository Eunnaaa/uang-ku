import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  PieChart,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Share2,
  TrendingUp,
  TrendingDown,
  Utensils,
  Car,
  ShoppingBag,
  FileText,
  Film,
  Heart,
  Book,
  Briefcase,
  Gift,
  Laptop,
  MoreHorizontal,
  Plus,
  X,
  AlertTriangle,
  Target,
  Trophy,
  Trash2,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { formatRupiah, generateTransactionsCsv, type CategoryModel } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import {
  getLocalTransactions,
  getLocalBudgets,
  saveLocalBudget,
  getLocalCategories,
  getLocalGoals,
  insertLocalGoal,
  addSavingsToGoal,
  deleteLocalGoal,
  type GoalModel,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

interface CategoryBreakdownItem {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  icon?: string | null;
}

export default function ReportsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    totalFees: 0,
    netCashFlow: 0,
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [allCategories, setAllCategories] = useState<CategoryModel[]>([]);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [selectedBudgetCatId, setSelectedBudgetCatId] = useState<string>('');
  const [budgetLimitInput, setBudgetLimitInput] = useState('');

  // Financial Goals (PRD Section 61)
  const [goals, setGoals] = useState<GoalModel[]>([]);
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalEmoji, setNewGoalEmoji] = useState('🎯');
  const [newGoalDate, setNewGoalDate] = useState('');
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedGoalForDeposit, setSelectedGoalForDeposit] = useState<GoalModel | null>(null);
  const [depositAmountInput, setDepositAmountInput] = useState('');

  const loadReportData = useCallback(async () => {
    try {
      const [allTx, localBudgets, cats, localGoals] = await Promise.all([
        getLocalTransactions(),
        getLocalBudgets(),
        getLocalCategories('expense'),
        getLocalGoals(),
      ]);
      setBudgets(localBudgets);
      setAllCategories(cats);
      setGoals(localGoals);
      if (cats.length > 0 && !selectedBudgetCatId) {
        setSelectedBudgetCatId(cats[0].id);
      }

      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const targetMonthKey = `${year}-${month}`;

      const monthlyTx = allTx.filter((t) => t.transactionDate.startsWith(targetMonthKey));

      let income = 0;
      let expense = 0;
      let fees = 0;
      const catMap = new Map<string, { id: string; name: string; amount: number; icon?: string | null }>();

      for (const t of monthlyTx) {
        if (t.type === 'income') {
          income += t.amount;
        } else if (t.type === 'expense') {
          expense += t.amount;
          const catId = t.categoryId || 'other';
          const catName = t.category?.name || 'Lainnya';
          const catIcon = t.category?.icon || null;
          const existing = catMap.get(catId);
          if (existing) {
            existing.amount += t.amount;
          } else {
            catMap.set(catId, { id: catId, name: catName, amount: t.amount, icon: catIcon });
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
        icon: c.icon,
      }));

      list.sort((a, b) => b.amount - a.amount);
      setCategoryBreakdown(list);
    } catch (err) {
      console.error(err);
    }
  }, [selectedDate, selectedBudgetCatId]);

  const handleSaveBudget = async () => {
    const numeric = parseInt(budgetLimitInput.replace(/\D/g, ''), 10);
    if (!numeric || numeric <= 0 || !selectedBudgetCatId) {
      toast.showWarning('Perhatian', 'Masukkan nominal batas anggaran yang valid.');
      return;
    }

    try {
      hapticMedium();
      await saveLocalBudget(selectedBudgetCatId, numeric);
      setIsBudgetModalOpen(false);
      setBudgetLimitInput('');
      toast.showSuccess('Anggaran Disimpan', `Batas pengeluaran ${formatRupiah(numeric)} aktif`);
      await loadReportData();
    } catch (err: any) {
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoalName.trim()) {
      toast.showWarning('Perhatian', 'Nama target tidak boleh kosong.');
      return;
    }
    const numTarget = parseInt(newGoalTarget.replace(/\D/g, ''), 10);
    if (!numTarget || numTarget <= 0) {
      toast.showWarning('Perhatian', 'Masukkan nominal target tabungan yang valid.');
      return;
    }

    try {
      hapticMedium();
      await insertLocalGoal({
        name: newGoalName.trim(),
        emoji: newGoalEmoji || '🎯',
        targetAmount: numTarget,
        targetDate: newGoalDate.trim() || undefined,
      });
      setIsAddGoalModalOpen(false);
      setNewGoalName('');
      setNewGoalTarget('');
      setNewGoalDate('');
      toast.showSuccess('Target Impian Dibuat', `${newGoalName.trim()} ditambahkan ke daftar`);
      await loadReportData();
    } catch (err: any) {
      toast.showError('Gagal Membuat Goal', err.message);
    }
  };

  const handleDepositToGoal = async () => {
    if (!selectedGoalForDeposit) return;
    const numDeposit = parseInt(depositAmountInput.replace(/\D/g, ''), 10);
    if (!numDeposit || numDeposit <= 0) {
      toast.showWarning('Perhatian', 'Masukkan nominal tabungan yang valid.');
      return;
    }

    try {
      hapticMedium();
      const { goal, isJustAchieved } = await addSavingsToGoal(selectedGoalForDeposit.id, numDeposit);
      setIsDepositModalOpen(false);
      setDepositAmountInput('');
      setSelectedGoalForDeposit(null);
      await loadReportData();

      if (isJustAchieved) {
        Alert.alert('🎉 Selamat!', `Goal "${goal.name}" kamu telah berhasil tercapai 100%! Pertahankan kebiasaan menabung yang luar biasa.`);
      } else {
        toast.showSuccess('Tabungan Ditambahkan', `${formatRupiah(numDeposit)} dialokasikan ke ${goal.name}`);
      }
    } catch (err: any) {
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  const handleDeleteGoal = (goal: GoalModel) => {
    Alert.alert(
      'Hapus Goal',
      `Apakah kamu yakin ingin menghapus goal "${goal.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await deleteLocalGoal(goal.id);
              toast.showSuccess('Goal Dihapus', goal.name);
              await loadReportData();
            } catch (err: any) {
              toast.showError('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  const renderCategoryIcon = (iconName?: string | null) => {
    const size = 15;
    const color = colors.gold.champagne;
    switch (iconName) {
      case 'utensils': return <Utensils size={size} color={color} />;
      case 'car': return <Car size={size} color={color} />;
      case 'shopping-bag': return <ShoppingBag size={size} color={color} />;
      case 'file-text': return <FileText size={size} color={color} />;
      case 'film': return <Film size={size} color={color} />;
      case 'heart': return <Heart size={size} color={color} />;
      case 'book': return <Book size={size} color={color} />;
      case 'briefcase': return <Briefcase size={size} color={color} />;
      case 'gift': return <Gift size={size} color={color} />;
      case 'laptop': return <Laptop size={size} color={color} />;
      default: return <MoreHorizontal size={size} color={color} />;
    }
  };

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const handlePrevMonth = () => {
    hapticSelection();
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    hapticSelection();
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleResetCurrentMonth = () => {
    hapticSelection();
    setSelectedDate(new Date());
  };

  const handleExportCsv = async () => {
    hapticMedium();
    try {
      const allTx = await getLocalTransactions();
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const targetMonthKey = `${year}-${month}`;

      const monthlyTx = allTx.filter((t) => t.transactionDate.startsWith(targetMonthKey));
      if (monthlyTx.length === 0) {
        Alert.alert('Ekspor CSV', `Tidak ada transaksi pada bulan ${periodLabel} untuk diekspor.`);
        return;
      }

      // Generate RFC 4180 CSV with UTF-8 BOM and OWASP sanitization
      const csvContent = generateTransactionsCsv(monthlyTx);
      const fileUri = `${FileSystem.cacheDirectory}UangKu_Laporan_${year}_${month}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Ekspor Laporan ${periodLabel}`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Sukses', `Berkas tersimpan di: ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Gagal Ekspor', err.message);
    }
  };

  const isNetPositive = summary.netCashFlow >= 0;
  const periodLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(selectedDate);
  const now = new Date();
  const isCurrentMonth =
    selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() === now.getMonth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Laporan Keuangan</Text>
          <View style={styles.headerActions}>
            {!isCurrentMonth && (
              <TouchableOpacity
                style={styles.todayBtn}
                onPress={handleResetCurrentMonth}
              >
                <Text style={styles.todayBtnText}>Bulan Ini</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExportCsv}
            >
              <Share2 size={13} color={colors.gold.champagne} />
              <Text style={styles.exportBtnText}>Ekspor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Period Month Navigator */}
        <View style={styles.periodNavigator}>
          <TouchableOpacity
            style={styles.navBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handlePrevMonth}
          >
            <ChevronLeft size={18} color={colors.gold.champagne} />
          </TouchableOpacity>

          <View style={styles.periodCenter}>
            <Calendar size={13} color={colors.gold.champagne} />
            <Text style={styles.periodText}>{periodLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleNextMonth}
          >
            <ChevronRight size={18} color={colors.gold.champagne} />
          </TouchableOpacity>
        </View>
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
          <Text style={styles.cardSectionLabel}>ARUS KAS PERIODE INI</Text>

          <View style={styles.flowRow}>
            <View style={styles.flowCol}>
              <View style={styles.flowHeaderRow}>
                <View style={[styles.flowIconCircle, { backgroundColor: colors.flow.incomeBg, borderColor: colors.flow.incomeBorder }]}>
                  <ArrowDownLeft size={11} color={colors.flow.income} />
                </View>
                <Text style={styles.flowLabel}>Total Pemasukan</Text>
              </View>
              <Text
                style={[styles.flowValue, { color: colors.flow.income }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                +{formatRupiah(summary.totalIncome)}
              </Text>
            </View>

            <View style={styles.flowDivider} />

            <View style={[styles.flowCol, styles.flowColRight]}>
              <View style={styles.flowHeaderRow}>
                <View style={[styles.flowIconCircle, { backgroundColor: colors.flow.expenseBg, borderColor: colors.flow.expenseBorder }]}>
                  <ArrowUpRight size={11} color={colors.flow.expense} />
                </View>
                <Text style={styles.flowLabel}>Total Pengeluaran</Text>
              </View>
              <Text
                style={[styles.flowValue, { color: colors.flow.expense }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                -{formatRupiah(summary.totalExpense)}
              </Text>
            </View>
          </View>

          {summary.totalFees > 0 && (
            <View style={styles.feeNoticeRow}>
              <Text style={styles.feeNoticeText}>Biaya Admin / Transfer:</Text>
              <Text style={[styles.feeNoticeVal, { color: colors.flow.expense }]}>-{formatRupiah(summary.totalFees)}</Text>
            </View>
          )}

          {/* Net Cash Flow Capsule Banner */}
          <View
            style={[
              styles.netCashFlowBanner,
              {
                backgroundColor: isNetPositive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                borderColor: isNetPositive ? 'rgba(16, 185, 129, 0.24)' : 'rgba(239, 68, 68, 0.24)',
              },
            ]}
          >
            <View style={styles.netCashFlowLeft}>
              {isNetPositive ? (
                <TrendingUp size={13} color={colors.flow.income} />
              ) : (
                <TrendingDown size={13} color={colors.flow.expense} />
              )}
              <Text style={styles.netCashFlowLabel}>Arus Kas Bersih</Text>
            </View>
            <Text
              style={[
                styles.netCashFlowValue,
                { color: isNetPositive ? colors.flow.income : colors.flow.expense },
              ]}
            >
              {isNetPositive ? '+' : ''}{formatRupiah(summary.netCashFlow)}
            </Text>
          </View>
        </View>

        {/* Section 60: Budget / Spending Limit per Category */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Batas Anggaran Bulanan</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={styles.addBudgetBtn}
              onPress={() => {
                hapticSelection();
                router.push('/budgets');
              }}
            >
              <Text style={styles.addBudgetText}>Kelola Penuh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBudgetBtn}
              onPress={() => {
                hapticSelection();
                setIsBudgetModalOpen(true);
              }}
            >
              <Plus size={12} color={colors.gold.champagne} />
              <Text style={styles.addBudgetText}>Atur Budget</Text>
            </TouchableOpacity>
          </View>
        </View>

        {Object.keys(budgets).length === 0 ? (
          <View style={styles.emptyBudgetCard}>
            <Text style={styles.emptyBudgetText}>Belum ada batas anggaran bulanan yang ditentukan.</Text>
          </View>
        ) : (
          Object.entries(budgets).map(([catId, budgetLimit]) => {
            const spent = categoryBreakdown.find((c) => c.id === catId)?.amount || 0;
            const percent = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : 0;
            const isOver = spent > budgetLimit;
            const isWarning = percent >= 80 && !isOver;
            const catObj = allCategories.find((c) => c.id === catId);
            const catName = catObj?.name || categoryBreakdown.find((c) => c.id === catId)?.name || 'Kategori';
            const catIcon = catObj?.icon;

            const barColor = isOver
              ? colors.flow.expense
              : isWarning
              ? colors.gold.primary
              : colors.flow.income;

            return (
              <View key={catId} style={styles.budgetCard}>
                <View style={styles.budgetTopRow}>
                  <View style={styles.budgetLeft}>
                    <View style={styles.catIconCircle}>
                      {renderCategoryIcon(catIcon)}
                    </View>
                    <View>
                      <Text style={styles.budgetName}>{catName}</Text>
                      <Text style={styles.budgetSub}>
                        {formatRupiah(spent)} dari {formatRupiah(budgetLimit)}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.budgetPercentBadge,
                      { backgroundColor: isOver ? colors.flow.expenseBg : 'rgba(212, 175, 55, 0.12)' },
                    ]}
                  >
                    <Text style={[styles.budgetPercentText, { color: barColor }]}>{percent}%</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${Math.min(percent, 100)}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>

                {isOver && (
                  <View style={styles.budgetOverRow}>
                    <AlertTriangle size={12} color={colors.flow.expense} />
                    <Text style={styles.budgetOverText}>
                      Melebihi budget {formatRupiah(spent - budgetLimit)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Expenses by Category Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pengeluaran per Kategori</Text>
        </View>

        {categoryBreakdown.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <PieChart size={24} color={colors.gold.champagne} />
            </View>
            <Text style={styles.emptyText}>Belum cukup data untuk menampilkan laporan.</Text>
          </View>
        ) : (
          categoryBreakdown.map((item) => (
            <View key={item.id} style={styles.categoryCard}>
              <View style={styles.catHeader}>
                <View style={styles.catLeft}>
                  <View style={styles.catIconCircle}>
                    {renderCategoryIcon(item.icon)}
                  </View>
                  <Text style={styles.catName}>{item.name}</Text>
                </View>
                <View style={styles.catRight}>
                  <Text style={styles.catAmount}>-{formatRupiah(item.amount)}</Text>
                  <View style={styles.catPercentBadge}>
                    <Text style={styles.catPercentText}>{item.percentage}%</Text>
                  </View>
                </View>
              </View>
              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.min(item.percentage, 100)}%` }]} />
              </View>
            </View>
          ))
        )}

        {/* Financial Goals / Tabungan Target (PRD Section 61) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Tabungan Target (Goals)</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={styles.addBudgetBtn}
              onPress={() => {
                hapticSelection();
                router.push('/goals');
              }}
            >
              <Text style={styles.addBudgetText}>Lihat Semua</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBudgetBtn}
              onPress={() => {
                hapticSelection();
                setIsAddGoalModalOpen(true);
              }}
            >
              <Plus size={12} color={colors.gold.champagne} />
              <Text style={styles.addBudgetText}>Tambah Goal</Text>
            </TouchableOpacity>
          </View>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyGoalCard}>
            <View style={styles.emptyGoalIconCircle}>
              <Target size={22} color={colors.gold.champagne} />
            </View>
            <Text style={styles.emptyGoalTitle}>Belum Ada Target Finansial</Text>
            <Text style={styles.emptyGoalSubtitle}>
              Mulai buat target impianmu seperti Dana Darurat, Liburan, atau Beli Gadget.
            </Text>
            <TouchableOpacity
              style={styles.emptyGoalActionBtn}
              onPress={() => {
                hapticSelection();
                setIsAddGoalModalOpen(true);
              }}
            >
              <Text style={styles.emptyGoalActionText}>+ Buat Target Sekarang</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((g) => {
            const percent = g.targetAmount > 0 ? Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100) : 0;
            const isAchieved = g.status === 'achieved' || g.currentAmount >= g.targetAmount;

            return (
              <View key={g.id} style={styles.goalCard}>
                <View style={styles.goalTopRow}>
                  <View style={styles.goalHeaderLeft}>
                    <View style={styles.goalEmojiCircle}>
                      <Text style={styles.goalEmojiText}>{g.emoji || '🎯'}</Text>
                    </View>
                    <View style={styles.goalInfoCol}>
                      <Text style={styles.goalTitle}>{g.name}</Text>
                      <Text style={styles.goalSubText}>
                        {formatRupiah(g.currentAmount)} dari {formatRupiah(g.targetAmount)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.goalHeaderRight}>
                    <View
                      style={[
                        styles.goalStatusBadge,
                        isAchieved ? styles.goalBadgeAchieved : styles.goalBadgeActive,
                      ]}
                    >
                      {isAchieved ? (
                        <Text style={styles.goalBadgeAchievedText}>Tercapai 🎉</Text>
                      ) : (
                        <Text style={styles.goalBadgeActiveText}>{percent}%</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => handleDeleteGoal(g)}
                      style={styles.goalDeleteBtn}
                    >
                      <Trash2 size={13} color={colors.text.muted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${percent}%`,
                        backgroundColor: isAchieved ? '#10B981' : colors.gold.primary,
                      },
                    ]}
                  />
                </View>

                {/* Bottom row: target date info & quick deposit action */}
                <View style={styles.goalBottomRow}>
                  <Text style={styles.goalDateText}>
                    {g.targetDate ? `Target: ${g.targetDate}` : isAchieved ? 'Target tercapai!' : 'Target berjalan'}
                  </Text>
                  {!isAchieved && (
                    <TouchableOpacity
                      style={styles.goalDepositBtn}
                      onPress={() => {
                        hapticSelection();
                        setSelectedGoalForDeposit(g);
                        setIsDepositModalOpen(true);
                      }}
                    >
                      <Plus size={11} color={colors.gold.champagne} />
                      <Text style={styles.goalDepositBtnText}>Nabung</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Set Budget Modal */}
      <Modal visible={isBudgetModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsBudgetModalOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atur Batas Anggaran</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsBudgetModalOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PILIH KATEGORI</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPillRow}>
                {allCategories.map((cat) => {
                  const isSelected = selectedBudgetCatId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catPill, isSelected && styles.catPillSelected]}
                      onPress={() => {
                        hapticSelection();
                        setSelectedBudgetCatId(cat.id);
                        if (budgets[cat.id]) {
                          setBudgetLimitInput(`Rp ${budgets[cat.id].toLocaleString('id-ID')}`);
                        }
                      }}
                    >
                      <Text style={[styles.catPillText, isSelected && styles.catPillTextSelected]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>BATAS PENGELUARAN MAKSIMUM</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rp 1.500.000"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={budgetLimitInput}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, '');
                  setBudgetLimitInput(num ? `Rp ${parseInt(num, 10).toLocaleString('id-ID')}` : '');
                }}
              />
            </View>

            <TouchableOpacity style={styles.saveBudgetBtn} onPress={handleSaveBudget}>
              <Text style={styles.saveBudgetBtnText}>Simpan Batas Anggaran</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Goal Modal (PRD Section 61) */}
      <Modal visible={isAddGoalModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsAddGoalModalOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Tabungan Target</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddGoalModalOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PILIH IKON EMOJI</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPillRow}>
                {['🎯', '🛡️', '✈️', '💻', '🚗', '🏠', '💍', '👶', '🎓', '🏖️'].map((emoji) => {
                  const isSelected = newGoalEmoji === emoji;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.catPill, isSelected && styles.catPillSelected]}
                      onPress={() => {
                        hapticSelection();
                        setNewGoalEmoji(emoji);
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAMA TARGET</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Misal: Dana Darurat 6 Bulan"
                placeholderTextColor={colors.text.muted}
                value={newGoalName}
                onChangeText={setNewGoalName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOMINAL TARGET TABUNGAN</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rp 20.000.000"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={newGoalTarget}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, '');
                  setNewGoalTarget(num ? `Rp ${parseInt(num, 10).toLocaleString('id-ID')}` : '');
                }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TARGET TANGGAL (OPSIONAL - YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2026-12-31"
                placeholderTextColor={colors.text.muted}
                value={newGoalDate}
                onChangeText={setNewGoalDate}
              />
            </View>

            <TouchableOpacity style={styles.saveBudgetBtn} onPress={handleCreateGoal}>
              <Text style={styles.saveBudgetBtnText}>Simpan Target Finansial</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quick Deposit Modal (PRD Section 61) */}
      <Modal visible={isDepositModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsDepositModalOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nabung ke {selectedGoalForDeposit?.name}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsDepositModalOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOMINAL SETORAN</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rp 500.000"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={depositAmountInput}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, '');
                  setDepositAmountInput(num ? `Rp ${parseInt(num, 10).toLocaleString('id-ID')}` : '');
                }}
              />
            </View>

            {/* Quick Chips */}
            <View style={[styles.catPillRow, { marginBottom: 16 }]}>
              {[100000, 250000, 500000, 1000000].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={styles.catPill}
                  onPress={() => {
                    hapticSelection();
                    setDepositAmountInput(`Rp ${amt.toLocaleString('id-ID')}`);
                  }}
                >
                  <Text style={styles.catPillText}>+{formatRupiah(amt)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBudgetBtn} onPress={handleDepositToGoal}>
              <Text style={styles.saveBudgetBtnText}>Setor Tabungan Sekarang</Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  exportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  periodNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12141D',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  navBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  periodCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  summaryCard: {
    backgroundColor: '#12141D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    marginBottom: 20,
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  flowCol: {
    flex: 1,
    paddingRight: 12,
  },
  flowColRight: {
    paddingRight: 0,
    paddingLeft: 12,
  },
  flowHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  flowIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  flowLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.muted,
  },
  flowValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  flowDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    color: colors.text.secondary,
    fontWeight: '600',
  },
  netCashFlowBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  netCashFlowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  netCashFlowLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  netCashFlowValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  categoryCard: {
    backgroundColor: '#12141D',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  catRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.flow.expense,
    fontVariant: ['tabular-nums'],
  },
  catPercentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  catPercentText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.flow.expense,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#1E2230',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.flow.expense,
    borderRadius: 3,
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12141D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 10,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  addBudgetText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  emptyBudgetCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#12141D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
    alignItems: 'center',
  },
  emptyBudgetText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  budgetCard: {
    backgroundColor: '#12141D',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  budgetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  budgetName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  budgetSub: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  budgetPercentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  budgetPercentText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  budgetOverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  budgetOverText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.flow.expense,
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
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
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
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  catPillRow: {
    gap: 8,
    paddingBottom: 4,
  },
  catPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#090A0E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catPillSelected: {
    backgroundColor: colors.gold.champagne,
    borderColor: colors.gold.primary,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  catPillTextSelected: {
    color: '#090A0E',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#090A0E',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    color: colors.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  saveBudgetBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveBudgetBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#090A0E',
  },
  emptyGoalCard: {
    backgroundColor: '#12141D',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyGoalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyGoalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  emptyGoalSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyGoalActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.gold.primary,
  },
  emptyGoalActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#090A0E',
  },
  goalCard: {
    backgroundColor: '#12141D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  goalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  goalEmojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalEmojiText: {
    fontSize: 18,
  },
  goalInfoCol: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  goalSubText: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  goalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  goalBadgeActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  goalBadgeActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
    fontVariant: ['tabular-nums'],
  },
  goalBadgeAchieved: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  goalBadgeAchievedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  goalDeleteBtn: {
    padding: 4,
  },
  goalBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  goalDateText: {
    fontSize: 10,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  goalDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  goalDepositBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
});
