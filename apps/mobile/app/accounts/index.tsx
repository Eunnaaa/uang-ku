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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Landmark,
  Banknote,
  Smartphone,
  Wallet,
  Edit3,
  Archive,
  Check,
  X,
  ShieldCheck,
  ArrowRightLeft,
  EyeOff,
  Eye,
  Crown,
  Sparkles,
  CheckCircle2,
  Lock,
  Globe,
  Coins,
  ArrowUpRight,
} from 'lucide-react-native';
import { formatRupiah, type AccountModel } from '@uangku/contracts';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
import {
  getLocalAccounts,
  insertLocalAccount,
  updateLocalAccount,
  archiveLocalAccount,
  setDefaultLocalAccount,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticLight, hapticSuccess } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

const ACCOUNT_COLORS = [
  { hex: '#D4AF37', label: 'Emas' },
  { hex: '#10B981', label: 'Zamrud' },
  { hex: '#3B82F6', label: 'Safir' },
  { hex: '#EF4444', label: 'Rubi' },
  { hex: '#8B5CF6', label: 'Ametis' },
  { hex: '#94A3B8', label: 'Platinum' },
];

export default function AccountsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'bank' | 'cash' | 'e_wallet'>('all');
  const [isMasked, setIsMasked] = useState(false);

  // Add Account Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'bank' | 'cash' | 'e_wallet'>('bank');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccColor, setNewAccColor] = useState('#D4AF37');
  const [newAccIsHidden, setNewAccIsHidden] = useState(false);

  // Edit Account Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<AccountModel | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccType, setEditAccType] = useState<'bank' | 'cash' | 'e_wallet'>('bank');
  const [editAccBalance, setEditAccBalance] = useState('');
  const [editAccColor, setEditAccColor] = useState('#D4AF37');
  const [editAccIsHidden, setEditAccIsHidden] = useState(false);
  const [editAccIsDefault, setEditAccIsDefault] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const list = await getLocalAccounts();
      setAccounts(list);
    } catch (err) {
      console.error('Failed to load accounts:', err);
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

  const totalNetWorth = accounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0);
  const totalReserved = accounts.reduce((acc, a) => acc + (a.reservedAmount || 0), 0);
  const availableNetWorth = Math.max(0, totalNetWorth - totalReserved);

  const filteredAccounts = useMemo(() => {
    if (filterTab === 'all') return accounts;
    return accounts.filter((a) => a.type === filterTab);
  }, [accounts, filterTab]);

  const bankCount = useMemo(() => accounts.filter((a) => a.type === 'bank').length, [accounts]);
  const cashCount = useMemo(() => accounts.filter((a) => a.type === 'cash').length, [accounts]);
  const eWalletCount = useMemo(() => accounts.filter((a) => a.type === 'e_wallet').length, [accounts]);

  const handleSaveNewAccount = async () => {
    if (!newAccName.trim()) {
      toast.showWarning('Perhatian', 'Nama dompet atau rekening tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      const numBal = parseInt(newAccBalance.replace(/\D/g, ''), 10) || 0;
      await insertLocalAccount({
        name: newAccName.trim(),
        type: newAccType,
        initialBalance: numBal,
        reservedAmount: 0,
        color: newAccColor,
        isHidden: newAccIsHidden,
      });

      const savedName = newAccName.trim();
      setNewAccName('');
      setNewAccBalance('');
      setNewAccType('bank');
      setNewAccColor('#D4AF37');
      setNewAccIsHidden(false);
      setIsAddModalOpen(false);
      toast.showSuccess('Rekening Ditambahkan', savedName);
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  const handleSaveEditAccount = async () => {
    if (!editingAcc) return;
    if (!editAccName.trim()) {
      toast.showWarning('Perhatian', 'Nama rekening tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      const numBal = parseInt(editAccBalance.replace(/\D/g, ''), 10) || 0;
      await updateLocalAccount(editingAcc.id, {
        name: editAccName.trim(),
        type: editAccType,
        initialBalance: numBal,
        color: editAccColor,
        isHidden: editAccIsHidden,
      });

      if (editAccIsDefault && !editingAcc.isDefault) {
        await setDefaultLocalAccount(editingAcc.id);
      }

      const updatedName = editAccName.trim();
      setIsEditModalOpen(false);
      setEditingAcc(null);
      toast.showSuccess('Rekening Diperbarui', updatedName);
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Memperbarui', err.message);
    }
  };

  const handleArchive = (acc: AccountModel) => {
    if (acc.isDefault) {
      toast.showWarning('Akun Utama', 'Akun default utama tidak dapat diarsipkan.');
      return;
    }

    Alert.alert(
      'Arsipkan Rekening',
      `Yakin ingin mengarsipkan "${acc.name}"? Riwayat transaksi tetap tersimpan dengan aman.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Arsipkan',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticLight();
              await archiveLocalAccount(acc.id);
              toast.showSuccess('Akun Diarsipkan', acc.name);
              await loadData();
            } catch (err: any) {
              toast.showError('Gagal Mengarsipkan', err.message);
            }
          },
        },
      ]
    );
  };

  const getAccountIcon = (type: string, iconColor = colors.gold.champagne, size = 20) => {
    switch (type) {
      case 'bank': return <Landmark size={size} color={iconColor} />;
      case 'cash': return <Banknote size={size} color={iconColor} />;
      case 'e_wallet': return <Smartphone size={size} color={iconColor} />;
      default: return <Wallet size={size} color={iconColor} />;
    }
  };

  const getAccountTypeName = (type: string) => {
    switch (type) {
      case 'bank': return 'Bank';
      case 'cash': return 'Tunai';
      case 'e_wallet': return 'E-Wallet';
      default: return 'Lainnya';
    }
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
          <ChevronLeft size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Dompet & Rekening</Text>
          <Text style={styles.headerSubtitle}>Kelola kas, tabungan & e-wallet</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => {
            hapticSelection();
            setNewAccName('');
            setNewAccBalance('');
            setNewAccType('bank');
            setNewAccColor('#D4AF37');
            setNewAccIsHidden(false);
            setIsAddModalOpen(true);
          }}
        >
          <Plus size={18} color={isDark ? '#090A0E' : '#FFFFFF'} strokeWidth={2.6} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.champagne}
            colors={[colors.gold.champagne]}
          />
        }
      >
        {/* Net Worth Luxury Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <ShieldCheck size={12} color={colors.gold.champagne} />
              <Text style={styles.heroBadgeText}>TOTAL ASSETS</Text>
            </View>
            <View style={styles.heroCountPill}>
              <Coins size={11} color={colors.gold.champagne} />
              <Text style={styles.heroCountText}>{accounts.length} Rekening Aktif</Text>
            </View>
          </View>

          <View style={styles.heroBalanceRow}>
            <Text
              style={styles.heroBalanceText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {isMasked ? '••••••••••••' : formatRupiah(totalNetWorth)}
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setIsMasked(!isMasked);
              }}
              style={styles.heroEyeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isMasked ? (
                <EyeOff size={18} color={colors.gold.champagne} />
              ) : (
                <Eye size={18} color={colors.text.muted} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroSplitRow}>
            <View style={styles.heroSplitCol}>
              <View style={styles.heroColHeader}>
                <Globe size={11} color={colors.text.muted} />
                <Text style={styles.heroColLabel}>Saldo Tersedia (Bebas)</Text>
              </View>
              <Text style={styles.heroColValuePositive}>
                {isMasked ? '••••••' : formatRupiah(availableNetWorth)}
              </Text>
            </View>
            <View style={styles.heroSplitCol}>
              <View style={styles.heroColHeader}>
                <Lock size={11} color={colors.text.muted} />
                <Text style={styles.heroColLabel}>Terkunci (Target / Kantong)</Text>
              </View>
              <Text style={styles.heroColValueGold}>
                {isMasked ? '••••••' : formatRupiah(totalReserved)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Action: Transfer Antar Rekening (Obsidian & Gold Style) */}
        <TouchableOpacity
          style={styles.quickTransferCard}
          activeOpacity={0.8}
          onPress={() => {
            hapticMedium();
            router.push({ pathname: '/transaction/new', params: { initialType: 'transfer' } });
          }}
        >
          <View style={styles.quickTransferIconWrap}>
            <ArrowRightLeft size={16} color={colors.gold.champagne} />
          </View>
          <View style={styles.quickTransferTextWrap}>
            <Text style={styles.quickTransferTitle}>Pindah & Transfer Antar Rekening</Text>
            <Text style={styles.quickTransferDesc}>
              Pindahkan saldo antar dompet tanpa mengubah total kekayaan
            </Text>
          </View>
          <ChevronRight size={18} color={colors.gold.champagne} />
        </TouchableOpacity>

        {/* Filter Tabs (Semua, Bank, Tunai, E-Wallet) */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'all' && styles.filterTabActive]}
            onPress={() => {
              hapticSelection();
              setFilterTab('all');
            }}
          >
            <Text style={[styles.filterTabText, filterTab === 'all' && styles.filterTabTextActive]}>
              Semua ({accounts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'bank' && styles.filterTabActive]}
            onPress={() => {
              hapticSelection();
              setFilterTab('bank');
            }}
          >
            <Landmark
              size={12}
              color={filterTab === 'bank' ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
            />
            <Text style={[styles.filterTabText, filterTab === 'bank' && styles.filterTabTextActive]}>
              Bank ({bankCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'cash' && styles.filterTabActive]}
            onPress={() => {
              hapticSelection();
              setFilterTab('cash');
            }}
          >
            <Banknote
              size={12}
              color={filterTab === 'cash' ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
            />
            <Text style={[styles.filterTabText, filterTab === 'cash' && styles.filterTabTextActive]}>
              Tunai ({cashCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'e_wallet' && styles.filterTabActive]}
            onPress={() => {
              hapticSelection();
              setFilterTab('e_wallet');
            }}
          >
            <Smartphone
              size={12}
              color={filterTab === 'e_wallet' ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
            />
            <Text style={[styles.filterTabText, filterTab === 'e_wallet' && styles.filterTabTextActive]}>
              E-Wallet ({eWalletCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Accounts List Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>
            DAFTAR REKENING ({filteredAccounts.length})
          </Text>
          <TouchableOpacity
            onPress={() => {
              hapticSelection();
              setNewAccName('');
              setNewAccBalance('');
              setNewAccType('bank');
              setNewAccColor('#D4AF37');
              setNewAccIsHidden(false);
              setIsAddModalOpen(true);
            }}
          >
            <Text style={styles.linkText}>+ Tambah Baru</Text>
          </TouchableOpacity>
        </View>

        {filteredAccounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Wallet size={32} color={colors.gold.champagne} />
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Rekening di Kategori Ini</Text>
            <Text style={styles.emptySubtitle}>
              Tambahkan rekening bank, dompet tunai fisik, atau e-wallet untuk mulai mengelola keuangan.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => {
                hapticSelection();
                setIsAddModalOpen(true);
              }}
            >
              <Text style={styles.emptyActionBtnText}>+ Tambah Rekening Baru</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredAccounts.map((acc) => {
            const accColor = acc.color || colors.gold.champagne;
            const availableAmount = Math.max(0, (acc.currentBalance || 0) - (acc.reservedAmount || 0));

            return (
              <View key={acc.id} style={styles.accountCard}>
                {/* Account Header */}
                <View style={styles.accountTopRow}>
                  <View style={styles.accountLeft}>
                    <View
                      style={[
                        styles.accountIconWrap,
                        {
                          borderColor: accColor,
                          backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(212, 175, 55, 0.05)',
                        },
                      ]}
                    >
                      {getAccountIcon(acc.type, accColor, 20)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.accountNameRow}>
                        <Text style={styles.accountName} numberOfLines={1}>
                          {acc.name}
                        </Text>
                        {acc.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Crown size={10} color={colors.gold.champagne} />
                            <Text style={styles.defaultBadgeText}>Utama</Text>
                          </View>
                        )}
                        {acc.isHidden && (
                          <View style={styles.hiddenBadge}>
                            <EyeOff size={10} color={colors.text.muted} />
                            <Text style={styles.hiddenBadgeText}>Tersembunyi</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.accountTypePill}>
                        <Text style={styles.accountTypeText}>{getAccountTypeName(acc.type)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions: Edit & Archive */}
                  <View style={styles.accountActions}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => {
                        hapticSelection();
                        setEditingAcc(acc);
                        setEditAccName(acc.name);
                        setEditAccType(acc.type as any);
                        setEditAccBalance(acc.initialBalance ? String(acc.initialBalance) : '');
                        setEditAccColor(acc.color || '#D4AF37');
                        setEditAccIsHidden(Boolean(acc.isHidden));
                        setEditAccIsDefault(Boolean(acc.isDefault));
                        setIsEditModalOpen(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Edit3 size={14} color={colors.text.secondary} />
                    </TouchableOpacity>
                    {!acc.isDefault && (
                      <TouchableOpacity
                        style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                        onPress={() => handleArchive(acc)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Archive size={14} color={colors.flow.expense} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Account Balance Section */}
                <View style={styles.accountBalanceRow}>
                  <View>
                    <Text style={styles.balanceLabel}>SALDO BEBAS</Text>
                    <Text style={styles.accountBalanceAmount}>
                      {isMasked ? '••••••••' : formatRupiah(availableAmount)}
                    </Text>
                  </View>
                  {Boolean(acc.reservedAmount && acc.reservedAmount > 0) && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.balanceLabel}>DI KANTONG</Text>
                      <Text style={styles.reservedAmountText}>
                        {isMasked ? '••••••' : formatRupiah(acc.reservedAmount || 0)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Account Card Bottom Actions */}
                <View style={styles.accountBottomActionRow}>
                  <TouchableOpacity
                    style={styles.accountActionBtn}
                    onPress={() => {
                      hapticMedium();
                      router.push({
                        pathname: '/transaction/new',
                        params: { presetAccountId: acc.id },
                      });
                    }}
                  >
                    <Plus size={13} color={colors.gold.champagne} />
                    <Text style={styles.accountActionText}>Catat Transaksi</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.accountActionBtn}
                    onPress={() => {
                      hapticMedium();
                      router.push({
                        pathname: '/transaction/new',
                        params: { initialType: 'transfer', presetAccountId: acc.id },
                      });
                    }}
                  >
                    <ArrowRightLeft size={13} color={colors.gold.champagne} />
                    <Text style={styles.accountActionText}>Transfer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ======================================================== */}
      {/* ADD ACCOUNT MODAL */}
      {/* ======================================================== */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsAddModalOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalTitleIconWrap}>
                  <Sparkles size={18} color={colors.gold.champagne} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Tambah Rekening</Text>
                  <Text style={styles.modalSubtext}>Daftarkan bank, dompet kas, atau e-wallet baru</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* LIVE CARD PREVIEW */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>PREVIEW KARTU</Text>
                <View style={styles.previewCard}>
                  <View style={styles.previewTopRow}>
                    <View
                      style={[
                        styles.previewIconWrap,
                        { borderColor: newAccColor, backgroundColor: 'rgba(212, 175, 55, 0.1)' },
                      ]}
                    >
                      {getAccountIcon(newAccType, newAccColor, 20)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewCardName} numberOfLines={1}>
                        {newAccName.trim() || 'Nama Rekening'}
                      </Text>
                      <View style={styles.previewBadge}>
                        <Text style={styles.previewBadgeText}>{getAccountTypeName(newAccType)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.previewBottomRow}>
                    <Text style={styles.previewBalLabel}>Saldo Awal</Text>
                    <Text style={styles.previewBalValue}>
                      {newAccBalance ? formatRupiah(parseInt(newAccBalance.replace(/\D/g, ''), 10) || 0) : 'Rp 0'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* TIPE AKUN (3 CARDS) */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>TIPE AKUN</Text>
                <View style={styles.typeCardsRow}>
                  {[
                    { type: 'bank' as const, label: 'Bank', desc: 'BCA, Mandiri, BRI', icon: Landmark },
                    { type: 'cash' as const, label: 'Tunai', desc: 'Uang fisik dompet', icon: Banknote },
                    { type: 'e_wallet' as const, label: 'E-Wallet', desc: 'GoPay, OVO, Dana', icon: Smartphone },
                  ].map((item) => {
                    const isSelected = newAccType === item.type;
                    const IconComp = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.type}
                        style={[styles.typeCard, isSelected && styles.typeCardActive]}
                        onPress={() => {
                          hapticSelection();
                          setNewAccType(item.type);
                        }}
                      >
                        <View style={[styles.typeCardIconWrap, isSelected && styles.typeCardIconWrapActive]}>
                          <IconComp
                            size={16}
                            color={isSelected ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
                          />
                        </View>
                        <Text style={[styles.typeCardTitle, isSelected && styles.typeCardTitleActive]}>
                          {item.label}
                        </Text>
                        <Text style={styles.typeCardDesc} numberOfLines={1}>
                          {item.desc}
                        </Text>
                        {isSelected && (
                          <View style={styles.typeCardCheckmark}>
                            <CheckCircle2 size={13} color={colors.gold.champagne} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* NAMA REKENING */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>NAMA REKENING / DOMPET</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={
                    newAccType === 'bank'
                      ? 'Cth: BCA Utama / Mandiri Bisnis'
                      : newAccType === 'cash'
                      ? 'Cth: Dompet Tunai / Kas Kecil'
                      : 'Cth: GoPay / OVO'
                  }
                  placeholderTextColor={colors.text.muted}
                  value={newAccName}
                  onChangeText={setNewAccName}
                />
              </View>

              {/* SALDO AWAL */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>SALDO AWAL (OPSIONAL)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Rp 0"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                  value={
                    newAccBalance
                      ? formatRupiah(parseInt(newAccBalance.replace(/\D/g, ''), 10) || 0)
                      : ''
                  }
                  onChangeText={(val) => setNewAccBalance(val.replace(/\D/g, ''))}
                />
                {/* Quick Chips */}
                <View style={styles.quickChipRow}>
                  {[100000, 500000, 1000000, 5000000].map((nom) => (
                    <TouchableOpacity
                      key={nom}
                      style={styles.quickChip}
                      onPress={() => {
                        hapticSelection();
                        setNewAccBalance(String(nom));
                      }}
                    >
                      <Text style={styles.quickChipText}>
                        +{nom >= 1000000 ? `${nom / 1000000}jt` : `${nom / 1000}rb`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* WARNA AKSEN */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>WARNA AKSEN AKUN</Text>
                <View style={styles.colorPaletteRow}>
                  {ACCOUNT_COLORS.map((c) => {
                    const isSelected = newAccColor === c.hex;
                    return (
                      <TouchableOpacity
                        key={c.hex}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c.hex },
                          isSelected && styles.colorCircleSelected,
                        ]}
                        onPress={() => {
                          hapticSelection();
                          setNewAccColor(c.hex);
                        }}
                      >
                        {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SWITCH SEMBUNYIKAN */}
              <View style={styles.switchCard}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.switchTitle}>Sembunyikan dari Dashboard</Text>
                  <Text style={styles.switchDesc}>
                    Saldo tetap dihitung di total aset, namun kartu disembunyikan dari halaman beranda.
                  </Text>
                </View>
                <Switch
                  value={newAccIsHidden}
                  onValueChange={setNewAccIsHidden}
                  trackColor={{ false: isDark ? '#2D3139' : '#E2E8F0', true: colors.gold.champagne }}
                />
              </View>
            </ScrollView>

            {/* ACTION BUTTONS (STICKY AT BOTTOM) */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  !newAccName.trim() && styles.submitBtnDisabled,
                ]}
                onPress={handleSaveNewAccount}
                disabled={!newAccName.trim()}
              >
                <Sparkles
                  size={15}
                  color={!newAccName.trim() ? colors.text.muted : (isDark ? '#090A0E' : '#FFFFFF')}
                />
                <Text
                  style={[
                    styles.submitBtnText,
                    !newAccName.trim() && styles.submitBtnTextDisabled,
                  ]}
                >
                  Simpan Rekening
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* EDIT ACCOUNT MODAL */}
      {/* ======================================================== */}
      <Modal visible={isEditModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsEditModalOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalTitleIconWrap}>
                  <Edit3 size={16} color={colors.gold.champagne} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Edit Rekening</Text>
                  <Text style={styles.modalSubtext}>{editingAcc?.name}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* LIVE CARD PREVIEW */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>PREVIEW KARTU</Text>
                <View style={styles.previewCard}>
                  <View style={styles.previewTopRow}>
                    <View
                      style={[
                        styles.previewIconWrap,
                        { borderColor: editAccColor, backgroundColor: 'rgba(212, 175, 55, 0.1)' },
                      ]}
                    >
                      {getAccountIcon(editAccType, editAccColor, 20)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewCardName} numberOfLines={1}>
                        {editAccName.trim() || 'Nama Rekening'}
                      </Text>
                      <View style={styles.previewBadge}>
                        <Text style={styles.previewBadgeText}>{getAccountTypeName(editAccType)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.previewBottomRow}>
                    <Text style={styles.previewBalLabel}>Saldo Saat Ini</Text>
                    <Text style={styles.previewBalValue}>
                      {formatRupiah(editingAcc?.currentBalance || 0)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* TIPE AKUN */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>TIPE AKUN</Text>
                <View style={styles.typeCardsRow}>
                  {[
                    { type: 'bank' as const, label: 'Bank', desc: 'BCA, Mandiri, BRI', icon: Landmark },
                    { type: 'cash' as const, label: 'Tunai', desc: 'Uang fisik dompet', icon: Banknote },
                    { type: 'e_wallet' as const, label: 'E-Wallet', desc: 'GoPay, OVO, Dana', icon: Smartphone },
                  ].map((item) => {
                    const isSelected = editAccType === item.type;
                    const IconComp = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.type}
                        style={[styles.typeCard, isSelected && styles.typeCardActive]}
                        onPress={() => {
                          hapticSelection();
                          setEditAccType(item.type);
                        }}
                      >
                        <View style={[styles.typeCardIconWrap, isSelected && styles.typeCardIconWrapActive]}>
                          <IconComp
                            size={16}
                            color={isSelected ? (isDark ? '#090A0E' : '#FFFFFF') : colors.gold.champagne}
                          />
                        </View>
                        <Text style={[styles.typeCardTitle, isSelected && styles.typeCardTitleActive]}>
                          {item.label}
                        </Text>
                        <Text style={styles.typeCardDesc} numberOfLines={1}>
                          {item.desc}
                        </Text>
                        {isSelected && (
                          <View style={styles.typeCardCheckmark}>
                            <CheckCircle2 size={13} color={colors.gold.champagne} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* NAMA REKENING */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>NAMA REKENING</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nama Akun"
                  placeholderTextColor={colors.text.muted}
                  value={editAccName}
                  onChangeText={setEditAccName}
                />
              </View>

              {/* SALDO AWAL DASAR */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>SALDO AWAL DASAR</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Rp 0"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                  value={
                    editAccBalance
                      ? formatRupiah(parseInt(editAccBalance.replace(/\D/g, ''), 10) || 0)
                      : ''
                  }
                  onChangeText={(val) => setEditAccBalance(val.replace(/\D/g, ''))}
                />
              </View>

              {/* WARNA AKSEN */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>WARNA AKSEN AKUN</Text>
                <View style={styles.colorPaletteRow}>
                  {ACCOUNT_COLORS.map((c) => {
                    const isSelected = editAccColor === c.hex;
                    return (
                      <TouchableOpacity
                        key={c.hex}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c.hex },
                          isSelected && styles.colorCircleSelected,
                        ]}
                        onPress={() => {
                          hapticSelection();
                          setEditAccColor(c.hex);
                        }}
                      >
                        {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SWITCH SEMBUNYIKAN */}
              <View style={styles.switchCard}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.switchTitle}>Sembunyikan dari Dashboard</Text>
                  <Text style={styles.switchDesc}>
                    Saldo tetap dihitung di total aset, namun kartu disembunyikan dari halaman beranda.
                  </Text>
                </View>
                <Switch
                  value={editAccIsHidden}
                  onValueChange={setEditAccIsHidden}
                  trackColor={{ false: isDark ? '#2D3139' : '#E2E8F0', true: colors.gold.champagne }}
                />
              </View>

              {/* SWITCH JADIKAN UTAMA */}
              {editingAcc && !editingAcc.isDefault && (
                <View style={styles.switchCard}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.switchTitle}>Jadikan Rekening Utama</Text>
                    <Text style={styles.switchDesc}>
                      Pilihan awal akun yang otomatis terpilih saat mencatat transaksi baru.
                    </Text>
                  </View>
                  <Switch
                    value={editAccIsDefault}
                    onValueChange={setEditAccIsDefault}
                    trackColor={{ false: isDark ? '#2D3139' : '#E2E8F0', true: colors.gold.champagne }}
                  />
                </View>
              )}
            </ScrollView>

            {/* ACTION BUTTONS (STICKY AT BOTTOM) */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  !editAccName.trim() && styles.submitBtnDisabled,
                ]}
                onPress={handleSaveEditAccount}
                disabled={!editAccName.trim()}
              >
                <Sparkles
                  size={15}
                  color={!editAccName.trim() ? colors.text.muted : (isDark ? '#090A0E' : '#FFFFFF')}
                />
                <Text
                  style={[
                    styles.submitBtnText,
                    !editAccName.trim() && styles.submitBtnTextDisabled,
                  ]}
                >
                  Perbarui Rekening
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bg.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    headerTitleWrap: {
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text.primary,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 10,
      color: colors.text.muted,
      marginTop: 1,
    },
    headerAddBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.gold.champagne,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.gold.champagne,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      paddingBottom: 40,
    },

    // ==========================================
    // HERO CARD (OBSIDIAN & CHAMPAGNE GOLD)
    // ==========================================
    heroCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.25)',
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 10,
      elevation: 4,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    heroBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.gold.champagne,
      letterSpacing: 0.8,
    },
    heroCountPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    heroCountText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text.muted,
    },
    heroBalanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    heroBalanceText: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.gold.champagne,
      letterSpacing: -0.5,
      flex: 1,
    },
    heroEyeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    },
    heroDivider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(0, 0, 0, 0.06)',
      marginVertical: 14,
    },
    heroSplitRow: {
      flexDirection: 'row',
      gap: 12,
    },
    heroSplitCol: {
      flex: 1,
    },
    heroColHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 3,
    },
    heroColLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text.muted,
    },
    heroColValuePositive: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.flow.income,
    },
    heroColValueGold: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.gold.champagne,
    },

    // ==========================================
    // QUICK TRANSFER ACTION CARD
    // ==========================================
    quickTransferCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.22)',
      marginBottom: 16,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 2,
    },
    quickTransferIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    quickTransferTextWrap: {
      flex: 1,
    },
    quickTransferTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text.primary,
    },
    quickTransferDesc: {
      fontSize: 11,
      color: colors.text.muted,
      marginTop: 2,
    },

    // ==========================================
    // FILTER TABS
    // ==========================================
    filterTabsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    filterTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: colors.bg.surface,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    filterTabActive: {
      backgroundColor: colors.gold.champagne,
      borderColor: colors.gold.champagne,
    },
    filterTabText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.muted,
    },
    filterTabTextActive: {
      color: isDark ? '#090A0E' : '#FFFFFF',
    },

    // ==========================================
    // SECTION HEADER
    // ==========================================
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text.muted,
      letterSpacing: 0.8,
    },
    linkText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.gold.champagne,
    },

    // ==========================================
    // ACCOUNT CARD (LUXURY BANK CARD REDESIGN)
    // ==========================================
    accountCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    accountTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    accountLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    accountIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    accountName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text.primary,
    },
    defaultBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(212, 175, 55, 0.15)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    defaultBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.gold.champagne,
    },
    hiddenBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    hiddenBadgeText: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.text.muted,
    },
    accountTypePill: {
      alignSelf: 'flex-start',
      marginTop: 3,
    },
    accountTypeText: {
      fontSize: 11,
      color: colors.text.muted,
      fontWeight: '600',
    },
    accountActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    actionIconBtnDanger: {
      borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    accountBalanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
    },
    balanceLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 0.6,
      marginBottom: 3,
    },
    accountBalanceAmount: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.text.primary,
      letterSpacing: -0.4,
    },
    reservedAmountText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.gold.champagne,
    },
    accountBottomActionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
    },
    accountActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    accountActionText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold.champagne,
    },

    // ==========================================
    // EMPTY STATE
    // ==========================================
    emptyCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: 20,
      padding: 30,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.subtle,
      marginTop: 8,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text.primary,
      marginBottom: 6,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 12,
      color: colors.text.muted,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 18,
    },
    emptyActionBtn: {
      backgroundColor: colors.gold.champagne,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyActionBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: isDark ? '#090A0E' : '#FFFFFF',
    },

    // ==========================================
    // MODAL STYLING (MATCHING POCKETS STANDARD)
    // ==========================================
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.bg.base,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: Platform.OS === 'ios' ? 28 : 18,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      height: '92%',
      maxHeight: '92%',
      display: 'flex',
      flexDirection: 'column',
    },
    modalDragHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      alignSelf: 'center',
      marginBottom: 14,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    modalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modalTitleIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text.primary,
    },
    modalSubtext: {
      fontSize: 11,
      color: colors.text.muted,
      marginTop: 1,
    },
    modalScrollView: {
      flex: 1,
    },
    modalScrollContent: {
      paddingBottom: 24,
    },
    modalSection: {
      marginTop: 14,
    },
    modalSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 0.8,
      marginBottom: 6,
    },

    // Preview Card inside Modal
    previewCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
    previewTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    previewIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewCardName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text.primary,
    },
    previewBadge: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(212, 175, 55, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 4,
    },
    previewBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.gold.champagne,
    },
    previewBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
    },
    previewBalLabel: {
      fontSize: 10,
      color: colors.text.muted,
      fontWeight: '600',
    },
    previewBalValue: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.gold.champagne,
    },

    // 3 Type Cards in Modal
    typeCardsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    typeCard: {
      flex: 1,
      backgroundColor: colors.bg.surface,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      alignItems: 'center',
      position: 'relative',
    },
    typeCardActive: {
      borderColor: colors.gold.champagne,
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    typeCardIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    typeCardIconWrapActive: {
      backgroundColor: colors.gold.champagne,
    },
    typeCardTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text.primary,
    },
    typeCardTitleActive: {
      color: colors.gold.champagne,
    },
    typeCardDesc: {
      fontSize: 9,
      color: colors.text.muted,
      marginTop: 2,
      textAlign: 'center',
    },
    typeCardCheckmark: {
      position: 'absolute',
      top: 5,
      right: 5,
    },

    // Inputs
    modalInput: {
      backgroundColor: colors.bg.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text.primary,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    quickChipRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
    },
    quickChip: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    quickChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold.champagne,
    },

    // Color Swatches
    colorPaletteRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.bg.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    colorCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorCircleSelected: {
      borderWidth: 3,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
      transform: [{ scale: 1.1 }],
    },

    // Switch Card
    switchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bg.surface,
      borderRadius: 14,
      padding: 14,
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    switchTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.primary,
    },
    switchDesc: {
      fontSize: 11,
      color: colors.text.muted,
      marginTop: 2,
      lineHeight: 16,
    },

    // Footer Buttons
    modalBtnRow: {
      flexDirection: 'row',
      gap: 10,
      paddingTop: 12,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.bg.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.muted,
    },
    submitBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.gold.champagne,
    },
    submitBtnDisabled: {
      backgroundColor: colors.bg.surface,
      opacity: 0.6,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    submitBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: isDark ? '#090A0E' : '#FFFFFF',
    },
    submitBtnTextDisabled: {
      color: colors.text.muted,
    },
  });
