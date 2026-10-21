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
} from 'lucide-react-native';
import { formatRupiah, type AccountModel } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import {
  getLocalAccounts,
  insertLocalAccount,
  updateLocalAccount,
  archiveLocalAccount,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticLight } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

export default function AccountsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Add Account Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'bank' | 'cash' | 'e_wallet'>('bank');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccReserved, setNewAccReserved] = useState('');

  // Edit Account Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<AccountModel | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccType, setEditAccType] = useState<'bank' | 'cash' | 'e_wallet'>('bank');
  const [editAccBalance, setEditAccBalance] = useState('');
  const [editAccReserved, setEditAccReserved] = useState('');

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
  const availableNetWorth = totalNetWorth - totalReserved;

  const handleSaveNewAccount = async () => {
    if (!newAccName.trim()) {
      toast.showWarning('Perhatian', 'Nama dompet atau rekening tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      const numBal = parseInt(newAccBalance.replace(/\D/g, ''), 10) || 0;
      const numRes = parseInt(newAccReserved.replace(/\D/g, ''), 10) || 0;
      await insertLocalAccount({
        name: newAccName.trim(),
        type: newAccType,
        initialBalance: numBal,
        reservedAmount: numRes,
      });

      const savedName = newAccName.trim();
      setNewAccName('');
      setNewAccBalance('');
      setNewAccReserved('');
      setNewAccType('bank');
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
      const numRes = parseInt(editAccReserved.replace(/\D/g, ''), 10) || 0;
      await updateLocalAccount(editingAcc.id, {
        name: editAccName.trim(),
        type: editAccType,
        initialBalance: numBal,
        reservedAmount: numRes,
      });

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

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Landmark size={20} color={colors.gold.champagne} />;
      case 'cash': return <Banknote size={20} color={colors.gold.champagne} />;
      case 'e_wallet': return <Smartphone size={20} color={colors.gold.champagne} />;
      default: return <Wallet size={20} color={colors.gold.champagne} />;
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
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dompet & Rekening</Text>
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
        {/* Net Worth Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Kekayaan Bersih</Text>
          <Text style={styles.summaryBalance}>{formatRupiah(totalNetWorth)}</Text>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.subColLabel}>Saldo Tersedia</Text>
              <Text style={styles.subColValue}>{formatRupiah(availableNetWorth)}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.subColLabel}>Terkunci (Target)</Text>
              <Text style={[styles.subColValue, { color: colors.gold.champagne }]}>
                {formatRupiah(totalReserved)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Action: Transfer Antar Akun */}
        <TouchableOpacity
          style={styles.quickTransferCard}
          activeOpacity={0.8}
          onPress={() => {
            hapticMedium();
            router.push({ pathname: '/transaction/new', params: { initialType: 'transfer' } });
          }}
        >
          <View style={styles.transferIconBg}>
            <ArrowRightLeft size={16} color={colors.flow.transfer} />
          </View>
          <View style={styles.transferTextWrap}>
            <Text style={styles.transferTitle}>Transfer Antar Rekening</Text>
            <Text style={styles.transferDesc}>Pindahkan saldo antar dompet tanpa merubah arus kas</Text>
          </View>
          <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>

        {/* Accounts List Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daftar Rekening ({accounts.length})</Text>
        </View>

        {accounts.map((acc) => (
          <View key={acc.id} style={styles.accountCard}>
            <View style={styles.accountTopRow}>
              <View style={styles.accountLeft}>
                <View style={styles.accountIconCircle}>{getAccountIcon(acc.type)}</View>
                <View>
                  <View style={styles.accountNameRow}>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    {acc.isDefault && (
                      <View style={styles.defaultBadge}>
                        <ShieldCheck size={10} color={colors.gold.champagne} />
                        <Text style={styles.defaultBadgeText}>Utama</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.accountType}>{getAccountTypeName(acc.type)}</Text>
                </View>
              </View>

              <View style={styles.accountActions}>
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => {
                    hapticSelection();
                    setEditingAcc(acc);
                    setEditAccName(acc.name);
                    setEditAccType(acc.type as any);
                    setEditAccBalance(String(acc.initialBalance || 0));
                    setEditAccReserved(String(acc.reservedAmount || 0));
                    setIsEditModalOpen(true);
                  }}
                >
                  <Edit3 size={15} color={colors.text.secondary} />
                </TouchableOpacity>
                {!acc.isDefault && (
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => handleArchive(acc)}
                  >
                    <Archive size={15} color={colors.flow.expense} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.accountBottomRow}>
              <View>
                <Text style={styles.balanceLabel}>Saldo Saat Ini</Text>
                <Text style={styles.accountBalanceText}>{formatRupiah(acc.currentBalance || 0)}</Text>
              </View>
              {Boolean(acc.reservedAmount && acc.reservedAmount > 0) && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.balanceLabel}>Tersedia</Text>
                  <Text style={styles.availableBalanceText}>
                    {formatRupiah(Math.max(0, (acc.currentBalance || 0) - (acc.reservedAmount || 0)))}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Rekening Baru</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nama Rekening / Dompet</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: BCA Prioritas, Tunai Dompet"
              placeholderTextColor={colors.text.muted}
              value={newAccName}
              onChangeText={setNewAccName}
            />

            <Text style={styles.inputLabel}>Tipe Akun</Text>
            <View style={styles.typeSelectorRow}>
              {(['bank', 'cash', 'e_wallet'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, newAccType === t && styles.typeBtnActive]}
                  onPress={() => {
                    hapticSelection();
                    setNewAccType(t);
                  }}
                >
                  <Text style={[styles.typeBtnText, newAccType === t && styles.typeBtnTextActive]}>
                    {getAccountTypeName(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Saldo Awal</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
              value={newAccBalance ? `Rp ${parseInt(newAccBalance, 10).toLocaleString('id-ID')}` : ''}
              onChangeText={(val) => setNewAccBalance(val.replace(/\D/g, ''))}
            />

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveNewAccount}>
              <Text style={styles.saveSubmitText}>Simpan Rekening</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Account Modal */}
      <Modal visible={isEditModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Rekening</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nama Rekening</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Nama Akun"
              placeholderTextColor={colors.text.muted}
              value={editAccName}
              onChangeText={setEditAccName}
            />

            <Text style={styles.inputLabel}>Tipe Akun</Text>
            <View style={styles.typeSelectorRow}>
              {(['bank', 'cash', 'e_wallet'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, editAccType === t && styles.typeBtnActive]}
                  onPress={() => {
                    hapticSelection();
                    setEditAccType(t);
                  }}
                >
                  <Text style={[styles.typeBtnText, editAccType === t && styles.typeBtnTextActive]}>
                    {getAccountTypeName(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Saldo Awal Dasar</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Rp 0"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
              value={editAccBalance ? `Rp ${parseInt(editAccBalance, 10).toLocaleString('id-ID')}` : ''}
              onChangeText={(val) => setEditAccBalance(val.replace(/\D/g, ''))}
            />

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveEditAccount}>
              <Text style={styles.saveSubmitText}>Perbarui Rekening</Text>
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
  summaryCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.muted,
    marginBottom: 6,
  },
  summaryBalance: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.gold.light,
    letterSpacing: -0.5,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
  },
  subColLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 3,
  },
  subColValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  quickTransferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginBottom: 20,
    gap: 12,
  },
  transferIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferTextWrap: {
    flex: 1,
  },
  transferTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  transferDesc: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
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
  accountCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  accountTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  accountType: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
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
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  balanceLabel: {
    fontSize: 10,
    color: colors.text.muted,
    marginBottom: 2,
  },
  accountBalanceText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  availableBalanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold.champagne,
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
    marginBottom: 18,
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
    marginTop: 12,
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
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  typeBtnActive: {
    borderColor: colors.gold.primary,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  typeBtnText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
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
