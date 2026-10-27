import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
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
  CheckCircle2,
  Sliders,
  Sparkles,
  Check,
} from 'lucide-react-native';
import { AppIcon, GOAL_ICON_KEYS } from '../../src/components/AppIcon';
import { CashFlowCircularChart } from '../../src/components/CashFlowCircularChart';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { formatRupiah, generateTransactionsCsv, type CategoryModel } from '@uangku/contracts';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
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

type ReportTab = 'categories' | 'budgets' | 'goals';

export default function ReportsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<ReportTab>('categories');

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

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
  const [newGoalEmoji, setNewGoalEmoji] = useState('target');
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

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  useFocusEffect(
    useCallback(() => {
      loadReportData();
    }, [loadReportData])
  );

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

  const periodLabel = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(selectedDate);
  }, [selectedDate]);

  const now = new Date();
  const isCurrentMonth =
    selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() === now.getMonth();

  const isNetPositive = summary.netCashFlow >= 0;
  const isNetZero = summary.netCashFlow === 0;

  // Computed metrics for cash flow ratio
  const totalFlow = summary.totalIncome + summary.totalExpense;
  const incomeRatio = totalFlow > 0 ? Math.round((summary.totalIncome / totalFlow) * 100) : 0;
  const expenseRatio = totalFlow > 0 ? 100 - incomeRatio : 0;
  const savingsRate =
    summary.totalIncome > 0
      ? Math.max(0, Math.round(((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100))
      : 0;

  // Computed metrics for budgets
  const budgetCount = Object.keys(budgets).length;
  const totalBudgetLimit = useMemo(() => {
    return Object.values(budgets).reduce((acc, b) => acc + b, 0);
  }, [budgets]);

  const totalBudgetSpent = useMemo(() => {
    return Object.entries(budgets).reduce((acc, [catId]) => {
      const spent = categoryBreakdown.find((c) => c.id === catId)?.amount || 0;
      return acc + spent;
    }, 0);
  }, [budgets, categoryBreakdown]);

  const overBudgetCategoriesCount = useMemo(() => {
    return Object.entries(budgets).filter(([catId, limit]) => {
      const spent = categoryBreakdown.find((c) => c.id === catId)?.amount || 0;
      return spent > limit;
    }).length;
  }, [budgets, categoryBreakdown]);

  // Computed metrics for goals
  const totalGoalsTarget = useMemo(() => {
    return goals.reduce((acc, g) => acc + g.targetAmount, 0);
  }, [goals]);

  const totalGoalsSaved = useMemo(() => {
    return goals.reduce((acc, g) => acc + g.currentAmount, 0);
  }, [goals]);

  const achievedGoalsCount = useMemo(() => {
    return goals.filter((g) => g.status === 'achieved' || g.currentAmount >= g.targetAmount).length;
  }, [goals]);

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
        emoji: newGoalEmoji || 'target',
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
        Alert.alert('Selamat!', `Goal "${goal.name}" kamu telah berhasil tercapai 100%! Pertahankan kebiasaan menabung yang luar biasa.`);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Header & Month Navigator */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Laporan Keuangan</Text>
            <Text style={styles.headerSubtitle}>Analisis & Ringkasan Finansial</Text>
          </View>
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

        {/* Period Month Navigator Pill */}
        <View style={styles.periodNavigator}>
          <TouchableOpacity
            style={styles.navBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={handlePrevMonth}
          >
            <ChevronLeft size={18} color={colors.gold.champagne} />
          </TouchableOpacity>

          <View style={styles.periodCenter}>
            <Calendar size={13} color={colors.gold.champagne} />
            <Text style={styles.periodText}>{periodLabel}</Text>
            {isCurrentMonth && <View style={styles.currentMonthDot} />}
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={handleNextMonth}
          >
            <ChevronRight size={18} color={colors.gold.champagne} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.champagne}
          />
        }
      >
        {/* 2. Executive Cash Flow Circular Diagram & KPI Cards */}
        <CashFlowCircularChart
          inflow={summary.totalIncome}
          outflow={summary.totalExpense}
          netCashFlow={summary.netCashFlow}
          totalFees={summary.totalFees}
        />

        {/* 3. Fluid Segmented Switcher */}
        <View style={styles.segmentContainer}>
          {(
            [
              { key: 'categories', label: 'Kategori', count: categoryBreakdown.length },
              { key: 'budgets', label: 'Anggaran', count: budgetCount },
              { key: 'goals', label: 'Target', count: goals.length },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.7}
                style={[styles.segmentTab, isActive && styles.segmentTabActive]}
                onPress={() => {
                  hapticSelection();
                  setActiveTab(tab.key);
                }}
              >
                <Text style={[styles.segmentTabText, isActive && styles.segmentTabTextActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.segmentBadge, isActive && styles.segmentBadgeActive]}>
                    <Text style={[styles.segmentBadgeText, isActive && styles.segmentBadgeTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. Tab 1: Kategori (Expenses Breakdown) */}
        {activeTab === 'categories' && (
          <View style={styles.tabContentSection}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Pengeluaran per Kategori</Text>
                <Text style={styles.sectionSubtitle}>
                  {categoryBreakdown.length > 0
                    ? `${categoryBreakdown.length} kategori • Total ${formatRupiah(summary.totalExpense)}`
                    : 'Belum ada pengeluaran pada periode ini'}
                </Text>
              </View>
            </View>

            {categoryBreakdown.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <PieChart size={24} color={colors.gold.champagne} />
                </View>
                <Text style={styles.emptyTitle}>Belum Ada Pengeluaran</Text>
                <Text style={styles.emptySubtitle}>
                  Transaksi pengeluaran yang dicatat pada bulan {periodLabel} akan otomatis dianalisis di sini.
                </Text>
              </View>
            ) : (
              categoryBreakdown.map((item, idx) => (
                <View key={item.id} style={styles.categoryCard}>
                  <View style={styles.catHeader}>
                    <View style={styles.catLeft}>
                      <View style={styles.catRankBadge}>
                        <Text style={styles.catRankText}>#{idx + 1}</Text>
                      </View>
                      <View style={styles.catIconCircle}>
                        {renderCategoryIcon(item.icon)}
                      </View>
                      <View style={styles.catNameCol}>
                        <Text style={styles.catName}>{item.name}</Text>
                        <Text style={styles.catShareText}>{item.percentage}% dari pengeluaran</Text>
                      </View>
                    </View>
                    <View style={styles.catRight}>
                      <Text style={styles.catAmount}>-{formatRupiah(item.amount)}</Text>
                    </View>
                  </View>
                  {/* Progress Bar */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(item.percentage, 100)}%`,
                          backgroundColor: idx === 0 ? colors.flow.expense : idx === 1 ? colors.gold.primary : colors.flow.transfer,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 5. Tab 2: Batas Anggaran (Budgets) */}
        {activeTab === 'budgets' && (
          <View style={styles.tabContentSection}>
            {/* Budget Health Overview Banner */}
            {budgetCount > 0 && (
              <View style={styles.budgetHealthCard}>
                <View style={styles.budgetHealthTop}>
                  <View>
                    <Text style={styles.budgetHealthLabel}>TOTAL ANGGARAN BULAN INI</Text>
                    <Text style={styles.budgetHealthVal}>
                      {formatRupiah(totalBudgetSpent)}{' '}
                      <Text style={styles.budgetHealthLimit}>/ {formatRupiah(totalBudgetLimit)}</Text>
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.budgetHealthBadge,
                      {
                        backgroundColor:
                          overBudgetCategoriesCount > 0
                            ? colors.flow.expenseBg
                            : 'rgba(16, 185, 129, 0.12)',
                        borderColor:
                          overBudgetCategoriesCount > 0
                            ? colors.flow.expenseBorder
                            : 'rgba(16, 185, 129, 0.25)',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      {overBudgetCategoriesCount === 0 && <Check size={10} color={colors.flow.income} />}
                      <Text
                        style={[
                          styles.budgetHealthBadgeText,
                          {
                            color: overBudgetCategoriesCount > 0 ? colors.flow.expense : colors.flow.income,
                          },
                        ]}
                      >
                        {overBudgetCategoriesCount > 0
                          ? `${overBudgetCategoriesCount} Over Limit`
                          : 'Semua Terkontrol'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Overall Track */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(
                          totalBudgetLimit > 0 ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100) : 0,
                          100
                        )}%`,
                        backgroundColor:
                          totalBudgetSpent > totalBudgetLimit
                            ? colors.flow.expense
                            : totalBudgetSpent >= totalBudgetLimit * 0.8
                            ? colors.gold.primary
                            : colors.flow.income,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Batas Anggaran Kategori</Text>
                <Text style={styles.sectionSubtitle}>
                  {budgetCount > 0 ? `${budgetCount} kategori aktif` : 'Kontrol batas belanja Anda'}
                </Text>
              </View>
              <View style={styles.sectionActionsRow}>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => {
                    hapticSelection();
                    router.push('/pockets');
                  }}
                >
                  <Sliders size={12} color={colors.text.secondary} />
                  <Text style={styles.secondaryActionText}>Kelola</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => {
                    hapticSelection();
                    setIsBudgetModalOpen(true);
                  }}
                >
                  <Plus size={12} color="#090A0E" />
                  <Text style={styles.primaryActionText}>Atur</Text>
                </TouchableOpacity>
              </View>
            </View>

            {budgetCount === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Target size={24} color={colors.gold.champagne} />
                </View>
                <Text style={styles.emptyTitle}>Belum Ada Batas Anggaran</Text>
                <Text style={styles.emptySubtitle}>
                  Tentukan batas belanja bulanan untuk setiap kategori agar keuanganmu tetap aman dan hemat.
                </Text>
                <TouchableOpacity
                  style={styles.emptyCtaBtn}
                  onPress={() => {
                    hapticSelection();
                    setIsBudgetModalOpen(true);
                  }}
                >
                  <Plus size={14} color="#090A0E" />
                  <Text style={styles.emptyCtaText}>Atur Batas Anggaran</Text>
                </TouchableOpacity>
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
                          {
                            backgroundColor: isOver
                              ? colors.flow.expenseBg
                              : isWarning
                              ? 'rgba(212, 175, 55, 0.15)'
                              : 'rgba(16, 185, 129, 0.12)',
                          },
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

                    {isOver ? (
                      <View style={styles.budgetOverRow}>
                        <AlertTriangle size={12} color={colors.flow.expense} />
                        <Text style={styles.budgetOverText}>
                          Melebihi budget {formatRupiah(spent - budgetLimit)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.budgetRemainingRow}>
                        <Text style={styles.budgetRemainingText}>
                          Sisa kuota: {formatRupiah(budgetLimit - spent)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* 6. Tab 3: Tabungan Target (Goals) */}
        {activeTab === 'goals' && (
          <View style={styles.tabContentSection}>
            {/* Goals Overview Banner */}
            {goals.length > 0 && (
              <View style={styles.budgetHealthCard}>
                <View style={styles.budgetHealthTop}>
                  <View>
                    <Text style={styles.budgetHealthLabel}>TOTAL TARGET TERKUMPUL</Text>
                    <Text style={styles.budgetHealthVal}>
                      {formatRupiah(totalGoalsSaved)}{' '}
                      <Text style={styles.budgetHealthLimit}>/ {formatRupiah(totalGoalsTarget)}</Text>
                    </Text>
                  </View>
                  <View style={styles.goalOverviewBadge}>
                    <Trophy size={11} color={colors.gold.champagne} />
                    <Text style={styles.goalOverviewBadgeText}>
                      {achievedGoalsCount} dari {goals.length} tercapai
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(
                          totalGoalsTarget > 0 ? Math.round((totalGoalsSaved / totalGoalsTarget) * 100) : 0,
                          100
                        )}%`,
                        backgroundColor: colors.gold.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Tabungan Impian (Goals)</Text>
                <Text style={styles.sectionSubtitle}>
                  {goals.length > 0 ? `${goals.length} target berjalan` : 'Capai impian finansialmu'}
                </Text>
              </View>
              <View style={styles.sectionActionsRow}>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => {
                    hapticSelection();
                    router.push('/pockets');
                  }}
                >
                  <Text style={styles.secondaryActionText}>Semua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => {
                    hapticSelection();
                    setIsAddGoalModalOpen(true);
                  }}
                >
                  <Plus size={12} color="#090A0E" />
                  <Text style={styles.primaryActionText}>Goal Baru</Text>
                </TouchableOpacity>
              </View>
            </View>

            {goals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Trophy size={24} color={colors.gold.champagne} />
                </View>
                <Text style={styles.emptyTitle}>Belum Ada Target Finansial</Text>
                <Text style={styles.emptySubtitle}>
                  Mulai buat target impianmu seperti Dana Darurat, Liburan, atau Membeli Gadget.
                </Text>
                <TouchableOpacity
                  style={styles.emptyCtaBtn}
                  onPress={() => {
                    hapticSelection();
                    setIsAddGoalModalOpen(true);
                  }}
                >
                  <Plus size={14} color="#090A0E" />
                  <Text style={styles.emptyCtaText}>Buat Target Pertama</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map((g) => {
                const percent =
                  g.targetAmount > 0
                    ? Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100)
                    : 0;
                const isAchieved = g.status === 'achieved' || g.currentAmount >= g.targetAmount;

                return (
                  <View key={g.id} style={styles.goalCard}>
                    <View style={styles.goalTopRow}>
                      <View style={styles.goalHeaderLeft}>
                        <View style={styles.goalEmojiCircle}>
                          <AppIcon name={g.emoji} defaultFallback="target" size={16} color={colors.gold.champagne} />
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Sparkles size={10} color={colors.gold.champagne} />
                              <Text style={styles.goalBadgeAchievedText}>Tercapai</Text>
                            </View>
                          ) : (
                            <Text style={styles.goalBadgeActiveText}>{percent}%</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
          </View>
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
              <Text style={styles.inputLabel}>PILIH IKON TARGET</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPillRow}>
                {GOAL_ICON_KEYS.map((iconKey) => {
                  const isSelected = newGoalEmoji === iconKey;
                  return (
                    <TouchableOpacity
                      key={iconKey}
                      style={[styles.catPill, isSelected && styles.catPillSelected]}
                      onPress={() => {
                        hapticSelection();
                        setNewGoalEmoji(iconKey);
                      }}
                    >
                      <AppIcon
                        name={iconKey}
                        size={16}
                        color={isSelected ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
                      />
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

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: colors.bg.base,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 1,
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
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 83, 9, 0.2)',
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
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(180, 83, 9, 0.1)',
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(180, 83, 9, 0.25)',
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
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
  },
  navBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
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
  currentMonthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.flow.income,
    marginLeft: 2,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.22)' : 'rgba(180, 83, 9, 0.2)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0 : 0.04,
    shadowRadius: 8,
    elevation: isDark ? 0 : 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  summarySectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  netCashFlowValue: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  netStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  netStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  netStatusTextMuted: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
  },
  flowSplitRow: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.bg.elevated,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border.subtle,
    marginBottom: 12,
  },
  flowBox: {
    flex: 1,
    paddingRight: 10,
  },
  flowBoxRight: {
    paddingRight: 0,
    paddingLeft: 10,
  },
  flowBoxDivider: {
    width: 1,
    height: 32,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border.subtle,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  flowLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.muted,
  },
  flowValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ratioSection: {
    marginTop: 2,
    marginBottom: 6,
  },
  ratioBarContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.bg.elevated,
    marginBottom: 8,
  },
  ratioBarIncome: {
    backgroundColor: colors.flow.income,
  },
  ratioBarExpense: {
    backgroundColor: colors.flow.expense,
  },
  ratioLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratioLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ratioLegendText: {
    fontSize: 10.5,
    color: colors.text.muted,
    fontWeight: '500',
  },
  savingsRateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savingsRateText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  feeNoticeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.border.subtle,
  },
  feeNoticeText: {
    fontSize: 11,
    color: colors.text.muted,
  },
  feeNoticeVal: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Segmented Switcher
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#12141D' : colors.bg.elevated,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : colors.border.subtle,
    marginBottom: 16,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    gap: 5,
  },
  segmentTabActive: {
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.16)' : 'rgba(180, 83, 9, 0.12)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.45)' : 'rgba(180, 83, 9, 0.35)',
  },
  segmentTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  segmentTabTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  segmentBadge: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  segmentBadgeActive: {
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 83, 9, 0.2)',
  },
  segmentBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.text.muted,
  },
  segmentBadgeTextActive: {
    color: colors.gold.champagne,
  },

  // Tab Content & Sections
  tabContentSection: {
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  sectionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  primaryActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#090A0E',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.bg.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border.subtle,
  },
  secondaryActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // Category Cards
  categoryCard: {
    backgroundColor: colors.bg.surface,
    padding: 13,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 4,
    elevation: isDark ? 0 : 1,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  catRankBadge: {
    width: 20,
    alignItems: 'center',
  },
  catRankText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.muted,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 83, 9, 0.2)',
  },
  catNameCol: {
    flex: 1,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  catShareText: {
    fontSize: 10.5,
    color: colors.text.muted,
    marginTop: 1,
  },
  catRight: {
    alignItems: 'flex-end',
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.flow.expense,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 5,
    backgroundColor: isDark ? '#1A1D27' : colors.bg.elevated,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2.5,
  },

  // Budgets Health & Cards
  budgetHealthCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 4,
    elevation: isDark ? 0 : 1,
  },
  budgetHealthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  budgetHealthLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  budgetHealthVal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  budgetHealthLimit: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.muted,
  },
  budgetHealthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 0.5,
  },
  budgetHealthBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  budgetCard: {
    backgroundColor: colors.bg.surface,
    padding: 13,
    borderRadius: 16,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 4,
    elevation: isDark ? 0 : 1,
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
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
    paddingVertical: 2,
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
    marginTop: 7,
  },
  budgetOverText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.flow.expense,
  },
  budgetRemainingRow: {
    marginTop: 6,
  },
  budgetRemainingText: {
    fontSize: 10.5,
    color: colors.text.muted,
    fontVariant: ['tabular-nums'],
  },

  // Goals Overview & Cards
  goalOverviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  goalOverviewBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  goalCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 4,
    elevation: isDark ? 0 : 1,
  },
  goalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  goalEmojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalEmojiText: {
    fontSize: 17,
  },
  goalInfoCol: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 13,
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
    gap: 7,
  },
  goalStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
  },
  goalBadgeActive: {
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
  },
  goalBadgeActiveText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.gold.champagne,
    fontVariant: ['tabular-nums'],
  },
  goalBadgeAchieved: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  goalBadgeAchievedText: {
    fontSize: 10.5,
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
    marginTop: 9,
  },
  goalDateText: {
    fontSize: 10,
    color: colors.text.muted,
  },
  goalDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(180, 83, 9, 0.1)',
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(180, 83, 9, 0.25)',
  },
  goalDepositBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },

  // Empty State
  emptyContainer: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 83, 9, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.18)' : 'rgba(180, 83, 9, 0.15)',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 5,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#090A0E',
  },

  // Modals
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
    borderColor: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(180, 83, 9, 0.25)',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
    alignSelf: 'center',
    marginBottom: 14,
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
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
  },
  inputGroup: {
    marginBottom: 14,
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
    borderRadius: 10,
    backgroundColor: isDark ? '#090A0E' : colors.bg.elevated,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border.subtle,
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
    backgroundColor: isDark ? '#090A0E' : colors.bg.elevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    color: colors.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border.subtle,
  },
  saveBudgetBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBudgetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#090A0E',
  },
});
