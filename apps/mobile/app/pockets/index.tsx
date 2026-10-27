import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  Lock,
  Unlock,
  ArrowRightLeft,
  Trash2,
  Wallet,
  Users,
  Share2,
  HandCoins,
  UserPlus,
  X,
  Link2,
  CheckCircle2,
  Sparkles,
  Globe,
  Coins,
  Archive,
  ShoppingBag,
  FileText,
  TrendingUp,
  AlertCircle,
} from 'lucide-react-native';
import { AppIcon, POCKET_ICON_KEYS, AVATAR_ICON_KEYS } from '../../src/components/AppIcon';
import {
  formatRupiah,
  type PocketModel,
  type AccountModel,
  type PocketType,
  type PocketMemberModel,
  type PocketContributionModel,
} from '@uangku/contracts';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
import {
  getLocalAccounts,
  getLocalPockets,
  insertLocalPocket,
  updateLocalPocket,
  deleteLocalPocket,
  transferLocalPocketFunds,
  getLocalPocketMembers,
  getLocalPocketContributions,
  addLocalPocketMember,
  deleteLocalPocketMember,
  addLocalPocketContribution,
  toggleLocalPocketShared,
  joinLocalSharedPocket,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

export default function PocketsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const params = useLocalSearchParams<{ accountId?: string }>();

  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [pockets, setPockets] = useState<PocketModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'spending' | 'saving' | 'shared'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  // Selected Shared Pocket Detail State
  const [activePocket, setActivePocket] = useState<PocketModel | null>(null);
  const [activeMembers, setActiveMembers] = useState<PocketMemberModel[]>([]);
  const [activeContributions, setActiveContributions] = useState<PocketContributionModel[]>([]);

  // Create Form State
  const [pocketName, setPocketName] = useState('');
  const [pocketEmoji, setPocketEmoji] = useState('wallet');
  const [pocketType, setPocketType] = useState<PocketType>('spending');
  const [pocketAllocationInput, setPocketAllocationInput] = useState('');
  const [pocketTargetInput, setPocketTargetInput] = useState('');
  const [isSharedCreateToggle, setIsSharedCreateToggle] = useState(false);

  const openCreateModal = (isShared?: boolean) => {
    hapticSelection();
    const shouldBeShared = isShared !== undefined ? isShared : filterTab === 'shared';
    setIsSharedCreateToggle(shouldBeShared);
    setPocketName('');
    setPocketEmoji(shouldBeShared ? 'users' : filterTab === 'saving' ? 'target' : 'wallet');
    setPocketType(shouldBeShared ? 'shared' : filterTab === 'saving' ? 'saving' : 'spending');
    setPocketAllocationInput('');
    setPocketTargetInput('');
    setIsCreateModalOpen(true);
  };

  // Transfer Form State
  const [transferSourcePocketId, setTransferSourcePocketId] = useState<string | null>(null);
  const [transferDestPocketId, setTransferDestPocketId] = useState<string | null>(null);
  const [transferAmountInput, setTransferAmountInput] = useState('');

  // Join Form State
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinNameInput, setJoinNameInput] = useState('');
  const [joinAvatarInput, setJoinAvatarInput] = useState('smile');

  // Contribute Form State
  const [contributeAmountInput, setContributeAmountInput] = useState('');
  const [contributeNoteInput, setContributeNoteInput] = useState('');
  const [contributeMemberName, setContributeMemberName] = useState('Saya');

  // Add Member Form State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAvatar, setNewMemberAvatar] = useState('user');

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (activePocket) {
      await openSharedPocketDetail(activePocket);
    }
    setRefreshing(false);
  };

  const currentAccount = accounts.find((a) => a.id === selectedAccountId);
  const totalAccountBalance = currentAccount?.currentBalance || 0;
  const totalAllocatedInPockets = pockets.reduce((sum, p) => sum + p.allocatedBalance, 0);
  const unallocatedMainBalance = Math.max(0, totalAccountBalance - totalAllocatedInPockets);

  const sharedPockets = useMemo(() => pockets.filter((p) => p.isShared), [pockets]);
  const spendingPockets = useMemo(() => pockets.filter((p) => (p.type === 'spending' || p.type === 'bills') && !p.isShared), [pockets]);
  const savingPockets = useMemo(() => pockets.filter((p) => (p.type === 'saving' || p.type === 'locked') && !p.isShared), [pockets]);
  const displayedPockets = useMemo(() => {
    if (filterTab === 'shared') return sharedPockets;
    if (filterTab === 'spending') return spendingPockets;
    if (filterTab === 'saving') return savingPockets;
    return pockets;
  }, [filterTab, pockets, sharedPockets, spendingPockets, savingPockets]);

  // Open Shared Pocket Detail
  const openSharedPocketDetail = async (pocket: PocketModel) => {
    setActivePocket(pocket);
    try {
      const [members, contributions] = await Promise.all([
        getLocalPocketMembers(pocket.id),
        getLocalPocketContributions(pocket.id),
      ]);
      setActiveMembers(members);
      setActiveContributions(contributions);
      setIsDetailModalOpen(true);
    } catch (err: any) {
      toast.showError('Gagal Membuka Detail', err.message);
    }
  };

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
        type: isSharedCreateToggle ? 'shared' : pocketType,
        initialAllocation: alloc,
        targetAmount: target,
        isShared: isSharedCreateToggle,
      });

      toast.showSuccess(
        isSharedCreateToggle ? 'Kantong Bersama Dibuat' : 'Kantong Dibuat',
        `${pocketName} siap digunakan`
      );
      setIsCreateModalOpen(false);
      setPocketName('');
      setPocketAllocationInput('');
      setPocketTargetInput('');
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Membuat', err.message);
    }
  };

  const handleShareInvite = async (pocket: PocketModel) => {
    hapticSelection();
    const code = pocket.inviteCode || 'PKT-UANGKU';
    try {
      await Share.share({
        title: `Undangan Kantong Bersama: ${pocket.name}`,
        message: `Yuk patungan & nabung bareng di Kantong Bersama "${pocket.name}" di aplikasi UangKu!\n\nMasukkan Kode Undangan: ${code}\nTarget: ${pocket.targetAmount ? formatRupiah(pocket.targetAmount) : 'Bebas'}`,
      });
    } catch {
      toast.showSuccess('Kode Undangan', code);
    }
  };

  const handleToggleShareMode = async (pocket: PocketModel) => {
    try {
      hapticMedium();
      const code = await toggleLocalPocketShared(pocket.id, !pocket.isShared);
      toast.showSuccess(
        pocket.isShared ? 'Kantong Diubah ke Pribadi' : 'Kantong Bersama Aktif!',
        code ? `Kode: ${code}` : pocket.name
      );
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Mengubah Mode', err.message);
    }
  };

  const handleJoinViaCode = async () => {
    if (!joinCodeInput.trim()) {
      toast.showWarning('Perhatian', 'Masukkan kode undangan kantong.');
      return;
    }
    if (!joinNameInput.trim()) {
      toast.showWarning('Perhatian', 'Masukkan nama Anda untuk bergabung.');
      return;
    }

    try {
      hapticSuccess();
      const res = await joinLocalSharedPocket(joinCodeInput, joinNameInput, joinAvatarInput);
      if (res.success) {
        toast.showSuccess('Berhasil Bergabung', res.message);
        setIsJoinModalOpen(false);
        setJoinCodeInput('');
        setJoinNameInput('');
        await loadData();
      } else {
        toast.showError('Gagal Bergabung', res.message);
      }
    } catch (err: any) {
      toast.showError('Error', err.message);
    }
  };

  const handleAddContribution = async () => {
    if (!activePocket) return;
    const amount = parseInt(contributeAmountInput.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) {
      toast.showWarning('Perhatian', 'Masukkan nominal setoran patungan.');
      return;
    }

    try {
      hapticSuccess();
      await addLocalPocketContribution({
        pocketId: activePocket.id,
        memberName: contributeMemberName.trim() || 'Saya',
        amount,
        note: contributeNoteInput.trim() || undefined,
      });

      toast.showSuccess('Setoran Berhasil', `${formatRupiah(amount)} ditambahkan ke ${activePocket.name}`);
      setIsContributeModalOpen(false);
      setContributeAmountInput('');
      setContributeNoteInput('');

      // Refresh detail & parent list
      await openSharedPocketDetail(activePocket);
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Menyetor', err.message);
    }
  };

  const handleAddMember = async () => {
    if (!activePocket || !newMemberName.trim()) {
      toast.showWarning('Perhatian', 'Nama anggota tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      await addLocalPocketMember(activePocket.id, {
        name: newMemberName.trim(),
        avatarEmoji: newMemberAvatar,
        role: 'contributor',
      });

      toast.showSuccess('Anggota Ditambahkan', newMemberName);
      setIsAddMemberModalOpen(false);
      setNewMemberName('');
      await openSharedPocketDetail(activePocket);
    } catch (err: any) {
      toast.showError('Gagal Menambah Anggota', err.message);
    }
  };

  const handleDeleteMember = async (member: PocketMemberModel) => {
    if (!activePocket) return;
    if (member.role === 'owner') {
      toast.showWarning('Perhatian', 'Pemilik kantong tidak dapat dihapus.');
      return;
    }

    Alert.alert('Keluarkan Anggota', `Keluarkan ${member.name} dari kantong ini?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluarkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLocalPocketMember(activePocket.id, member.id);
            toast.showSuccess('Anggota Dikeluarkan', member.name);
            await openSharedPocketDetail(activePocket);
          } catch (err: any) {
            toast.showError('Gagal', err.message);
          }
        },
      },
    ]);
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
      `Hapus "${pocket.name}"? Saldo alokasi sebesar ${formatRupiah(pocket.allocatedBalance)} akan kembali ke saldo utama akun.`,
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
              setIsDetailModalOpen(false);
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

  const getTypeName = (type: PocketType, isShared?: boolean) => {
    if (isShared || type === 'shared') return 'Kantong Bersama';
    switch (type) {
      case 'spending': return 'Kantong Belanja';
      case 'locked': return 'Terkunci';
      case 'bills': return 'Tagihan & Cicilan';
      case 'saving': return 'Tabungan';
      default: return 'Kantong';
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
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.joinHeaderBtn}
            onPress={() => {
              hapticSelection();
              setIsJoinModalOpen(true);
            }}
          >
            <Link2 size={15} color={colors.gold.champagne} />
            <Text style={styles.joinHeaderBtnText}>Gabung</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => openCreateModal()}
          >
            <Plus size={20} color={isDark ? '#090A0E' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>
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
                <Wallet size={14} color={isSelected ? (isDark ? '#090A0E' : '#FFFFFF') : colors.text.muted} />
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
              <View style={styles.heroColHeader}>
                <Globe size={11} color={colors.text.muted} />
                <Text style={styles.heroColLabel}>Saldo Bebas (Unallocated)</Text>
              </View>
              <Text style={styles.heroColValuePositive}>{formatRupiah(unallocatedMainBalance)}</Text>
            </View>
            <View style={styles.heroSplitCol}>
              <View style={styles.heroColHeader}>
                <Lock size={11} color={colors.text.muted} />
                <Text style={styles.heroColLabel}>Total di Kantong</Text>
              </View>
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

        {/* Filter Category Tabs (Semua, Belanja, Tabungan, Bersama) */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTabItem, filterTab === 'all' && styles.filterTabItemActive]}
            onPress={() => {
              hapticSelection();
              setFilterTab('all');
            }}
          >
            <Text style={[styles.filterTabText, filterTab === 'all' && styles.filterTabTextActive]}>
              Semua ({pockets.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTabItem, filterTab === 'spending' && styles.filterTabItemActive]}
            onPress={() => {
              hapticSelection();
              setFilterTab('spending');
            }}
          >
            <ShoppingBag size={12} color={filterTab === 'spending' ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne} />
            <Text style={[styles.filterTabText, filterTab === 'spending' && styles.filterTabTextActive]}>
              Belanja ({spendingPockets.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTabItem, filterTab === 'saving' && styles.filterTabItemActive]}
            onPress={() => {
              hapticSelection();
              setFilterTab('saving');
            }}
          >
            <TrendingUp size={12} color={filterTab === 'saving' ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne} />
            <Text style={[styles.filterTabText, filterTab === 'saving' && styles.filterTabTextActive]}>
              Tabungan ({savingPockets.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTabItem, filterTab === 'shared' && styles.filterTabItemActive]}
            onPress={() => {
              hapticSelection();
              setFilterTab('shared');
            }}
          >
            <Users size={12} color={filterTab === 'shared' ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne} />
            <Text style={[styles.filterTabText, filterTab === 'shared' && styles.filterTabTextActive]}>
              Bersama ({sharedPockets.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pockets List */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionLabel}>
            {filterTab === 'shared'
              ? `KANTONG BERSAMA (${sharedPockets.length})`
              : filterTab === 'spending'
              ? `KANTONG BELANJA & ANGGARAN (${spendingPockets.length})`
              : filterTab === 'saving'
              ? `KANTONG TABUNGAN & IMPIAN (${savingPockets.length})`
              : `SUB-KANTONG TERSEDIA (${pockets.length})`}
          </Text>
          <TouchableOpacity onPress={() => openCreateModal()}>
            <Text style={styles.linkText}>+ Buat Baru</Text>
          </TouchableOpacity>
        </View>

        {displayedPockets.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              {filterTab === 'shared' ? (
                <Users size={32} color={colors.gold.champagne} />
              ) : (
                <Archive size={32} color={colors.gold.champagne} />
              )}
            </View>
            <Text style={styles.emptyTitle}>
              {filterTab === 'shared' ? 'Belum Ada Kantong Bersama' : 'Belum Ada Kantong'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filterTab === 'shared'
                ? 'Buat kantong patungan bersama teman/keluarga atau masukkan kode undangan untuk bergabung.'
                : 'Bagi saldo rekeningmu ke beberapa sub-kantong untuk mengamankan uang makan, belanja bulanan, dan tagihan.'}
            </Text>
            {filterTab === 'shared' ? (
              <View style={styles.emptyBtnRow}>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => openCreateModal(true)}
                >
                  <Text style={styles.emptyActionBtnText}>+ Buat Kantong Bersama</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emptyActionSecondaryBtn}
                  onPress={() => setIsJoinModalOpen(true)}
                >
                  <Text style={styles.emptyActionSecondaryText}>Gabung via Kode</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.emptyActionBtn, { marginTop: 16 }]}
                onPress={() => openCreateModal(false)}
              >
                <Text style={styles.emptyActionBtnText}>+ Buat Kantong Baru</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          displayedPockets.map((pkt) => {
            const hasTarget = pkt.targetAmount && pkt.targetAmount > 0;
            const progress = hasTarget ? Math.min(100, Math.round((pkt.allocatedBalance / pkt.targetAmount!) * 100)) : 0;

            return (
              <View key={pkt.id} style={[styles.pocketCard, pkt.isShared && styles.pocketCardShared]}>
                <View style={styles.pocketHeaderRow}>
                  <View style={[styles.pocketEmojiWrap, pkt.isShared && styles.pocketEmojiWrapShared]}>
                    <AppIcon
                      name={pkt.emoji}
                      defaultFallback={pkt.isShared ? 'users' : 'wallet'}
                      size={20}
                      color={colors.gold.champagne}
                    />
                  </View>
                  <View style={styles.pocketInfo}>
                    <Text style={styles.pocketName}>{pkt.name}</Text>
                    <View style={styles.pocketTagRow}>
                      <View style={[styles.pocketTypeBadge, pkt.isShared && styles.pocketTypeBadgeShared]}>
                        <Text style={[styles.pocketTypeBadgeText, pkt.isShared && styles.pocketTypeBadgeTextShared]}>
                          {getTypeName(pkt.type, pkt.isShared)}
                        </Text>
                      </View>
                      {pkt.isShared && (
                        <View style={styles.membersCountBadge}>
                          <Users size={10} color={colors.gold.champagne} />
                          <Text style={styles.membersCountBadgeText}>
                            {pkt.membersCount ? `${pkt.membersCount} Anggota` : 'Kantong Kolaboratif'}
                          </Text>
                        </View>
                      )}
                      {pkt.isLocked && (
                        <View style={styles.lockedBadge}>
                          <Lock size={10} color="#EF4444" />
                          <Text style={styles.lockedBadgeText}>Terkunci</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.pocketAmount}>{formatRupiah(pkt.allocatedBalance)}</Text>
                </View>

                {/* Invite Code Bar for Shared Pockets */}
                {pkt.isShared && pkt.inviteCode && (
                  <View style={styles.inviteCodeBar}>
                    <View style={styles.inviteCodeLeft}>
                      <Link2 size={12} color={colors.gold.champagne} />
                      <Text style={styles.inviteCodeLabel}>Kode Undangan:</Text>
                      <Text style={styles.inviteCodeValue}>{pkt.inviteCode}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.shareBtnSmall}
                      onPress={() => handleShareInvite(pkt)}
                    >
                      <Share2 size={12} color={colors.gold.champagne} />
                      <Text style={styles.shareBtnSmallText}>Bagikan</Text>
                    </TouchableOpacity>
                  </View>
                )}

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
                  {pkt.isShared ? (
                    <TouchableOpacity
                      style={[styles.cardActionBtn, styles.cardActionBtnGold]}
                      onPress={() => {
                        hapticSelection();
                        openSharedPocketDetail(pkt);
                      }}
                    >
                      <Users size={13} color={colors.gold.champagne} />
                      <Text style={[styles.cardActionText, { color: colors.gold.champagne, fontWeight: '700' }]}>
                        Kelola Patungan
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.cardActionBtn}
                      onPress={() => handleToggleShareMode(pkt)}
                    >
                      <Users size={13} color={colors.gold.champagne} />
                      <Text style={[styles.cardActionText, { color: colors.gold.champagne }]}>Jadikan Bersama</Text>
                    </TouchableOpacity>
                  )}

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
                    <Text style={styles.cardActionText}>Pindah</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => handleToggleLock(pkt)}
                  >
                    {pkt.isLocked ? (
                      <Unlock size={13} color={colors.flow.income} />
                    ) : (
                      <Lock size={13} color={colors.text.muted} />
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

      {/* ======================================================== */}
      {/* MODAL 1: Detail & Kelola Kantong Bersama (Shared Pocket) */}
      {/* ======================================================== */}
      <Modal visible={isDetailModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsDetailModalOpen(false)}
          />
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeaderCloseRow}>
              <View style={styles.modalHeaderTitleWrap}>
                <View style={styles.modalTitleRow}>
                  <AppIcon name={activePocket?.emoji} defaultFallback="users" size={20} color={colors.gold.champagne} />
                  <Text style={styles.modalTitle}>{activePocket?.name}</Text>
                </View>
                <View style={styles.sharedBadgeActive}>
                  <Users size={11} color={colors.gold.champagne} />
                  <Text style={styles.sharedBadgeActiveText}>Kantong Bersama</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsDetailModalOpen(false)}>
                <X size={22} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Financial Status Hero inside Modal */}
              <View style={styles.sharedHeroCard}>
                <Text style={styles.sharedHeroSub}>TOTAL DANA PATUNGAN TERKUMPUL</Text>
                <Text style={styles.sharedHeroBalance}>
                  {formatRupiah(activePocket?.allocatedBalance || 0)}
                </Text>

                {activePocket?.targetAmount && activePocket.targetAmount > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.round(
                                ((activePocket.allocatedBalance || 0) / activePocket.targetAmount) * 100
                              )
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.progressTextRow}>
                      <Text style={styles.progressText}>Target: {formatRupiah(activePocket.targetAmount)}</Text>
                      <Text style={styles.progressTextGold}>
                        {Math.round(((activePocket.allocatedBalance || 0) / activePocket.targetAmount) * 100)}%
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Invite Code Share Card */}
              {activePocket?.inviteCode && (
                <View style={styles.inviteShareBox}>
                  <View>
                    <Text style={styles.inviteShareLabel}>KODE UNDANGAN GABUNG</Text>
                    <Text style={styles.inviteShareCode}>{activePocket.inviteCode}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.inviteShareBtn}
                    onPress={() => activePocket && handleShareInvite(activePocket)}
                  >
                    <Share2 size={14} color={isDark ? '#090A0E' : '#FFFFFF'} />
                    <Text style={styles.inviteShareBtnText}>Undang Teman</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Action: Setor Patungan Button */}
              <TouchableOpacity
                style={styles.primaryContributeBtn}
                onPress={() => {
                  hapticSelection();
                  setIsContributeModalOpen(true);
                }}
              >
                <HandCoins size={18} color={isDark ? '#090A0E' : '#FFFFFF'} />
                <Text style={styles.primaryContributeBtnText}>+ Setor Patungan / Kontribusi</Text>
              </TouchableOpacity>

              {/* Section: Anggota Kantong */}
              <View style={styles.modalSectionHeaderRow}>
                <Text style={styles.modalSectionHeader}>DAFTAR ANGGOTA ({activeMembers.length})</Text>
                <TouchableOpacity
                  style={styles.addMemberSmallBtn}
                  onPress={() => {
                    hapticSelection();
                    setIsAddMemberModalOpen(true);
                  }}
                >
                  <UserPlus size={12} color={colors.gold.champagne} />
                  <Text style={styles.addMemberSmallBtnText}>Tambah</Text>
                </TouchableOpacity>
              </View>

              {activeMembers.length === 0 ? (
                <Text style={styles.emptyListText}>Belum ada anggota terdaftar.</Text>
              ) : (
                activeMembers.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <AppIcon name={m.avatarEmoji} defaultFallback="user" size={16} color={colors.gold.champagne} />
                    </View>
                    <View style={styles.memberInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.memberName}>{m.name}</Text>
                        {m.role === 'owner' && (
                          <View style={styles.ownerBadge}>
                            <Text style={styles.ownerBadgeText}>Owner</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberSub}>
                        Total setor: {formatRupiah(m.totalContributed || 0)}
                      </Text>
                    </View>
                    {m.role !== 'owner' && (
                      <TouchableOpacity onPress={() => handleDeleteMember(m)}>
                        <X size={16} color={colors.text.muted} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}

              {/* Section: Riwayat Kontribusi / Setoran */}
              <Text style={[styles.modalSectionHeader, { marginTop: 20 }]}>
                RIWAYAT SETORAN TERAKHIR ({activeContributions.length})
              </Text>

              {activeContributions.length === 0 ? (
                <Text style={styles.emptyListText}>Belum ada riwayat setoran.</Text>
              ) : (
                activeContributions.map((c) => (
                  <View key={c.id} style={styles.contributionRow}>
                    <View style={styles.contribAvatarWrap}>
                      <AppIcon name={c.memberAvatar} defaultFallback="user" size={14} color={colors.gold.champagne} />
                    </View>
                    <View style={styles.contribInfo}>
                      <Text style={styles.contribName}>{c.memberName}</Text>
                      {c.note ? <Text style={styles.contribNote}>{c.note}</Text> : null}
                      <Text style={styles.contribDate}>
                        {new Date(c.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.contribAmount}>+{formatRupiah(c.amount)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: Setor Patungan (Add Contribution) */}
      {/* ======================================================== */}
      <Modal visible={isContributeModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsContributeModalOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeaderCloseRow}>
              <View style={styles.modalTitleRow}>
                <Coins size={20} color={colors.gold.champagne} />
                <Text style={styles.modalTitle}>Setor ke {activePocket?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsContributeModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Catat kontribusi setoran untuk menambah saldo patungan.</Text>

            <Text style={styles.modalLabel}>NAMA PENYETOR</Text>
            <TextInput
              style={styles.textInput}
              value={contributeMemberName}
              onChangeText={setContributeMemberName}
              placeholder="Cth: Saya / Budi / Sarah"
              placeholderTextColor={colors.text.muted}
            />

            <Text style={styles.modalLabel}>NOMINAL SETORAN</Text>
            <TextInput
              style={styles.textInput}
              value={contributeAmountInput}
              onChangeText={(val) => {
                const numeric = val.replace(/\D/g, '');
                setContributeAmountInput(numeric ? formatRupiah(parseInt(numeric, 10)) : '');
              }}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
            />

            {/* Quick Nominal Chips */}
            <View style={styles.quickNominalRow}>
              {[50000, 100000, 250000, 500000].map((nom) => (
                <TouchableOpacity
                  key={nom}
                  style={styles.quickNominalChip}
                  onPress={() => {
                    hapticSelection();
                    setContributeAmountInput(formatRupiah(nom));
                  }}
                >
                  <Text style={styles.quickNominalChipText}>+{nom / 1000}rb</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>CATATAN SETORAN (OPSIONAL)</Text>
            <TextInput
              style={styles.textInput}
              value={contributeNoteInput}
              onChangeText={setContributeNoteInput}
              placeholder="Cth: Cicilan villa tahap 1"
              placeholderTextColor={colors.text.muted}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsContributeModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddContribution}
              >
                <Text style={styles.submitBtnText}>Simpan Setoran</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: Gabung Kantong Bersama via Kode Undangan */}
      {/* ======================================================== */}
      <Modal visible={isJoinModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsJoinModalOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeaderCloseRow}>
              <View style={styles.modalTitleRow}>
                <Link2 size={20} color={colors.gold.champagne} />
                <Text style={styles.modalTitle}>Gabung Kantong Bersama</Text>
              </View>
              <TouchableOpacity onPress={() => setIsJoinModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Masukkan kode undangan yang dibagikan oleh teman atau keluarga Anda.
            </Text>

            <Text style={styles.modalLabel}>KODE UNDANGAN</Text>
            <TextInput
              style={[styles.textInput, { textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1.5 }]}
              value={joinCodeInput}
              onChangeText={setJoinCodeInput}
              placeholder="Cth: PKT-7X9K2"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="characters"
            />

            <Text style={styles.modalLabel}>NAMA LENGKAP ANDA</Text>
            <TextInput
              style={styles.textInput}
              value={joinNameInput}
              onChangeText={setJoinNameInput}
              placeholder="Cth: Gary Hardyansyah"
              placeholderTextColor={colors.text.muted}
            />

            <Text style={styles.modalLabel}>PILIH AVATAR IKON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              {AVATAR_ICON_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.emojiBtn, joinAvatarInput === key && styles.emojiBtnSelected]}
                  onPress={() => {
                    hapticSelection();
                    setJoinAvatarInput(key);
                  }}
                >
                  <AppIcon
                    name={key}
                    size={18}
                    color={joinAvatarInput === key ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsJoinModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleJoinViaCode}
              >
                <Text style={styles.submitBtnText}>Gabung Sekarang</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: Tambah Anggota Manual */}
      {/* ======================================================== */}
      <Modal visible={isAddMemberModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsAddMemberModalOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeaderCloseRow}>
              <View style={styles.modalTitleRow}>
                <UserPlus size={20} color={colors.gold.champagne} />
                <Text style={styles.modalTitle}>Tambah Anggota</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddMemberModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Tambahkan teman untuk mencatat kontribusi patungan mereka.</Text>

            <Text style={styles.modalLabel}>NAMA ANGGOTA</Text>
            <TextInput
              style={styles.textInput}
              value={newMemberName}
              onChangeText={setNewMemberName}
              placeholder="Cth: Sarah / Dimas"
              placeholderTextColor={colors.text.muted}
            />

            <Text style={styles.modalLabel}>PILIH AVATAR IKON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              {AVATAR_ICON_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.emojiBtn, newMemberAvatar === key && styles.emojiBtnSelected]}
                  onPress={() => {
                    hapticSelection();
                    setNewMemberAvatar(key);
                  }}
                >
                  <AppIcon
                    name={key}
                    size={18}
                    color={newMemberAvatar === key ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAddMemberModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddMember}
              >
                <Text style={styles.submitBtnText}>Simpan Anggota</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: Buat Kantong Baru */}
      {/* ======================================================== */}
      <Modal visible={isCreateModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsCreateModalOpen(false)}
          />
          <View style={[styles.modalSheet, styles.createModalSheet]}>
            <View style={styles.modalDragHandle} />

            {/* Header */}
            <View style={styles.modalHeaderCloseRow}>
              <View style={styles.modalTitleRow}>
                <View style={styles.createModalTitleIconWrap}>
                  <Sparkles size={18} color={colors.gold.champagne} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Buat Kantong Baru</Text>
                  <Text style={styles.createModalSubtext}>
                    {isSharedCreateToggle
                      ? 'Kantong Patungan & Kas Bersama'
                      : 'Pos Pengeluaran & Tabungan Pribadi'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.createModalScrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.createModalScroll}
            >
              {/* LIVE CARD PREVIEW */}
              <View style={styles.createPreviewSection}>
                <Text style={styles.createPreviewHeaderLabel}>PREVIEW TAMPILAN KARTU</Text>
                <View style={[styles.createPreviewCard, isSharedCreateToggle && styles.createPreviewCardShared]}>
                  <View style={styles.createPreviewTopRow}>
                    <View style={[styles.createPreviewIconWrap, isSharedCreateToggle && styles.createPreviewIconWrapShared]}>
                      <AppIcon
                        name={pocketEmoji}
                        size={22}
                        color={colors.gold.champagne}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.createPreviewName} numberOfLines={1}>
                        {pocketName.trim() || (isSharedCreateToggle ? 'Nama Kantong Bersama' : 'Nama Kantong')}
                      </Text>
                      <View style={styles.createPreviewBadgeRow}>
                        {isSharedCreateToggle ? (
                          <View style={styles.createPreviewBadgeShared}>
                            <Users size={11} color={isDark ? '#090A0E' : '#FFFFFF'} />
                            <Text style={styles.createPreviewBadgeSharedText}>Kantong Bersama</Text>
                          </View>
                        ) : (
                          <View style={styles.createPreviewBadge}>
                            {pocketType === 'spending' && <ShoppingBag size={11} color={colors.gold.champagne} />}
                            {pocketType === 'bills' && <FileText size={11} color={colors.gold.champagne} />}
                            {pocketType === 'saving' && <TrendingUp size={11} color={colors.gold.champagne} />}
                            {pocketType === 'locked' && <Lock size={11} color={colors.gold.champagne} />}
                            <Text style={styles.createPreviewBadgeText}>
                              {pocketType === 'spending'
                                ? 'Belanja'
                                : pocketType === 'bills'
                                ? 'Tagihan'
                                : pocketType === 'saving'
                                ? 'Tabungan'
                                : 'Terkunci'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Allocation and Target Info in Preview */}
                  <View style={styles.createPreviewBottomRow}>
                    <View>
                      <Text style={styles.createPreviewAllocLabel}>Alokasi Awal</Text>
                      <Text style={styles.createPreviewAllocValue}>
                        {pocketAllocationInput.trim() ? pocketAllocationInput : 'Rp 0'}
                      </Text>
                    </View>
                    {pocketTargetInput.trim() ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.createPreviewAllocLabel}>Target Capaian</Text>
                        <Text style={styles.createPreviewTargetValue}>
                          {pocketTargetInput}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Target Mini Progress Bar */}
                  {(() => {
                    const allocNum = parseInt(pocketAllocationInput.replace(/\D/g, ''), 10) || 0;
                    const targetNum = parseInt(pocketTargetInput.replace(/\D/g, ''), 10) || 0;
                    if (targetNum > 0) {
                      const pct = Math.min(100, Math.round((allocNum / targetNum) * 100));
                      return (
                        <View style={styles.createPreviewProgressWrap}>
                          <View style={styles.createPreviewProgressTrack}>
                            <View style={[styles.createPreviewProgressFill, { width: `${pct}%` }]} />
                          </View>
                          <Text style={styles.createPreviewProgressText}>{pct}% Tercapai</Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              </View>

              {/* MODE SELECTION (Segmented Control) */}
              <View style={styles.createSection}>
                <Text style={styles.createSectionLabel}>PILIH MODE KANTONG</Text>
                <View style={styles.createModeSegment}>
                  <TouchableOpacity
                    style={[
                      styles.createModeBtn,
                      !isSharedCreateToggle && styles.createModeBtnActive,
                    ]}
                    onPress={() => {
                      hapticSelection();
                      setIsSharedCreateToggle(false);
                      if (pocketEmoji === 'users') {
                        setPocketEmoji('wallet');
                      }
                      if (pocketType === 'shared') {
                        setPocketType('spending');
                      }
                    }}
                  >
                    <Wallet
                      size={14}
                      color={!isSharedCreateToggle ? (isDark ? '#090A0E' : '#FFFFFF') : colors.text.muted}
                    />
                    <Text
                      style={[
                        styles.createModeBtnText,
                        !isSharedCreateToggle && styles.createModeBtnTextActive,
                      ]}
                    >
                      Pribadi
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.createModeBtn,
                      isSharedCreateToggle && styles.createModeBtnActive,
                    ]}
                    onPress={() => {
                      hapticSelection();
                      setIsSharedCreateToggle(true);
                      setPocketEmoji('users');
                    }}
                  >
                    <Users
                      size={14}
                      color={isSharedCreateToggle ? (isDark ? '#090A0E' : '#FFFFFF') : colors.text.muted}
                    />
                    <Text
                      style={[
                        styles.createModeBtnText,
                        isSharedCreateToggle && styles.createModeBtnTextActive,
                      ]}
                    >
                      Bersama (Patungan)
                    </Text>
                  </TouchableOpacity>
                </View>

                {isSharedCreateToggle && (
                  <View style={styles.createSharedInfoBox}>
                    <Users size={14} color={colors.gold.champagne} />
                    <Text style={styles.createSharedInfoText}>
                      Kantong bersama dilengkapi kode unik undangan agar teman, pasangan, atau keluarga dapat ikut menyetor dana.
                    </Text>
                  </View>
                )}
              </View>

              {/* ICON PICKER */}
              <View style={styles.createSection}>
                <View style={styles.createSectionHeaderRow}>
                  <Text style={styles.createSectionLabel}>PILIH IKON KANTONG</Text>
                  <Text style={styles.createSectionValue}>{pocketEmoji}</Text>
                </View>
                <View style={styles.createEmojiGrid}>
                  {POCKET_ICON_KEYS.map((key) => {
                    const isSelected = pocketEmoji === key;
                    return (
                      <View key={key} style={styles.createEmojiCol}>
                        <TouchableOpacity
                          style={[
                            styles.createEmojiBtn,
                            isSelected && styles.createEmojiBtnActive,
                          ]}
                          onPress={() => {
                            hapticSelection();
                            setPocketEmoji(key);
                          }}
                        >
                          <AppIcon
                            name={key}
                            size={18}
                            color={
                              isSelected
                                ? (isDark ? '#090A0E' : '#FFFFFF')
                                : colors.gold.champagne
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* NAMA KANTONG INPUT */}
              <View style={styles.createSection}>
                <Text style={styles.createSectionLabel}>NAMA KANTONG</Text>
                <View style={styles.createInputContainer}>
                  <TextInput
                    style={styles.createTextInput}
                    value={pocketName}
                    onChangeText={setPocketName}
                    placeholder={
                      isSharedCreateToggle
                        ? 'Cth: Patungan Liburan Bali / Kas Kost'
                        : 'Cth: Belanja Mingguan / Dana Darurat'
                    }
                    placeholderTextColor={colors.text.muted}
                  />
                  {pocketName.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setPocketName('')}
                      style={styles.createInputClearBtn}
                    >
                      <X size={14} color={colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* POCKET TYPE (PERSONAL ONLY) */}
              {!isSharedCreateToggle && (
                <View style={styles.createSection}>
                  <Text style={styles.createSectionLabel}>TIPE KANTONG PRIBADI</Text>
                  <View style={styles.createTypeGrid}>
                    {[
                      {
                        type: 'spending' as PocketType,
                        label: 'Belanja',
                        desc: 'Kebutuhan & jajan harian',
                        icon: ShoppingBag,
                      },
                      {
                        type: 'bills' as PocketType,
                        label: 'Tagihan',
                        desc: 'Listrik, sewa & langganan',
                        icon: FileText,
                      },
                      {
                        type: 'saving' as PocketType,
                        label: 'Tabungan',
                        desc: 'Dana impian & masa depan',
                        icon: TrendingUp,
                      },
                      {
                        type: 'locked' as PocketType,
                        label: 'Terkunci',
                        desc: 'Komitmen disiplin dana',
                        icon: Lock,
                      },
                    ].map((item) => {
                      const isSelected = pocketType === item.type;
                      const IconComponent = item.icon;
                      return (
                        <TouchableOpacity
                          key={item.type}
                          style={[
                            styles.createTypeCard,
                            isSelected && styles.createTypeCardActive,
                          ]}
                          onPress={() => {
                            hapticSelection();
                            setPocketType(item.type);
                          }}
                        >
                          <View
                            style={[
                              styles.createTypeCardIconWrap,
                              isSelected && styles.createTypeCardIconWrapActive,
                            ]}
                          >
                            <IconComponent
                              size={15}
                              color={isSelected ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.createTypeCardTitle,
                                isSelected && styles.createTypeCardTitleActive,
                              ]}
                            >
                              {item.label}
                            </Text>
                            <Text style={styles.createTypeCardDesc} numberOfLines={1}>
                              {item.desc}
                            </Text>
                          </View>
                          {isSelected && (
                            <View style={styles.createTypeCheckmark}>
                              <CheckCircle2 size={13} color={colors.gold.champagne} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ALOKASI AWAL (OPSIONAL) */}
              <View style={styles.createSection}>
                <View style={styles.createSectionHeaderRow}>
                  <Text style={styles.createSectionLabel}>ALOKASI AWAL (OPSIONAL)</Text>
                  <View style={styles.createUnallocatedBadge}>
                    <Globe size={11} color={colors.gold.champagne} />
                    <Text style={styles.createUnallocatedText}>
                      Bebas: {formatRupiah(unallocatedMainBalance)}
                    </Text>
                  </View>
                </View>

                <TextInput
                  style={[
                    styles.createTextInput,
                    (() => {
                      const num = parseInt(pocketAllocationInput.replace(/\D/g, ''), 10) || 0;
                      return num > unallocatedMainBalance ? styles.createTextInputError : null;
                    })(),
                  ]}
                  value={pocketAllocationInput}
                  onChangeText={(val) => {
                    const numeric = val.replace(/\D/g, '');
                    setPocketAllocationInput(numeric ? formatRupiah(parseInt(numeric, 10)) : '');
                  }}
                  placeholder="Rp 0"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                />

                {/* Over-allocation Warning */}
                {(() => {
                  const num = parseInt(pocketAllocationInput.replace(/\D/g, ''), 10) || 0;
                  if (num > unallocatedMainBalance) {
                    return (
                      <View style={styles.createWarningBox}>
                        <AlertCircle size={13} color="#EF4444" />
                        <Text style={styles.createWarningText}>
                          Alokasi melebihi saldo bebas akun ({formatRupiah(unallocatedMainBalance)}).
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

                {/* Quick Chips for Initial Allocation */}
                <View style={styles.createQuickRow}>
                  {[100000, 250000, 500000, 1000000].map((nom) => (
                    <TouchableOpacity
                      key={nom}
                      style={styles.createQuickChip}
                      onPress={() => {
                        hapticSelection();
                        setPocketAllocationInput(formatRupiah(nom));
                      }}
                    >
                      <Text style={styles.createQuickChipText}>
                        +{nom >= 1000000 ? `${nom / 1000000}jt` : `${nom / 1000}rb`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {unallocatedMainBalance > 0 && (
                    <TouchableOpacity
                      style={[styles.createQuickChip, styles.createQuickChipMax]}
                      onPress={() => {
                        hapticSelection();
                        setPocketAllocationInput(formatRupiah(unallocatedMainBalance));
                      }}
                    >
                      <Text style={styles.createQuickChipMaxText}>Maksimal</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* TARGET NOMINAL (OPSIONAL) */}
              <View style={styles.createSection}>
                <View style={styles.createSectionHeaderRow}>
                  <Text style={styles.createSectionLabel}>TARGET NOMINAL (OPSIONAL)</Text>
                  <Text style={styles.createSectionOptionalNote}>Untuk progress bar</Text>
                </View>

                <TextInput
                  style={styles.createTextInput}
                  value={pocketTargetInput}
                  onChangeText={(val) => {
                    const numeric = val.replace(/\D/g, '');
                    setPocketTargetInput(numeric ? formatRupiah(parseInt(numeric, 10)) : '');
                  }}
                  placeholder="Rp 0"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                />

                {/* Quick Chips for Target Amount */}
                <View style={styles.createQuickRow}>
                  {[1000000, 5000000, 10000000, 25000000].map((nom) => (
                    <TouchableOpacity
                      key={nom}
                      style={styles.createQuickChip}
                      onPress={() => {
                        hapticSelection();
                        setPocketTargetInput(formatRupiah(nom));
                      }}
                    >
                      <Text style={styles.createQuickChipText}>
                        {nom / 1000000} Juta
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* ACTION BUTTONS (FIXED AT BOTTOM) */}
            <View style={styles.createModalBtnRow}>
              <TouchableOpacity
                style={styles.createCancelBtn}
                onPress={() => setIsCreateModalOpen(false)}
              >
                <Text style={styles.createCancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.createSubmitBtn,
                  (() => {
                    const num = parseInt(pocketAllocationInput.replace(/\D/g, ''), 10) || 0;
                    return num > unallocatedMainBalance || !pocketName.trim()
                      ? styles.createSubmitBtnDisabled
                      : null;
                  })(),
                ]}
                onPress={handleCreatePocket}
                disabled={(() => {
                  const num = parseInt(pocketAllocationInput.replace(/\D/g, ''), 10) || 0;
                  return num > unallocatedMainBalance || !pocketName.trim();
                })()}
              >
                <Sparkles
                  size={15}
                  color={
                    (() => {
                      const num = parseInt(pocketAllocationInput.replace(/\D/g, ''), 10) || 0;
                      return num > unallocatedMainBalance || !pocketName.trim()
                        ? colors.text.muted
                        : (isDark ? '#090A0E' : '#FFFFFF');
                    })()
                  }
                />
                <Text
                  style={[
                    styles.createSubmitBtnText,
                    (() => {
                      const num = parseInt(pocketAllocationInput.replace(/\D/g, ''), 10) || 0;
                      return num > unallocatedMainBalance || !pocketName.trim()
                        ? styles.createSubmitBtnTextDisabled
                        : null;
                    })(),
                  ]}
                >
                  Simpan Kantong
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 6: Pindah / Transfer Dana Alokasi */}
      {/* ======================================================== */}
      <Modal visible={isTransferModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsTransferModalOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeaderCloseRow}>
              <View style={styles.modalTitleRow}>
                <ArrowRightLeft size={20} color={colors.gold.champagne} />
                <Text style={styles.modalTitle}>Pindah Alokasi Dana</Text>
              </View>
              <TouchableOpacity onPress={() => setIsTransferModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Mutasi alokasi internal akun tanpa memengaruhi total kas fisik.</Text>

            <Text style={styles.modalLabel}>DARI SUMBER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              <TouchableOpacity
                style={[styles.accountTab, transferSourcePocketId === null && styles.accountTabActive]}
                onPress={() => setTransferSourcePocketId(null)}
              >
                <View style={styles.pillWithIcon}>
                  <Globe
                    size={12}
                    color={transferSourcePocketId === null ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
                  />
                  <Text style={[styles.accountTabText, transferSourcePocketId === null && styles.accountTabTextActive]}>
                    Saldo Bebas ({formatRupiah(unallocatedMainBalance)})
                  </Text>
                </View>
              </TouchableOpacity>
              {pockets.map((p) => {
                const isSelected = transferSourcePocketId === p.id;
                const iconColor = isSelected ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.accountTab, isSelected && styles.accountTabActive]}
                    onPress={() => setTransferSourcePocketId(p.id)}
                  >
                    <View style={styles.pillWithIcon}>
                      <AppIcon
                        name={p.emoji}
                        defaultFallback={p.isShared ? 'users' : 'wallet'}
                        size={12}
                        color={iconColor}
                      />
                      <Text style={[styles.accountTabText, isSelected && styles.accountTabTextActive]}>
                        {p.name} ({formatRupiah(p.allocatedBalance)})
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>KE TUJUAN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              <TouchableOpacity
                style={[styles.accountTab, transferDestPocketId === null && styles.accountTabActive]}
                onPress={() => setTransferDestPocketId(null)}
              >
                <View style={styles.pillWithIcon}>
                  <Globe
                    size={12}
                    color={transferDestPocketId === null ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
                  />
                  <Text style={[styles.accountTabText, transferDestPocketId === null && styles.accountTabTextActive]}>
                    Saldo Bebas
                  </Text>
                </View>
              </TouchableOpacity>
              {pockets.map((p) => {
                const isSelected = transferDestPocketId === p.id;
                const iconColor = isSelected ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.accountTab, isSelected && styles.accountTabActive]}
                    onPress={() => setTransferDestPocketId(p.id)}
                  >
                    <View style={styles.pillWithIcon}>
                      <AppIcon
                        name={p.emoji}
                        defaultFallback={p.isShared ? 'users' : 'wallet'}
                        size={12}
                        color={iconColor}
                      />
                      <Text style={[styles.accountTabText, isSelected && styles.accountTabTextActive]}>
                        {p.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
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

            {/* Quick Chips for Transfer Amount */}
            <View style={styles.quickNominalRow}>
              {[50000, 100000, 250000, 500000].map((nom) => (
                <TouchableOpacity
                  key={nom}
                  style={styles.quickNominalChip}
                  onPress={() => {
                    hapticSelection();
                    setTransferAmountInput(formatRupiah(nom));
                  }}
                >
                  <Text style={styles.quickNominalChipText}>+{nom / 1000}rb</Text>
                </TouchableOpacity>
              ))}
            </View>

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
    },
    backBtn: {
      padding: 6,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    joinHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    joinHeaderBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    addBtn: {
      backgroundColor: colors.gold.champagne,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: 16,
      paddingBottom: 50,
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
      color: isDark ? '#090A0E' : '#FFFFFF',
      fontWeight: '700',
    },
    pillWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    heroCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.2)',
      marginBottom: 16,
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
    heroColHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 4,
    },
    heroColLabel: {
      fontSize: 11,
      color: colors.text.muted,
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
    filterTabsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
    },
    filterTabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: colors.bg.surface,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    filterTabItemActive: {
      backgroundColor: colors.gold.champagne,
      borderColor: colors.gold.champagne,
    },
    filterTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.muted,
    },
    filterTabTextActive: {
      color: isDark ? '#090A0E' : '#FFFFFF',
      fontWeight: '700',
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
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
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
    },
    emptyBtnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
    },
    emptyActionBtn: {
      backgroundColor: colors.gold.champagne,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
    },
    emptyActionBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#090A0E' : '#FFFFFF',
    },
    emptyActionSecondaryBtn: {
      backgroundColor: 'rgba(212, 175, 55, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.3)',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
    },
    emptyActionSecondaryText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    pocketCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      marginBottom: 12,
    },
    pocketCardShared: {
      borderColor: 'rgba(212, 175, 55, 0.3)',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : colors.bg.surface,
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
    pocketEmojiWrapShared: {
      backgroundColor: 'rgba(212, 175, 55, 0.2)',
      borderWidth: 1,
      borderColor: colors.gold.champagne,
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
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
    },
    pocketTypeBadge: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    pocketTypeBadgeShared: {
      backgroundColor: 'rgba(212, 175, 55, 0.15)',
    },
    pocketTypeBadgeText: {
      fontSize: 10,
      color: colors.text.muted,
      fontWeight: '600',
    },
    pocketTypeBadgeTextShared: {
      color: colors.gold.champagne,
      fontWeight: '700',
    },
    membersCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    membersCountBadgeText: {
      fontSize: 10,
      color: colors.gold.champagne,
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
    inviteCodeBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginTop: 10,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    inviteCodeLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    inviteCodeLabel: {
      fontSize: 10,
      color: colors.text.muted,
      fontWeight: '600',
    },
    inviteCodeValue: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.gold.champagne,
      letterSpacing: 1,
    },
    shareBtnSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    shareBtnSmallText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    progressContainer: {
      marginTop: 14,
    },
    progressTrack: {
      height: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
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
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
    },
    cardActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
    },
    cardActionBtnGold: {
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.3)',
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
    modalDragHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalHeaderCloseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalHeaderTitleWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text.primary,
    },
    sharedBadgeActive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(212, 175, 55, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    sharedBadgeActiveText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.text.muted,
      marginTop: 4,
      marginBottom: 16,
      lineHeight: 18,
    },
    sharedHeroCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.25)',
      marginBottom: 14,
    },
    sharedHeroSub: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.gold.champagne,
      letterSpacing: 0.8,
    },
    sharedHeroBalance: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text.primary,
      marginTop: 4,
    },
    inviteShareBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.25)',
      marginBottom: 16,
    },
    inviteShareLabel: {
      fontSize: 10,
      color: colors.text.muted,
      fontWeight: '600',
    },
    inviteShareCode: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.gold.champagne,
      letterSpacing: 1.5,
      marginTop: 2,
    },
    inviteShareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.gold.champagne,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    inviteShareBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#090A0E' : '#FFFFFF',
    },
    primaryContributeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.gold.champagne,
      paddingVertical: 14,
      borderRadius: 12,
      marginBottom: 20,
    },
    primaryContributeBtnText: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? '#090A0E' : '#FFFFFF',
    },
    modalSectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    modalSectionHeader: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 1,
    },
    addMemberSmallBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    addMemberSmallBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg.surface,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    memberAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    memberAvatarText: {
      fontSize: 16,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.primary,
    },
    ownerBadge: {
      backgroundColor: 'rgba(212, 175, 55, 0.2)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    ownerBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    memberSub: {
      fontSize: 11,
      color: colors.text.muted,
      marginTop: 2,
    },
    emptyListText: {
      fontSize: 12,
      color: colors.text.muted,
      fontStyle: 'italic',
      marginVertical: 8,
    },
    contributionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg.surface,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    contribAvatarWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    contribInfo: {
      flex: 1,
    },
    contribName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.primary,
    },
    contribNote: {
      fontSize: 11,
      color: colors.gold.champagne,
      marginTop: 2,
    },
    contribDate: {
      fontSize: 10,
      color: colors.text.muted,
      marginTop: 2,
    },
    contribAmount: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.flow.income,
    },
    sharedToggleBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.bg.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      marginBottom: 16,
    },
    sharedToggleBoxActive: {
      borderColor: colors.gold.champagne,
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    sharedToggleTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.primary,
    },
    sharedToggleTitleActive: {
      color: colors.gold.champagne,
    },
    sharedToggleSubtitle: {
      fontSize: 11,
      color: colors.text.muted,
      marginTop: 2,
      lineHeight: 15,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.gold.champagne,
      borderColor: colors.gold.champagne,
    },
    modalLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 12,
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
      color: isDark ? '#090A0E' : '#FFFFFF',
      fontWeight: '700',
    },
    quickNominalRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    quickNominalChip: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: 'rgba(212, 175, 55, 0.1)',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    quickNominalChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    modalBtnRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 22,
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
      color: isDark ? '#090A0E' : '#FFFFFF',
    },

    // ==========================================
    // REFINED CREATE POCKET MODAL STYLES
    // ==========================================
    createModalSheet: {
      height: '92%',
      maxHeight: '92%',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: Platform.OS === 'ios' ? 28 : 18,
      display: 'flex',
      flexDirection: 'column',
    },
    createModalScrollView: {
      flex: 1,
    },
    createModalTitleIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    createModalSubtext: {
      fontSize: 11,
      color: colors.text.muted,
      marginTop: 2,
    },
    createModalScroll: {
      paddingBottom: 24,
    },
    createPreviewSection: {
      marginTop: 6,
      marginBottom: 14,
    },
    createPreviewHeaderLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.gold.champagne,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    createPreviewCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 2,
    },
    createPreviewCardShared: {
      borderColor: 'rgba(212, 175, 55, 0.35)',
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(212, 175, 55, 0.08)',
    },
    createPreviewTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    createPreviewIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(180, 83, 9, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    createPreviewIconWrapShared: {
      backgroundColor: 'rgba(212, 175, 55, 0.22)',
      borderColor: colors.gold.champagne,
    },
    createPreviewName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text.primary,
    },
    createPreviewBadgeRow: {
      flexDirection: 'row',
      marginTop: 4,
    },
    createPreviewBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    createPreviewBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    createPreviewBadgeShared: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.gold.champagne,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    createPreviewBadgeSharedText: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? '#090A0E' : '#FFFFFF',
    },
    createPreviewBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
    },
    createPreviewAllocLabel: {
      fontSize: 10,
      color: colors.text.muted,
      fontWeight: '600',
    },
    createPreviewAllocValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.gold.champagne,
      marginTop: 2,
    },
    createPreviewTargetValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.primary,
      marginTop: 2,
    },
    createPreviewProgressWrap: {
      marginTop: 10,
    },
    createPreviewProgressTrack: {
      height: 5,
      borderRadius: 2.5,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      overflow: 'hidden',
    },
    createPreviewProgressFill: {
      height: '100%',
      backgroundColor: colors.gold.champagne,
      borderRadius: 2.5,
    },
    createPreviewProgressText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.gold.champagne,
      marginTop: 4,
      textAlign: 'right',
    },
    createSection: {
      marginTop: 14,
    },
    createSectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    createSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 0.8,
    },
    createSectionValue: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold.champagne,
      textTransform: 'capitalize',
    },
    createSectionOptionalNote: {
      fontSize: 10,
      color: colors.text.muted,
      fontStyle: 'italic',
    },
    createModeSegment: {
      flexDirection: 'row',
      backgroundColor: colors.bg.surface,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      marginTop: 6,
    },
    createModeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 9,
    },
    createModeBtnActive: {
      backgroundColor: colors.gold.champagne,
    },
    createModeBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.muted,
    },
    createModeBtnTextActive: {
      fontWeight: '800',
      color: isDark ? '#090A0E' : '#FFFFFF',
    },
    createSharedInfoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
      borderRadius: 10,
      padding: 10,
      marginTop: 8,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    createSharedInfoText: {
      flex: 1,
      fontSize: 11,
      color: colors.gold.champagne,
      lineHeight: 15,
    },
    createEmojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 6,
      backgroundColor: colors.bg.surface,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      rowGap: 8,
    },
    createEmojiCol: {
      width: '16.666%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    createEmojiBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    createEmojiBtnActive: {
      backgroundColor: colors.gold.champagne,
      borderColor: colors.gold.champagne,
      shadowColor: colors.gold.champagne,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
      elevation: 3,
    },
    createInputContainer: {
      position: 'relative',
      justifyContent: 'center',
      marginTop: 6,
    },
    createTextInput: {
      backgroundColor: colors.bg.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      color: colors.text.primary,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      marginTop: 6,
    },
    createTextInputError: {
      borderColor: '#EF4444',
    },
    createInputClearBtn: {
      position: 'absolute',
      right: 12,
      top: 15,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    createTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    createTypeCard: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.bg.surface,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      position: 'relative',
    },
    createTypeCardActive: {
      borderColor: colors.gold.champagne,
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    createTypeCardIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    createTypeCardIconWrapActive: {
      backgroundColor: colors.gold.champagne,
    },
    createTypeCardTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text.primary,
    },
    createTypeCardTitleActive: {
      color: colors.gold.champagne,
    },
    createTypeCardDesc: {
      fontSize: 10,
      color: colors.text.muted,
      marginTop: 1,
    },
    createTypeCheckmark: {
      position: 'absolute',
      top: 6,
      right: 6,
    },
    createUnallocatedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(212, 175, 55, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    createUnallocatedText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    createWarningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 6,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
    },
    createWarningText: {
      fontSize: 11,
      color: '#EF4444',
      flex: 1,
    },
    createQuickRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
    },
    createQuickChip: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    createQuickChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    createQuickChipMax: {
      backgroundColor: 'rgba(212, 175, 55, 0.18)',
      borderColor: colors.gold.champagne,
    },
    createQuickChipMaxText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.gold.champagne,
    },
    createModalBtnRow: {
      flexDirection: 'row',
      gap: 10,
      paddingTop: 12,
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
    },
    createCancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.bg.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    createCancelBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.muted,
    },
    createSubmitBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.gold.champagne,
    },
    createSubmitBtnDisabled: {
      backgroundColor: colors.bg.surface,
      opacity: 0.6,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    createSubmitBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: isDark ? '#090A0E' : '#FFFFFF',
    },
    createSubmitBtnTextDisabled: {
      color: colors.text.muted,
    },
  });
