import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  Lock,
  Unlock,
  ArrowRightLeft,
  Trash2,
  Sparkles,
  Wallet,
  ShieldCheck,
  Tag,
  CheckCircle2,
} from 'lucide-react-native';
import { formatRupiah, type PocketModel, type AccountModel, type PocketType } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import {
  getLocalAccounts,
  getLocalPockets,
  insertLocalPocket,
  updateLocalPocket,
  deleteLocalPocket,
  transferLocalPocketFunds,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

export default function PocketsScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ accountId?: string }>();

  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [pockets, setPockets] = useState<PocketModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Create Form State
  const [pocketName, setPocketName] = useState('');
  const [pocketEmoji, setPocketEmoji] = useState('🍜');
  const [pocketType, setPocketType] = useState<PocketType>('spending');
  const [pocketAllocationInput, setPocketAllocationInput] = useState('');
  const [pocketTargetInput, setPocketTargetInput] = useState('');

  // Transfer Form State
  const [transferSourcePocketId, setTransferSourcePocketId] = useState<string | null>(null);
  const [transferDestPocketId, setTransferDestPocketId] = useState<string | null>(null);
  const [transferAmountInput, setTransferAmountInput] = useState('');

  const loadData = useCallback(async () => {
    try {
      const accList = await getLocalAccounts();
      setAccounts(accList);

      const targetAccId = selectedAccountId || params.accountId || (accList.length > 0 ? accList[0].id : '');
      setSelectedAccountId(targetAccId);

      if (targetAccId) {
        const pocketList = await getLocalPockets(targetAccId);
        setPockets(pocketList);
      }
    } catch (err: any) {
      console.error(err);
    }
  }, [selectedAccountId, params.accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const currentAccount = accounts.find((a) => a.id === selectedAccountId);
  const totalAccountBalance = currentAccount?.currentBalance || 0;
  const totalAllocatedInPockets = pockets.reduce((sum, p) => sum + p.allocatedBalance, 0);
  const unallocatedMainBalance = Math.max(0, totalAccountBalance - totalAllocatedInPockets);

  const handleCreatePocket = async () => {
    if (!pocketName.trim()) {
      toast.showWarning('Perhatian', 'Nama kantong tidak boleh kosong.');
      return;
    }
    const alloc = parseInt(pocketAllocationInput.replace(/\D/g, ''), 10) || 0;
    const target = parseInt(pocketTargetInput.replace(/\D/g, ''), 10) || undefined;

    if (alloc > unallocatedMainBalance) {
      toast.showError('Saldo Tidak Cukup', `Saldo bebas akun hanya ${formatRupiah(unallocatedMainBalance)}.`);
      return;
    }

    try {
      hapticMedium();
      await insertLocalPocket({
        accountId: selectedAccountId,
        name: pocketName.trim(),
        emoji: pocketEmoji,
        type: pocketType,
        initialAllocation: alloc,
        targetAmount: target,
      });

      toast.showSuccess('Kantong Dibuat', `${pocketName} berhasil ditambahkan`);
      setIsCreateModalOpen(false);
      setPocketName('');
      setPocketAllocationInput('');
      setPocketTargetInput('');
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Membuat', err.message);
    }
  };

  const handleToggleLock = async (pocket: PocketModel) => {
    try {
      hapticMedium();
      await updateLocalPocket(pocket.id, { isLocked: !pocket.isLocked });
      toast.showSuccess(pocket.isLocked ? 'Kantong Dibuka' : 'Kantong Dikunci', pocket.name);
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal', err.message);
    }
  };

  const handleDeletePocket = (pocket: PocketModel) => {
    Alert.alert(
      'Hapus Kantong',
      `Hapus "${pocket.name}"? Saldo alokasi sebesar ${formatRupiah(pocket.allocatedBalance)} akan kembali ke saldo utama.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await deleteLocalPocket(pocket.id);
              toast.showSuccess('Kantong Dihapus', pocket.name);
              await loadData();
            } catch (err: any) {
              toast.showError('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleTransferFunds = async () => {
    const amount = parseInt(transferAmountInput.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) {
      toast.showWarning('Perhatian', 'Masukkan nominal transfer alokasi yang valid.');
      return;
    }

    if (transferSourcePocketId === transferDestPocketId) {
      toast.showError('Tidak Valid', 'Sumber dan tujuan alokasi tidak boleh sama.');
      return;
    }

    // Verify balance availability
    if (transferSourcePocketId === null) {
      if (amount > unallocatedMainBalance) {
        toast.showError('Saldo Tidak Cukup', `Saldo bebas akun hanya ${formatRupiah(unallocatedMainBalance)}.`);
        return;
      }
    } else {
      const srcPkt = pockets.find((p) => p.id === transferSourcePocketId);
      if (srcPkt && amount > srcPkt.allocatedBalance) {
        toast.showError('Saldo Tidak Cukup', `Saldo kantong ${srcPkt.name} hanya ${formatRupiah(srcPkt.allocatedBalance)}.`);
        return;
      }
    }

    try {
      hapticMedium();
      await transferLocalPocketFunds(selectedAccountId, transferSourcePocketId, transferDestPocketId, amount);
      toast.showSuccess('Alokasi Berhasil Dipindah', formatRupiah(amount));
      setIsTransferModalOpen(false);
      setTransferAmountInput('');
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Pindah Alokasi', err.message);
    }
  };

  const getTypeName = (type: PocketType) => {
    switch (type) {
      case 'spending': return 'Kantong Belanja';
      case 'locked': return 'Terkunci';
      case 'bills': return 'Tagihan & Cicilan';
      case 'saving': return 'Tabungan';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.gold.champagne} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kantong Keuangan</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setIsCreateModalOpen(true);
          }}
        >
          <Plus size={20} color="#090A0E" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold.champagne} />}
      >
        {/* Account Tabs */}
        <Text style={styles.sectionLabel}>PILIH AKUN UTAMA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountTabs}>
          {accounts.map((acc) => {
            const isSelected = acc.id === selectedAccountId;
            return (
              <TouchableOpacity
                key={acc.id}
                style={[styles.accountTab, isSelected && styles.accountTabActive]}
                onPress={() => {
                  hapticSelection();
                  setSelectedAccountId(acc.id);
                }}
              >
                <Wallet size={14} color={isSelected ? '#090A0E' : colors.text.muted} />
                <Text style={[styles.accountTabText, isSelected && styles.accountTabTextActive]}>{acc.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Envelope Budgeting Invariant Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroSub}>TOTAL SALDO REKENING</Text>
          <Text style={styles.heroBalance}>{formatRupiah(totalAccountBalance)}</Text>

          <View style={styles.divider} />

          <View style={styles.heroSplitRow}>
            <View style={styles.heroSplitCol}>
              <Text style={styles.heroColLabel}>🌐 Saldo Bebas (Unallocated)</Text>
              <Text style={styles.heroColValuePositive}>{formatRupiah(unallocatedMainBalance)}</Text>
            </View>
            <View style={styles.heroSplitCol}>
              <Text style={styles.heroColLabel}>🔒 Total di Kantong</Text>
              <Text style={styles.heroColValueGold}>{formatRupiah(totalAllocatedInPockets)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.heroActionBtn}
            onPress={() => {
              hapticSelection();
              setTransferSourcePocketId(null);
              setTransferDestPocketId(pockets[0]?.id || null);
              setIsTransferModalOpen(true);
            }}
          >
            <ArrowRightLeft size={14} color={colors.gold.champagne} />
            <Text style={styles.heroActionText}>Pindah & Alokasi Dana Antar Kantong</Text>
          </TouchableOpacity>
        </View>

        {/* Pockets List */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionLabel}>SUB-KANTONG TERSEDIA ({pockets.length})</Text>
          <TouchableOpacity onPress={() => setIsCreateModalOpen(true)}>
            <Text style={styles.linkText}>+ Buat Kantong</Text>
          </TouchableOpacity>
        </View>

        {pockets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>Belum Ada Kantong</Text>
            <Text style={styles.emptySubtitle}>
              Bagi saldo rekeningmu ke beberapa sub-kantong untuk mengamankan uang makan, belanja bulanan, dan tagihan.
            </Text>
          </View>
        ) : (
          pockets.map((pkt) => {
            const hasTarget = pkt.targetAmount && pkt.targetAmount > 0;
            const progress = hasTarget ? Math.min(100, Math.round((pkt.allocatedBalance / pkt.targetAmount!) * 100)) : 0;

            return (
              <View key={pkt.id} style={styles.pocketCard}>
                <View style={styles.pocketHeaderRow}>
                  <View style={styles.pocketEmojiWrap}>
                    <Text style={styles.pocketEmoji}>{pkt.emoji || '💰'}</Text>
                  </View>
                  <View style={styles.pocketInfo}>
                    <Text style={styles.pocketName}>{pkt.name}</Text>
                    <View style={styles.pocketTagRow}>
                      <View style={styles.pocketTypeBadge}>
                        <Text style={styles.pocketTypeBadgeText}>{getTypeName(pkt.type)}</Text>
                      </View>
                      {pkt.isLocked && (
                        <View style={styles.lockedBadge}>
                          <Lock size={10} color="#EF4444" />
                          <Text style={styles.lockedBadgeText}>Terkunci dari Transaksi</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.pocketAmount}>{formatRupiah(pkt.allocatedBalance)}</Text>
                </View>

                {hasTarget && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                    <View style={styles.progressTextRow}>
                      <Text style={styles.progressText}>Target: {formatRupiah(pkt.targetAmount!)}</Text>
                      <Text style={styles.progressTextGold}>{progress}%</Text>
                    </View>
                  </View>
                )}

                {/* Pocket Actions */}
                <View style={styles.pocketActionsRow}>
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => {
                      hapticSelection();
                      setTransferSourcePocketId(pkt.id);
                      setTransferDestPocketId(null);
                      setIsTransferModalOpen(true);
                    }}
                  >
                    <ArrowRightLeft size={13} color={colors.text.primary} />
                    <Text style={styles.cardActionText}>Pindah Saldo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => handleToggleLock(pkt)}
                  >
                    {pkt.isLocked ? (
                      <>
                        <Unlock size={13} color={colors.flow.income} />
                        <Text style={[styles.cardActionText, { color: colors.flow.income }]}>Buka Kunci</Text>
                      </>
                    ) : (
                      <>
                        <Lock size={13} color={colors.text.muted} />
                        <Text style={styles.cardActionText}>Kunci</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => handleDeletePocket(pkt)}
                  >
                    <Trash2 size={13} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MODAL: Buat Kantong Baru */}
      <Modal visible={isCreateModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>✨ Buat Kantong Baru</Text>
            <Text style={styles.modalSubtitle}>Pisahkan alokasi saldo untuk tujuan spesifik.</Text>

            {/* Emoji Selector */}
            <Text style={styles.modalLabel}>PILIH EMOJI</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              {['🍜', '🛒', '⚡️', '🛡️', '🏖️', '🎮', '🚗', '📚', '🎁', '💰'].map((em) => (
                <TouchableOpacity
                  key={em}
                  style={[styles.emojiBtn, pocketEmoji === em && styles.emojiBtnSelected]}
                  onPress={() => {
                    hapticSelection();
                    setPocketEmoji(em);
                  }}
                >
                  <Text style={styles.emojiBtnText}>{em}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>NAMA KANTONG</Text>
            <TextInput
              style={styles.textInput}
              value={pocketName}
              onChangeText={setPocketName}
              placeholder="Cth: Belanja Mingguan"
              placeholderTextColor={colors.text.muted}
            />

            <Text style={styles.modalLabel}>TIPE KANTONG</Text>
            <View style={styles.typeSelectorRow}>
              {(['spending', 'bills', 'saving', 'locked'] as PocketType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, pocketType === t && styles.typeBtnSelected]}
                  onPress={() => {
                    hapticSelection();
                    setPocketType(t);
                  }}
                >
                  <Text style={[styles.typeBtnText, pocketType === t && styles.typeBtnTextSelected]}>
                    {t === 'spending' ? 'Belanja' : t === 'bills' ? 'Tagihan' : t === 'saving' ? 'Tabungan' : 'Terkunci'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>ALOKASI AWAL (OPSIONAL)</Text>
            <TextInput
              style={styles.textInput}
              value={pocketAllocationInput}
              onChangeText={(val) => {
                const numeric = val.replace(/\D/g, '');
                setPocketAllocationInput(numeric ? formatRupiah(parseInt(numeric, 10)) : '');
              }}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
            />

            <Text style={styles.modalLabel}>TARGET NOMINAL (OPSIONAL)</Text>
            <TextInput
              style={styles.textInput}
              value={pocketTargetInput}
              onChangeText={(val) => {
                const numeric = val.replace(/\D/g, '');
                setPocketTargetInput(numeric ? formatRupiah(parseInt(numeric, 10)) : '');
              }}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsCreateModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreatePocket}
              >
                <Text style={styles.submitBtnText}>Simpan Kantong</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Pindah / Transfer Dana Alokasi */}
      <Modal visible={isTransferModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>⇄ Pindah Alokasi Dana</Text>
            <Text style={styles.modalSubtitle}>Mutasi alokasi internal akun tanpa memengaruhi total kas fisik.</Text>

            <Text style={styles.modalLabel}>DARI SUMBER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              <TouchableOpacity
                style={[styles.accountTab, transferSourcePocketId === null && styles.accountTabActive]}
                onPress={() => setTransferSourcePocketId(null)}
              >
                <Text style={[styles.accountTabText, transferSourcePocketId === null && styles.accountTabTextActive]}>
                  🌐 Saldo Bebas ({formatRupiah(unallocatedMainBalance)})
                </Text>
              </TouchableOpacity>
              {pockets.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.accountTab, transferSourcePocketId === p.id && styles.accountTabActive]}
                  onPress={() => setTransferSourcePocketId(p.id)}
                >
                  <Text style={[styles.accountTabText, transferSourcePocketId === p.id && styles.accountTabTextActive]}>
                    {p.emoji} {p.name} ({formatRupiah(p.allocatedBalance)})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>KE TUJUAN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              <TouchableOpacity
                style={[styles.accountTab, transferDestPocketId === null && styles.accountTabActive]}
                onPress={() => setTransferDestPocketId(null)}
              >
                <Text style={[styles.accountTabText, transferDestPocketId === null && styles.accountTabTextActive]}>
                  🌐 Saldo Bebas
                </Text>
              </TouchableOpacity>
              {pockets.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.accountTab, transferDestPocketId === p.id && styles.accountTabActive]}
                  onPress={() => setTransferDestPocketId(p.id)}
                >
                  <Text style={[styles.accountTabText, transferDestPocketId === p.id && styles.accountTabTextActive]}>
                    {p.emoji} {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>NOMINAL PINDAH ALOKASI</Text>
            <TextInput
              style={styles.textInput}
              value={transferAmountInput}
              onChangeText={(val) => {
                const numeric = val.replace(/\D/g, '');
                setTransferAmountInput(numeric ? formatRupiah(parseInt(numeric, 10)) : '');
              }}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsTransferModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleTransferFunds}
              >
                <Text style={styles.submitBtnText}>Konfirmasi Pindah</Text>
              </TouchableOpacity>
            </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  addBtn: {
    backgroundColor: colors.gold.champagne,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  accountTabs: {
    gap: 8,
    marginBottom: 16,
  },
  accountTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  accountTabActive: {
    backgroundColor: colors.gold.champagne,
    borderColor: colors.gold.champagne,
  },
  accountTabText: {
    fontSize: 13,
    color: colors.text.muted,
    fontWeight: '600',
  },
  accountTabTextActive: {
    color: '#090A0E',
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 24,
  },
  heroSub: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: 0.8,
  },
  heroBalance: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: 16,
  },
  heroSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroSplitCol: {
    flex: 1,
  },
  heroColLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 4,
  },
  heroColValuePositive: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.flow.income,
  },
  heroColValueGold: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  heroActionBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  heroActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  linkText: {
    fontSize: 12,
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  emptyEmoji: {
    fontSize: 40,
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
  },
  pocketCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 12,
  },
  pocketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pocketEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pocketEmoji: {
    fontSize: 22,
  },
  pocketInfo: {
    flex: 1,
  },
  pocketName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  pocketTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  pocketTypeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pocketTypeBadgeText: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: '600',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
  },
  pocketAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.gold.champagne,
  },
  progressContainer: {
    marginTop: 14,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold.champagne,
    borderRadius: 3,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressText: {
    fontSize: 11,
    color: colors.text.muted,
  },
  progressTextGold: {
    fontSize: 11,
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  pocketActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  cardActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bg.base,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 14,
  },
  emojiList: {
    gap: 10,
    marginBottom: 10,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  emojiBtnSelected: {
    borderColor: colors.gold.champagne,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  emojiBtnText: {
    fontSize: 20,
  },
  textInput: {
    backgroundColor: colors.bg.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  typeBtnSelected: {
    backgroundColor: colors.gold.champagne,
    borderColor: colors.gold.champagne,
  },
  typeBtnText: {
    fontSize: 12,
    color: colors.text.muted,
    fontWeight: '600',
  },
  typeBtnTextSelected: {
    color: '#090A0E',
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.muted,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.gold.champagne,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#090A0E',
  },
});
