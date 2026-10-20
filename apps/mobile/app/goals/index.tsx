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
  Target,
  Trophy,
  Calendar,
  Lock,
  Trash2,
  CheckCircle2,
  Sparkles,
  X,
} from 'lucide-react-native';
import { formatRupiah } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import {
  getLocalGoals,
  insertLocalGoal,
  addSavingsToGoal,
  deleteLocalGoal,
  type GoalModel,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticSuccess } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

const EMOJI_OPTIONS = ['🎯', '🏡', '🚗', '✈️', '💻', '💍', '🎓', '🛡️', '💰', '👶'];
const PRESET_DEPOSITS = [100000, 250000, 500000, 1000000];

export default function GoalsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [goals, setGoals] = useState<GoalModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Add Goal Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalEmoji, setNewGoalEmoji] = useState('🎯');
  const [newGoalDate, setNewGoalDate] = useState('');

  // Deposit Modal
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalModel | null>(null);
  const [depositAmountInput, setDepositAmountInput] = useState('');

  const loadData = useCallback(async () => {
    try {
      const list = await getLocalGoals();
      setGoals(list);
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalTargetAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSavedAmount = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const achievedGoalsCount = goals.filter((g) => g.status === 'achieved' || g.currentAmount >= g.targetAmount).length;

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

      const goalName = newGoalName.trim();
      setIsAddModalOpen(false);
      setNewGoalName('');
      setNewGoalTarget('');
      setNewGoalDate('');
      toast.showSuccess('Target Impian Dibuat', `${goalName} ditambahkan.`);
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Membuat Goal', err.message);
    }
  };

  const handleDeposit = async () => {
    if (!selectedGoal) return;
    const numDeposit = parseInt(depositAmountInput.replace(/\D/g, ''), 10);
    if (!numDeposit || numDeposit <= 0) {
      toast.showWarning('Perhatian', 'Masukkan nominal setoran tabungan yang valid.');
      return;
    }

    try {
      hapticMedium();
      const { goal, isJustAchieved } = await addSavingsToGoal(selectedGoal.id, numDeposit);
      setIsDepositModalOpen(false);
      setDepositAmountInput('');
      setSelectedGoal(null);
      await loadData();

      if (isJustAchieved) {
        Alert.alert('🎉 Selamat!', `Goal "${goal.name}" kamu telah berhasil tercapai 100%! Pertahankan kebiasaan menabung yang luar biasa.`);
      } else {
        toast.showSuccess('Tabungan Ditambahkan', `${formatRupiah(numDeposit)} dialokasikan ke ${goal.name}.`);
      }
    } catch (err: any) {
      toast.showError('Gagal Menabung', err.message);
    }
  };

  const handleDelete = (goal: GoalModel) => {
    Alert.alert(
      'Hapus Goal',
      `Yakin ingin menghapus target impian "${goal.name}"? Saldo yang terkunci akan dibebaskan kembali.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await deleteLocalGoal(goal.id);
              toast.showSuccess('Target Dihapus', goal.name);
              await loadData();
            } catch (err: any) {
              toast.showError('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
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
        <Text style={styles.headerTitle}>Target Keuangan & Impian</Text>
        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => {
            hapticSelection();
            setIsAddModalOpen(true);
          }}
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
        {/* Goals Hero Summary Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Total Tabungan Terkumpul</Text>
              <Text style={styles.heroBalance}>{formatRupiah(totalSavedAmount)}</Text>
            </View>
            <View style={styles.trophyCircle}>
              <Trophy size={22} color={colors.gold.champagne} />
            </View>
          </View>

          <View style={styles.heroBottomRow}>
            <View>
              <Text style={styles.heroSubLabel}>Total Target Gabungan</Text>
              <Text style={styles.heroSubValue}>{formatRupiah(totalTargetAmount)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.heroSubLabel}>Impian Tercapai</Text>
              <Text style={[styles.heroSubValue, { color: colors.flow.income }]}>
                {achievedGoalsCount} dari {goals.length}
              </Text>
            </View>
          </View>
        </View>

        {/* Goals List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daftar Impian ({goals.length})</Text>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Target size={28} color={colors.gold.champagne} />
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Target Impian</Text>
            <Text style={styles.emptySubtitle}>
              Mulai wujudkan impianmu seperti Dana Darurat, Beli Rumah, atau Liburan dengan menabung terencana.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => setIsAddModalOpen(true)}
            >
              <Plus size={15} color="#090A0E" strokeWidth={2.5} />
              <Text style={styles.emptyAddText}>Buat Target Pertama</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((g) => {
            const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
            const isCompleted = g.status === 'achieved' || pct >= 100;
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);

            return (
              <View key={g.id} style={styles.goalCard}>
                <View style={styles.goalCardTop}>
                  <View style={styles.goalLeft}>
                    <View style={styles.emojiCircle}>
                      <Text style={styles.emojiText}>{g.emoji || '🎯'}</Text>
                    </View>
                    <View>
                      <View style={styles.goalTitleRow}>
                        <Text style={styles.goalName}>{g.name}</Text>
                        {isCompleted && (
                          <View style={styles.achievedBadge}>
                            <Sparkles size={10} color={colors.gold.champagne} />
                            <Text style={styles.achievedBadgeText}>Tercapai</Text>
                          </View>
                        )}
                      </View>
                      {Boolean(g.targetDate) && (
                        <View style={styles.dateRow}>
                          <Calendar size={11} color={colors.text.muted} />
                          <Text style={styles.dateText}>Target: {g.targetDate}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(g)}
                  >
                    <Trash2 size={15} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: isCompleted ? colors.flow.income : colors.gold.primary,
                      },
                    ]}
                  />
                </View>

                {/* Amount Row */}
                <View style={styles.amountRow}>
                  <View>
                    <Text style={styles.amountLabel}>Terkumpul</Text>
                    <Text style={styles.collectedText}>{formatRupiah(g.currentAmount)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.amountLabel}>Kemajuan</Text>
                    <Text style={[styles.pctText, isCompleted && { color: colors.flow.income }]}>
                      {pct}%
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountLabel}>Target Akhir</Text>
                    <Text style={styles.targetText}>{formatRupiah(g.targetAmount)}</Text>
                  </View>
                </View>

                {/* Action Row */}
                {!isCompleted && (
                  <TouchableOpacity
                    style={styles.depositBtn}
                    onPress={() => {
                      hapticSelection();
                      setSelectedGoal(g);
                      setDepositAmountInput('');
                      setIsDepositModalOpen(true);
                    }}
                  >
                    <Plus size={14} color="#090A0E" strokeWidth={2.4} />
                    <Text style={styles.depositBtnText}>Setor Tabungan</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buat Target Impian Baru</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Ikon Emoji</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
              {EMOJI_OPTIONS.map((em) => (
                <TouchableOpacity
                  key={em}
                  style={[styles.emojiPickBtn, newGoalEmoji === em && styles.emojiPickBtnActive]}
                  onPress={() => {
                    hapticSelection();
                    setNewGoalEmoji(em);
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{em}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Nama Impian</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: Dana Darurat 6 Bulan, Beli Laptop"
              placeholderTextColor={colors.text.muted}
              value={newGoalName}
              onChangeText={setNewGoalName}
            />

            <Text style={styles.inputLabel}>Target Nominal Uang</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
              value={newGoalTarget ? `Rp ${parseInt(newGoalTarget, 10).toLocaleString('id-ID')}` : ''}
              onChangeText={(val) => setNewGoalTarget(val.replace(/\D/g, ''))}
            />

            <Text style={styles.inputLabel}>Target Tanggal Pencapaian (Opsional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD (Contoh: 2026-12-31)"
              placeholderTextColor={colors.text.muted}
              value={newGoalDate}
              onChangeText={setNewGoalDate}
            />

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleCreateGoal}>
              <Text style={styles.saveSubmitText}>Simpan Target Impian</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Deposit Modal */}
      <Modal visible={isDepositModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Setor Tabungan ke Goal</Text>
              <TouchableOpacity onPress={() => setIsDepositModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            {selectedGoal && (
              <View style={styles.depositGoalInfo}>
                <Text style={{ fontSize: 22 }}>{selectedGoal.emoji || '🎯'}</Text>
                <View>
                  <Text style={styles.depositGoalName}>{selectedGoal.name}</Text>
                  <Text style={styles.depositGoalSub}>
                    Kekurangan: {formatRupiah(Math.max(0, selectedGoal.targetAmount - selectedGoal.currentAmount))}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>Nominal Setoran</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
              value={depositAmountInput ? `Rp ${parseInt(depositAmountInput, 10).toLocaleString('id-ID')}` : ''}
              onChangeText={(val) => setDepositAmountInput(val.replace(/\D/g, ''))}
            />

            {/* Presets */}
            <View style={styles.presetRow}>
              {PRESET_DEPOSITS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.presetChip}
                  onPress={() => {
                    hapticSelection();
                    setDepositAmountInput(String(p));
                  }}
                >
                  <Text style={styles.presetText}>{formatRupiah(p)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleDeposit}>
              <Text style={styles.saveSubmitText}>Kunci Saldo Tabungan</Text>
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
  heroCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: 4,
  },
  heroBalance: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.gold.light,
    letterSpacing: -0.5,
  },
  trophyCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.hairline,
  },
  heroBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroSubLabel: {
    fontSize: 10,
    color: colors.text.muted,
    marginBottom: 2,
  },
  heroSubValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyContainer: {
    backgroundColor: colors.bg.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#090A0E',
  },
  goalCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  goalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  achievedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  achievedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.flow.income,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  dateText: {
    fontSize: 11,
    color: colors.text.muted,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  amountLabel: {
    fontSize: 10,
    color: colors.text.muted,
    marginBottom: 2,
  },
  collectedText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  pctText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.gold.champagne,
  },
  targetText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  depositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  depositBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#090A0E',
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
    marginBottom: 6,
    marginTop: 10,
  },
  emojiScroll: {
    marginBottom: 8,
  },
  emojiPickBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  emojiPickBtnActive: {
    borderColor: colors.gold.primary,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  textInput: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  depositGoalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg.elevated,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  depositGoalName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  depositGoalSub: {
    fontSize: 11,
    color: colors.gold.champagne,
    marginTop: 2,
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
    marginTop: 20,
  },
  saveSubmitText: {
    color: '#090A0E',
    fontSize: 15,
    fontWeight: '700',
  },
});
