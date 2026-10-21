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
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Landmark,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  HelpCircle,
  UploadCloud,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Trash2,
  Link2,
} from 'lucide-react-native';
import {
  formatRupiah,
  type BankConnectionModel,
  type BankMutationModel,
  type AccountModel,
  type TransactionModel,
} from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import {
  getLocalAccounts,
  getLocalBankConnections,
  insertLocalBankConnection,
  deleteLocalBankConnection,
  getLocalBankMutations,
  importLocalBankStatement,
  reconcileLocalBankMutation,
  getLocalTransactions,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

export default function BankSyncScreen() {
  const router = useRouter();
  const toast = useToast();

  const [connections, setConnections] = useState<BankConnectionModel[]>([]);
  const [mutations, setMutations] = useState<BankMutationModel[]>([]);
  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [activeMutationForMatch, setActiveMutationForMatch] = useState<BankMutationModel | null>(null);
  const [candidateTransactions, setCandidateTransactions] = useState<TransactionModel[]>([]);
  const [selectedMatchedTxId, setSelectedMatchedTxId] = useState<string>('');

  // New Connection Form
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [institutionCode, setInstitutionCode] = useState('BCA');
  const [accountNumberInput, setAccountNumberInput] = useState('');

  // Import Statement Form
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [statementCsvInput, setStatementCsvInput] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [conns, muts, accs] = await Promise.all([
        getLocalBankConnections(),
        getLocalBankMutations(),
        getLocalAccounts(),
      ]);

      setConnections(conns);
      setMutations(muts);
      setAccounts(accs);

      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
      if (conns.length > 0 && !selectedConnectionId) {
        setSelectedConnectionId(conns[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  }, [selectedAccountId, selectedConnectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const pendingMutations = mutations.filter((m) => m.reconciliationStatus === 'pending');
  const verifiedMutations = mutations.filter((m) => m.reconciliationStatus === 'matched' || m.reconciliationStatus === 'created_as_new');

  const handleCreateConnection = async () => {
    if (!selectedAccountId) {
      toast.showWarning('Perhatian', 'Pilih akun UangKu yang ditautkan.');
      return;
    }
    const masked = accountNumberInput.trim()
      ? `•••• ${accountNumberInput.trim().slice(-4)}`
      : '•••• 1234';

    try {
      hapticMedium();
      await insertLocalBankConnection({
        accountId: selectedAccountId,
        provider: 'statement_import',
        institutionCode: institutionCode.toUpperCase(),
        maskedAccountNumber: masked,
      });

      toast.showSuccess('Koneksi Dibuat', `Rekening ${institutionCode} berhasil ditautkan`);
      setIsConnectModalOpen(false);
      setAccountNumberInput('');
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Menautkan', err.message);
    }
  };

  const handleImportSampleStatement = () => {
    const sample = `Tanggal,Keterangan,Nominal,Tipe\n2026-10-21,QRIS INDOMARET JAKARTA,48500,DB\n2026-10-21,TRSF GAJI BULANAN,12500000,CR\n2026-10-21,TAGIHAN PLN LISTRIK,350000,DB\n2026-10-20,KOPI KENANGAN GRAND INDO,28000,DB`;
    setStatementCsvInput(sample);
  };

  const handleExecuteImport = async () => {
    if (!selectedConnectionId) {
      toast.showWarning('Perhatian', 'Pilih koneksi bank tujuan impor.');
      return;
    }
    if (!statementCsvInput.trim()) {
      toast.showWarning('Perhatian', 'Teks mutasi rekening tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      const res = await importLocalBankStatement(selectedConnectionId, statementCsvInput.trim());
      toast.showSuccess(
        'Impor Berhasil',
        `${res.importedCount} mutasi masuk (${res.autoMatchedCount} cocok otomatis)`
      );
      setIsImportModalOpen(false);
      setStatementCsvInput('');
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Mengimpor', err.message);
    }
  };

  const handleReconcile = async (mutationId: string, action: 'match' | 'create_new' | 'ignore') => {
    try {
      hapticMedium();
      if (action === 'create_new') {
        await reconcileLocalBankMutation(mutationId, 'create_new');
        toast.showSuccess('Tercatat Sebagai Transaksi Baru', 'Transaksi masuk ke buku kas');
      } else if (action === 'ignore') {
        await reconcileLocalBankMutation(mutationId, 'ignore');
        toast.showSuccess('Mutasi Diabaikan', 'Tidak dicatat ke kas');
      }
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal', err.message);
    }
  };

  const handleOpenMatchModal = async (mutation: BankMutationModel) => {
    setActiveMutationForMatch(mutation);
    setSelectedMatchedTxId('');
    try {
      const allTxs = await getLocalTransactions();
      const targetType = mutation.type === 'debit' ? 'expense' : 'income';
      const candidates = allTxs.filter((t) => t.type === targetType);
      candidates.sort((a, b) => {
        const aExact = a.amount === mutation.amount ? 1 : 0;
        const bExact = b.amount === mutation.amount ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
      });
      setCandidateTransactions(candidates.slice(0, 15));
      if (candidates.length > 0 && candidates[0].amount === mutation.amount) {
        setSelectedMatchedTxId(candidates[0].id);
      }
      setIsMatchModalOpen(true);
    } catch (err: any) {
      toast.showError('Gagal Memuat Transaksi', err.message);
    }
  };

  const handleConfirmMatch = async () => {
    if (!activeMutationForMatch || !selectedMatchedTxId) {
      toast.showWarning('Perhatian', 'Pilih transaksi yang ingin dicocokkan.');
      return;
    }
    try {
      hapticSuccess();
      await reconcileLocalBankMutation(activeMutationForMatch.id, 'match', selectedMatchedTxId);
      toast.showSuccess('Berhasil Dicocokkan', 'Status transaksi kini terverifikasi mutasi bank.');
      setIsMatchModalOpen(false);
      setActiveMutationForMatch(null);
      await loadData();
    } catch (err: any) {
      toast.showError('Gagal Mencocokkan', err.message);
    }
  };

  const handleDeleteConnection = (connection: BankConnectionModel) => {
    Alert.alert(
      'Putus Koneksi Bank',
      `Apakah Anda yakin ingin menghapus rekening ${connection.institutionCode} ${connection.maskedAccountNumber || ''}? Seluruh riwayat mutasi terkait akan dihapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Putus Koneksi',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await deleteLocalBankConnection(connection.id);
              toast.showSuccess('Koneksi Dihapus', `${connection.institutionCode} berhasil diputus`);
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.gold.champagne} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Integrasi Bank & Mutasi</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setIsConnectModalOpen(true);
          }}
        >
          <Plus size={20} color="#090A0E" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold.champagne} />}
      >
        {/* Banner Zero-Credential Security */}
        <View style={styles.securityBanner}>
          <ShieldCheck size={20} color={colors.gold.champagne} />
          <View style={styles.securityTextCol}>
            <Text style={styles.securityTitle}>Privasi & Keamanan Tingkat Tinggi</Text>
            <Text style={styles.securityDesc}>
              UangKu mengadopsi prinsip Zero-Credential: tidak pernah menyimpan PIN ATM atau kata sandi perbankanmu.
            </Text>
          </View>
        </View>

        {/* Bank Connections List */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionLabel}>REKENING PERBANKAN TERHUBUNG ({connections.length})</Text>
          <TouchableOpacity onPress={() => setIsConnectModalOpen(true)}>
            <Text style={styles.linkText}>+ Tautkan Bank</Text>
          </TouchableOpacity>
        </View>

        {connections.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🏦</Text>
            <Text style={styles.emptyTitle}>Belum Ada Rekening Bank Ditautkan</Text>
            <Text style={styles.emptySubtitle}>
              Tautkan akun bank untuk mengimpor e-statement atau menyinkronkan mutasi pembayaran QRIS secara otomatis.
            </Text>
          </View>
        ) : (
          connections.map((c) => (
            <View key={c.id} style={styles.connectionCard}>
              <View style={styles.connIconWrap}>
                <Landmark size={20} color={colors.gold.champagne} />
              </View>
              <View style={styles.connInfo}>
                <Text style={styles.connBank}>{c.institutionCode} {c.maskedAccountNumber}</Text>
                <Text style={styles.connAccountName}>{c.accountName || 'Rekening UangKu'}</Text>
              </View>
              <View style={styles.connActionsRow}>
                <TouchableOpacity
                  style={styles.importBtn}
                  onPress={() => {
                    hapticSelection();
                    setSelectedConnectionId(c.id);
                    setIsImportModalOpen(true);
                  }}
                >
                  <FileSpreadsheet size={13} color={colors.gold.champagne} />
                  <Text style={styles.importBtnText}>Impor CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.disconnectBtn}
                  onPress={() => handleDeleteConnection(c)}
                >
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Smart Reconciliation Inbox */}
        <View style={[styles.listHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionLabel}>INBOX REKONSILIASI ({pendingMutations.length})</Text>
          {connections.length > 0 && (
            <TouchableOpacity onPress={() => setIsImportModalOpen(true)}>
              <Text style={styles.linkText}>+ Unggah Mutasi</Text>
            </TouchableOpacity>
          )}
        </View>

        {pendingMutations.length === 0 ? (
          <View style={styles.reconcileCleanCard}>
            <CheckCircle2 size={24} color={colors.flow.income} />
            <Text style={styles.reconcileCleanTitle}>Semua Mutasi Sudah Terverifikasi</Text>
            <Text style={styles.reconcileCleanSub}>Tidak ada mutasi gantung atau selisih pencatatan.</Text>
          </View>
        ) : (
          pendingMutations.map((m) => (
            <View key={m.id} style={styles.mutationCard}>
              <View style={styles.mutationTopRow}>
                <View style={styles.mutationBadgeCol}>
                  <Text style={[styles.mutationTypeTag, m.type === 'debit' ? styles.debitTag : styles.creditTag]}>
                    {m.type === 'debit' ? 'PENGELUARAN' : 'PEMASUKAN'}
                  </Text>
                  <Text style={styles.mutationDesc}>{m.description}</Text>
                </View>
                <Text style={[styles.mutationAmount, m.type === 'debit' ? styles.debitText : styles.creditText]}>
                  {m.type === 'debit' ? '- ' : '+ '}{formatRupiah(m.amount)}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.mutationActionsRow}>
                <TouchableOpacity
                  style={[styles.reconcileBtn, styles.matchBtn]}
                  onPress={() => handleOpenMatchModal(m)}
                >
                  <Link2 size={12} color={colors.gold.champagne} />
                  <Text style={styles.matchBtnText}>Tautkan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.reconcileBtn, styles.createBtn]}
                  onPress={() => handleReconcile(m.id, 'create_new')}
                >
                  <CheckCircle2 size={12} color="#090A0E" />
                  <Text style={styles.createBtnText}>Catat Baru</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.reconcileBtn, styles.ignoreBtn]}
                  onPress={() => handleReconcile(m.id, 'ignore')}
                >
                  <XCircle size={12} color={colors.text.muted} />
                  <Text style={styles.ignoreBtnText}>Abaikan</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Verified Bank History */}
        {verifiedMutations.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>MUTASI TERVERIFIKASI ({verifiedMutations.length})</Text>
            {verifiedMutations.slice(0, 10).map((vm) => (
              <View key={vm.id} style={styles.verifiedCard}>
                <View style={styles.verifiedHeaderRow}>
                  <CheckCircle2 size={14} color={colors.flow.income} />
                  <Text style={styles.verifiedDesc}>{vm.description}</Text>
                  <Text style={styles.verifiedAmount}>{formatRupiah(vm.amount)}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* MODAL: Tautkan Bank Baru */}
      <Modal visible={isConnectModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>🏦 Tautkan Rekening Bank</Text>
            <Text style={styles.modalSubtitle}>Pilih akun UangKu yang akan ditautkan dengan mutasi bank.</Text>

            <Text style={styles.modalLabel}>PILIH AKUN UANGKU</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              {accounts.map((acc) => {
                const isSelected = selectedAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountTab, isSelected && styles.accountTabActive]}
                    onPress={() => setSelectedAccountId(acc.id)}
                  >
                    <Text style={[styles.accountTabText, isSelected && styles.accountTabTextActive]}>{acc.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>INSTITUSI BANK / E-WALLET</Text>
            <View style={styles.typeSelectorRow}>
              {['BCA', 'MANDIRI', 'BRI', 'GOPAY'].map((inst) => (
                <TouchableOpacity
                  key={inst}
                  style={[styles.typeBtn, institutionCode === inst && styles.typeBtnSelected]}
                  onPress={() => setInstitutionCode(inst)}
                >
                  <Text style={[styles.typeBtnText, institutionCode === inst && styles.typeBtnTextSelected]}>{inst}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>NOMOR REKENING (4 DIGIT TERAKHIR)</Text>
            <TextInput
              style={styles.textInput}
              value={accountNumberInput}
              onChangeText={setAccountNumberInput}
              placeholder="Cth: 4892"
              placeholderTextColor={colors.text.muted}
              keyboardType="numeric"
              maxLength={4}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsConnectModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateConnection}
              >
                <Text style={styles.submitBtnText}>Tautkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Impor e-Statement CSV */}
      <Modal visible={isImportModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>📄 Impor Mutasi Rekening</Text>
              <TouchableOpacity onPress={handleImportSampleStatement}>
                <Text style={styles.sampleLinkText}>+ Contoh CSV</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Tempelkan baris CSV rekening koran m-banking.</Text>

            <Text style={styles.modalLabel}>REKENING TUJUAN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiList}>
              {connections.map((c) => {
                const isSelected = selectedConnectionId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.accountTab, isSelected && styles.accountTabActive]}
                    onPress={() => setSelectedConnectionId(c.id)}
                  >
                    <Text style={[styles.accountTabText, isSelected && styles.accountTabTextActive]}>
                      {c.institutionCode} {c.maskedAccountNumber}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>TEKS CSV MUTASI</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={statementCsvInput}
              onChangeText={setStatementCsvInput}
              placeholder={`Tanggal,Keterangan,Nominal,Tipe\n2026-10-21,QRIS INDOMARET,48500,DB`}
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={6}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsImportModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleExecuteImport}
              >
                <Text style={styles.submitBtnText}>Proses Impor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Tautkan Mutasi ke Transaksi Manual (Smart Reconciliation) */}
      <Modal visible={isMatchModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>🔗 Tautkan ke Transaksi Manual</Text>
            <Text style={styles.modalSubtitle}>
              Pilih transaksi yang sesuai untuk mutasi: {activeMutationForMatch?.description} ({activeMutationForMatch ? formatRupiah(activeMutationForMatch.amount) : ''})
            </Text>

            <Text style={styles.modalLabel}>PILIH TRANSAKSI KANDIDAT</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {candidateTransactions.length === 0 ? (
                <Text style={styles.noCandidateText}>Tidak ada transaksi kandidat yang sesuai.</Text>
              ) : (
                candidateTransactions.map((tx) => {
                  const isSelected = selectedMatchedTxId === tx.id;
                  const isExactAmount = tx.amount === activeMutationForMatch?.amount;
                  return (
                    <TouchableOpacity
                      key={tx.id}
                      style={[styles.candidateCard, isSelected && styles.candidateCardSelected]}
                      onPress={() => {
                        hapticSelection();
                        setSelectedMatchedTxId(tx.id);
                      }}
                    >
                      <View style={styles.candidateLeft}>
                        <Text style={styles.candidateNote}>{tx.category?.name || tx.note || 'Transaksi'}</Text>
                        <Text style={styles.candidateDate}>
                          {new Date(tx.transactionDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {tx.account?.name || 'Akun'}
                        </Text>
                      </View>
                      <View style={styles.candidateRight}>
                        <Text style={[styles.candidateAmount, isExactAmount && styles.candidateAmountExact]}>
                          {formatRupiah(tx.amount)}
                        </Text>
                        {isExactAmount && (
                          <View style={styles.matchTag}>
                            <Text style={styles.matchTagText}>Sesuai</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setIsMatchModalOpen(false);
                  setActiveMutationForMatch(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, !selectedMatchedTxId && { opacity: 0.5 }]}
                disabled={!selectedMatchedTxId}
                onPress={handleConfirmMatch}
              >
                <Text style={styles.submitBtnText}>Tautkan Mutasi</Text>
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
    paddingHorizontal: 20,
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
    padding: 20,
    paddingBottom: 40,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    marginBottom: 20,
  },
  securityTextCol: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  securityDesc: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 1,
  },
  linkText: {
    fontSize: 12,
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 10,
  },
  connIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  connInfo: {
    flex: 1,
  },
  connBank: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  connAccountName: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  importBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  connActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  disconnectBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  reconcileCleanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  reconcileCleanTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.flow.income,
  },
  reconcileCleanSub: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  mutationCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 10,
  },
  mutationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mutationBadgeCol: {
    flex: 1,
    marginRight: 12,
  },
  mutationTypeTag: {
    alignSelf: 'flex-start',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  debitTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
  },
  creditTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: colors.flow.income,
  },
  mutationDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mutationAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  debitText: {
    color: '#EF4444',
  },
  creditText: {
    color: colors.flow.income,
  },
  mutationActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  reconcileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  matchBtn: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  matchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  candidateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#161925',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  candidateCardSelected: {
    borderColor: colors.gold.champagne,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  candidateLeft: {
    flex: 1,
  },
  candidateRight: {
    alignItems: 'flex-end',
  },
  candidateNote: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  candidateDate: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  candidateAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  candidateAmountExact: {
    color: colors.gold.champagne,
    fontWeight: '800',
  },
  matchTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  matchTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.flow.income,
  },
  noCandidateText: {
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 13,
  },
  createBtn: {
    backgroundColor: colors.gold.champagne,
  },
  createBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#090A0E',
  },
  ignoreBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  ignoreBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
  },
  verifiedCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  verifiedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedDesc: {
    flex: 1,
    fontSize: 12,
    color: colors.text.muted,
  },
  verifiedAmount: {
    fontSize: 12,
    fontWeight: '700',
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
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sampleLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold.champagne,
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
    gap: 8,
    marginBottom: 10,
  },
  accountTab: {
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
  textArea: {
    height: 120,
    textAlignVertical: 'top',
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
