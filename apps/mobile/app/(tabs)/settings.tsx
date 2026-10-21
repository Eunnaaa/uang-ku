import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import {
  User,
  ShieldCheck,
  FileSpreadsheet,
  Trash2,
  ChevronRight,
  Sparkles,
  Smartphone,
  Info,
  Landmark,
  Banknote,
  Wallet,
  Plus,
  X,
  Check,
  LogOut,
  Layers,
  RefreshCw,
  FileUp,
  Edit3,
  Repeat,
  Bell,
  Play,
  Calendar,
  Bookmark,
  Receipt,
  KeyRound,
  Target,
  PieChart,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { NotificationService } from '../../src/services/notificationService';

const BIOMETRIC_PREF_KEY = 'uangku_biometric_enabled';
import {
  formatRupiah,
  generateTransactionsCsv,
  type AccountModel,
  type CategoryModel,
  type RecurringRuleModel,
  type RecurringFrequency,
  type TemplateModel,
} from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import { SyncEngine } from '../../src/sync/syncEngine';
import {
  getLocalTransactions,
  getDb,
  getLocalAccounts,
  insertLocalAccount,
  updateLocalAccount,
  archiveLocalAccount,
  getLocalCategories,
  insertLocalCategory,
  updateLocalCategory,
  archiveLocalCategory,
  importTransactionsFromCsv,
  getLocalRecurringRules,
  insertLocalRecurringRule,
  toggleLocalRecurringRule,
  deleteLocalRecurringRule,
  executeRecurringRule,
  clearAllLocalTransactions,
  getLocalTemplates,
  deleteLocalTemplate,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticLight, hapticSuccess, hapticError } from '../../src/theme/haptics';
import { useAuth } from '../../src/auth/authContext';
import { AuthModal } from '../../src/components/AuthModal';
import { WelcomeFlow } from '../../src/components/WelcomeFlow';
import { useToast } from '../../src/components/Toast';

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, logout, deleteAccount, isGuest } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [faceIdEnabled, setFaceIdEnabled] = useState(true);
  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'bank' | 'cash' | 'e_wallet'>('bank');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccReserved, setNewAccReserved] = useState('');

  // Account editing (PRD Section 73 & Section 75)
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountModel | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccType, setEditAccType] = useState<'bank' | 'cash' | 'e_wallet'>('bank');
  const [editAccBalance, setEditAccBalance] = useState('');
  const [editAccReserved, setEditAccReserved] = useState('');

  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [activeCatFilter, setActiveCatFilter] = useState<'expense' | 'income'>('expense');

  // Category editing
  const [isEditCatOpen, setIsEditCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryModel | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // Recurring Rules (PRD Section 58)
  const [recurringRules, setRecurringRules] = useState<RecurringRuleModel[]>([]);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [newRuleType, setNewRuleType] = useState<'expense' | 'income'>('expense');
  const [newRuleAmount, setNewRuleAmount] = useState('');
  const [newRuleFrequency, setNewRuleFrequency] = useState<RecurringFrequency>('monthly');
  const [newRuleAccountId, setNewRuleAccountId] = useState('');
  const [newRuleCategoryId, setNewRuleCategoryId] = useState<string | null>(null);
  const [newRuleNote, setNewRuleNote] = useState('');

  // Transaction Templates (PRD Section 59)
  const [templates, setTemplates] = useState<TemplateModel[]>([]);

  // Notifications & Reminders (PRD Section 62)
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [billReminderEnabled, setBillReminderEnabled] = useState(true);

  // CSV Import (PRD Section 71)
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [csvInputText, setCsvInputText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const db = await getDb();
      const [list, pending] = await Promise.all([
        getLocalAccounts(),
        db.getFirstAsync<{ count: number }>(`SELECT count(*) as count FROM mutation_outbox WHERE status = 'pending';`),
      ]);
      setAccounts(list);
      setPendingSyncCount(pending?.count || 0);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleManualSync = async () => {
    hapticMedium();
    try {
      const res = await SyncEngine.syncAll();
      const db = await getDb();
      const pending = await db.getFirstAsync<{ count: number }>(
        `SELECT count(*) as count FROM mutation_outbox WHERE status = 'pending';`
      );
      setPendingSyncCount(pending?.count || 0);

      if (res.pushed > 0 || res.pulled > 0) {
        toast.showSuccess('Sinkronisasi Sukses', `${res.pushed} terkirim, ${res.pulled} data terbaru ditarik.`);
      } else {
        toast.showInfo('Sinkronisasi Lengkap', 'Seluruh transaksi telah sinkron sempurna dengan server.');
      }
    } catch {
      toast.showWarning('Mode Offline', 'Koneksi ke server terputus. Data tetap tersimpan aman di SQLite lokal.');
    }
  };

  const loadCategories = useCallback(async () => {
    try {
      const list = await getLocalCategories();
      setCategories(list);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadRecurringRules = useCallback(async () => {
    try {
      const list = await getLocalRecurringRules();
      setRecurringRules(list);
    } catch (err) {
      console.error('Failed to load recurring rules:', err);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const list = await getLocalTemplates();
      setTemplates(list);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadCategories();
    loadRecurringRules();
    loadTemplates();

    SecureStore.getItemAsync(BIOMETRIC_PREF_KEY).then((val) => {
      if (val !== null) setFaceIdEnabled(val === '1');
    }).catch(() => {});
  }, [loadAccounts, loadCategories, loadRecurringRules, loadTemplates]);

  const handleToggleFaceId = async (enable: boolean) => {
    if (enable) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Biometrik Tidak Tersedia', 'Perangkat ini belum mengatur Face ID atau Touch ID.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verifikasi Face ID untuk mengaktifkan kunci aplikasi',
        cancelLabel: 'Batal',
      });
      if (result.success) {
        hapticSuccess();
        setFaceIdEnabled(true);
        await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, '1').catch(() => {});
        Alert.alert('Face ID Aktif', 'Kunci biometrik berhasil diaktifkan untuk keamanan data finansialmu.');
      } else {
        hapticLight();
      }
    } else {
      hapticSelection();
      setFaceIdEnabled(false);
      await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, '0').catch(() => {});
    }
  };

  const handleToggleDailyReminder = async (enable: boolean) => {
    if (enable) {
      hapticSelection();
      const scheduled = await NotificationService.scheduleDailyReminder(20, 0);
      if (scheduled) {
        hapticSuccess();
        setDailyReminderEnabled(true);
        Alert.alert('Pengingat Aktif 🔔', 'Pengingat harian dijadwalkan setiap pukul 20:00 WIB.');
      } else {
        hapticError();
        Alert.alert('Izin Notifikasi Ditolak', 'Aktifkan izin notifikasi di Pengaturan HP untuk menerima pengingat harian.');
      }
    } else {
      hapticSelection();
      await NotificationService.cancelDailyReminder();
      setDailyReminderEnabled(false);
    }
  };

  const handleToggleBillReminder = async (enable: boolean) => {
    hapticSelection();
    if (enable) {
      const hasPerm = await NotificationService.requestPermissions();
      if (hasPerm) {
        setBillReminderEnabled(true);
      } else {
        Alert.alert('Izin Notifikasi', 'Aktifkan izin notifikasi di Pengaturan HP agar UangKu dapat mengingatkan tanggal tagihan.');
      }
    } else {
      setBillReminderEnabled(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!newAccName.trim()) {
      toast.showWarning('Perhatian', 'Nama dompet atau rekening tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      const numericBalance = parseInt(newAccBalance.replace(/\D/g, ''), 10) || 0;
      const numericReserved = parseInt(newAccReserved.replace(/\D/g, ''), 10) || 0;
      await insertLocalAccount({
        name: newAccName.trim(),
        type: newAccType,
        initialBalance: numericBalance,
        reservedAmount: numericReserved,
      });

      const accName = newAccName.trim();
      setNewAccName('');
      setNewAccBalance('');
      setNewAccReserved('');
      setNewAccType('bank');
      setIsAddAccountOpen(false);
      toast.showSuccess('Rekening Ditambahkan', accName);
      await loadAccounts();
    } catch (err: any) {
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  const handleArchive = (acc: AccountModel) => {
    if (acc.isDefault) {
      toast.showWarning('Akun Utama', 'Akun default utama tidak dapat diarsipkan.');
      return;
    }

    Alert.alert(
      'Arsipkan Akun',
      `Yakin ingin mengarsipkan "${acc.name}"? Akun ini tidak akan muncul di form transaksi baru, namun historinya tetap aman.`,
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
              await loadAccounts();
            } catch (err: any) {
              toast.showError('Gagal Mengarsipkan', err.message);
            }
          },
        },
      ]
    );
  };

  const handleAccountPress = (acc: AccountModel) => {
    hapticSelection();
    Alert.alert(
      acc.name,
      'Pilih tindakan untuk akun ini:',
      [
        {
          text: 'Edit Akun',
          onPress: () => {
            setEditingAccount(acc);
            setEditAccName(acc.name);
            setEditAccType(acc.type as any);
            setEditAccBalance(acc.initialBalance ? String(acc.initialBalance) : '0');
            setEditAccReserved(acc.reservedAmount ? String(acc.reservedAmount) : '0');
            setIsEditAccountOpen(true);
          },
        },
        ...(!acc.isDefault
          ? [
              {
                text: 'Arsipkan Akun',
                style: 'destructive' as const,
                onPress: () => handleArchive(acc),
              },
            ]
          : []),
        { text: 'Batal', style: 'cancel' },
      ]
    );
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount) return;
    if (!editAccName.trim()) {
      toast.showWarning('Perhatian', 'Nama dompet atau rekening tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      const numericBalance = parseInt(editAccBalance.replace(/\D/g, ''), 10) || 0;
      const numericReserved = parseInt(editAccReserved.replace(/\D/g, ''), 10) || 0;
      await updateLocalAccount(editingAccount.id, {
        name: editAccName.trim(),
        type: editAccType,
        initialBalance: numericBalance,
        reservedAmount: numericReserved,
      });

      const updatedName = editAccName.trim();
      setIsEditAccountOpen(false);
      setEditingAccount(null);
      toast.showSuccess('Rekening Diperbarui', updatedName);
      await loadAccounts();
    } catch (err: any) {
      toast.showError('Gagal Memperbarui', err.message);
    }
  };

  const handleToggleRule = async (id: string, current: boolean) => {
    hapticSelection();
    try {
      await toggleLocalRecurringRule(id, !current);
      await loadRecurringRules();
    } catch (err: any) {
      Alert.alert('Gagal Mengubah Status', err.message);
    }
  };

  const handleExecuteRule = (rule: RecurringRuleModel) => {
    hapticMedium();
    Alert.alert(
      'Catat Sekarang?',
      `Konfirmasi pencatatan transaksi untuk "${rule.note || rule.categoryName || 'Transaksi Berulang'}" sebesar ${formatRupiah(rule.amount)}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Catat Transaksi',
          onPress: async () => {
            try {
              await executeRecurringRule(rule.id);
              await Promise.all([loadAccounts(), loadRecurringRules()]);
              toast.showSuccess('Transaksi Berulang Dicatat', `${formatRupiah(rule.amount)} berhasil dibukukan.`);
            } catch (err: any) {
              toast.showError('Gagal Mencatat', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteRule = (rule: RecurringRuleModel) => {
    hapticLight();
    Alert.alert(
      'Hapus Jadwal Berulang',
      `Yakin ingin menghapus jadwal "${rule.note || rule.categoryName || 'Transaksi'}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticLight();
              await deleteLocalRecurringRule(rule.id);
              await loadRecurringRules();
              toast.showSuccess('Jadwal Dihapus', rule.note || rule.categoryName || 'Transaksi Berulang');
            } catch (err: any) {
              toast.showError('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteTemplate = (tpl: TemplateModel) => {
    hapticLight();
    Alert.alert(
      'Hapus Template Favorit',
      `Yakin ingin menghapus template "${tpl.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticLight();
              await deleteLocalTemplate(tpl.id);
              await loadTemplates();
              toast.showSuccess('Template Dihapus', tpl.name);
            } catch (err: any) {
              toast.showError('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleSaveNewRule = async () => {
    const numericAmount = parseInt(newRuleAmount.replace(/\D/g, ''), 10) || 0;
    if (numericAmount <= 0) {
      toast.showWarning('Perhatian', 'Masukkan nominal transaksi yang valid.');
      return;
    }
    const accId = newRuleAccountId || (accounts.length > 0 ? accounts[0].id : '');
    if (!accId) {
      toast.showWarning('Perhatian', 'Pilih dompet atau rekening.');
      return;
    }

    try {
      hapticMedium();
      await insertLocalRecurringRule({
        accountId: accId,
        categoryId: newRuleCategoryId || null,
        type: newRuleType,
        amount: numericAmount,
        frequency: newRuleFrequency,
        note: newRuleNote.trim() || null,
      });

      setIsAddRuleOpen(false);
      setNewRuleAmount('');
      setNewRuleNote('');
      setNewRuleFrequency('monthly');
      await loadRecurringRules();
      toast.showSuccess('Jadwal Berulang Disimpan', `${formatRupiah(numericAmount)} (${newRuleFrequency})`);
    } catch (err: any) {
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  const handleCategoryPress = (cat: CategoryModel) => {
    hapticSelection();
    if (cat.isSystem) {
      Alert.alert('Kategori Sistem', `"${cat.name}" adalah kategori default sistem yang dilindungi.`);
      return;
    }

    Alert.alert(
      cat.name,
      'Pilih tindakan untuk kategori ini:',
      [
        {
          text: 'Edit Nama Kategori',
          onPress: () => {
            setEditingCat(cat);
            setEditCatName(cat.name);
            setIsEditCatOpen(true);
          },
        },
        {
          text: 'Arsipkan Kategori',
          style: 'destructive' as const,
          onPress: () => handleArchiveCategory(cat),
        },
        { text: 'Batal', style: 'cancel' },
      ]
    );
  };

  const handleUpdateCategory = async () => {
    if (!editingCat) return;
    if (!editCatName.trim()) {
      hapticError();
      Alert.alert('Perhatian', 'Nama kategori tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      await updateLocalCategory(editingCat.id, {
        name: editCatName.trim(),
      });

      hapticSuccess();
      setIsEditCatOpen(false);
      setEditingCat(null);
      await loadCategories();
    } catch (err: any) {
      Alert.alert('Gagal Memperbarui', err.message);
    }
  };

  const handleImportCsv = async () => {
    if (!csvInputText.trim()) {
      hapticError();
      Alert.alert('Perhatian', 'Tempel teks atau pilih contoh data CSV terlebih dahulu.');
      return;
    }

    try {
      setIsImporting(true);
      hapticMedium();
      const res = await importTransactionsFromCsv(csvInputText);
      setIsImporting(false);

      if (res.success > 0) {
        hapticSuccess();
        setIsImportCsvOpen(false);
        setCsvInputText('');
        await loadAccounts();
        Alert.alert(
          'Impor Berhasil 🎉',
          `Sebanyak ${res.success} transaksi berhasil diimpor ke basis data lokal.${res.failed > 0 ? ` (${res.failed} baris dilewati karena format tidak valid)` : ''}`
        );
      } else {
        hapticError();
        Alert.alert('Gagal Mengimpor', 'Tidak ada baris data valid yang dapat diimpor. Pastikan format berisi Tanggal dan Nominal.');
      }
    } catch (err: any) {
      setIsImporting(false);
      Alert.alert('Kesalahan Impor', err.message);
    }
  };

  const handleLoadCsvSample = () => {
    hapticSelection();
    setCsvInputText(
      `Tanggal,Nominal,Tipe,Kategori,Catatan\n` +
      `2026-10-01,15000000,Pemasukan,Gaji Utama,Gaji Bulanan Oktober\n` +
      `2026-10-02,50000,Pengeluaran,Makanan & Minuman,Makan Siang Soto\n` +
      `2026-10-03,25000,Pengeluaran,Transportasi,Bensin Motor\n` +
      `2026-10-04,150000,Pengeluaran,Belanja & Kebutuhan,Belanja Bulanan Supermarket`
    );
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) {
      toast.showWarning('Perhatian', 'Nama kategori tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      await insertLocalCategory({
        name: newCatName.trim(),
        type: newCatType,
      });

      const catName = newCatName.trim();
      setNewCatName('');
      setNewCatType('expense');
      setIsAddCatOpen(false);
      toast.showSuccess('Kategori Ditambahkan', catName);
      await loadCategories();
    } catch (err: any) {
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  const handleArchiveCategory = (cat: CategoryModel) => {
    if (cat.isSystem) {
      Alert.alert('Kategori Sistem', 'Kategori bawaan sistem tidak dapat diarsipkan.');
      return;
    }

    Alert.alert(
      'Arsipkan Kategori',
      `Yakin ingin mengarsipkan kategori "${cat.name}"? Transaksi lama tetap tersimpan, namun kategori ini tidak akan muncul di input baru.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Arsipkan',
          style: 'destructive',
          onPress: async () => {
            hapticLight();
            await archiveLocalCategory(cat.id);
            await loadCategories();
          },
        },
      ]
    );
  };

  const getAccountIcon = (type: string) => {
    const size = 16;
    const color = colors.gold.champagne;
    switch (type) {
      case 'bank': return <Landmark size={size} color={color} />;
      case 'cash': return <Banknote size={size} color={color} />;
      case 'e_wallet': return <Smartphone size={size} color={color} />;
      default: return <Wallet size={size} color={color} />;
    }
  };

  const handleExportCsv = async () => {
    hapticMedium();
    try {
      const txs = await getLocalTransactions();
      if (txs.length === 0) {
        Alert.alert('Ekspor CSV', 'Belum ada transaksi untuk diekspor.');
        return;
      }

      // Generate UTF-8 BOM CSV according to PRD Section 12.3 with OWASP sanitization
      const csvContent = generateTransactionsCsv(txs);
      const fileUri = `${FileSystem.cacheDirectory}UangKu_Export_${new Date().toISOString().slice(0, 10)}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Ekspor Data Transaksi UangKu',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Sukses', `Berkas tersimpan di: ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Gagal Ekspor', err.message);
    }
  };

  const handleResetData = () => {
    hapticLight();
    Alert.alert(
      'Reset Data ke Nol (Testing)',
      'Semua transaksi lokal, alokasi goals, dan aturan berulang akan dihapus bersih (saldo akun kembali Rp 0). Kategori sistem tetap dipertahankan. Yakin ingin mereset?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset ke Nol',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticSuccess();
              await clearAllLocalTransactions();
              await Promise.all([loadAccounts(), loadCategories(), loadRecurringRules()]);
              Alert.alert('Data Bersih 🎉', 'Semua data transaksi telah direset ke nol. Anda dapat mulai testing dari awal.');
            } catch (err: any) {
              hapticError();
              Alert.alert('Gagal Reset', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    hapticLight();
    Alert.alert(
      'Hapus Akun & Semua Data',
      'Tindakan ini permanen dan tidak dapat dibatalkan sesuai pedoman privasi Apple App Store. Seluruh transaksi dan saldo lokalmu akan dimusnahkan. Yakin ingin melanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Permanen',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteAccount();
            if (ok) {
              Alert.alert('Akun Dihapus', 'Seluruh data lokal dan cloud telah dibersihkan secara tuntas.');
              await loadAccounts();
              setIsAuthModalOpen(true);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    hapticLight();
    const db = await getDb();
    const pending = await db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM mutation_outbox WHERE status = 'pending';`
    );
    const pendingCount = pending?.count || 0;

    const performLogout = async () => {
      hapticSuccess();
      await logout();
      Alert.alert('Berhasil Keluar', 'Sesi login telah diakhiri.');
      setIsAuthModalOpen(true);
    };

    if (pendingCount > 0) {
      Alert.alert(
        'Transaksi Belum Tersinkron',
        `Terdapat ${pendingCount} mutasi transaksi yang belum tersimpan ke server. Jika kamu keluar sekarang, data lokal tersebut mungkin belum tercatat di server. Yakin ingin keluar?`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Tetap Keluar', style: 'destructive', onPress: performLogout },
        ]
      );
    } else {
      Alert.alert(
        'Konfirmasi Keluar',
        'Yakin ingin keluar dari akun UangKu?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Keluar', style: 'destructive', onPress: performLogout },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pengaturan</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.8}
          onPress={() => {
            hapticSelection();
            setIsAuthModalOpen(true);
          }}
        >
          <View style={styles.avatar}>
            <User size={24} color={colors.gold.champagne} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.displayName || 'Tamu UangKu'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'Mode Tamu (Offline)'}</Text>
            <View style={styles.vipPill}>
              <Sparkles size={10} color={colors.gold.primary} />
              <Text style={styles.vipText}>{isGuest ? 'GUEST USER' : 'PREMIUM MEMBER'}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.text.muted} />
        </TouchableOpacity>

        {/* Accounts / Wallets Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>DOMPET & REKENING AKTIF</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={styles.addAccountHeaderBtn}
              onPress={() => {
                hapticSelection();
                router.push('/accounts');
              }}
            >
              <Text style={styles.addAccountHeaderText}>Kelola Penuh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addAccountHeaderBtn}
              onPress={() => {
                hapticSelection();
                setIsAddAccountOpen(true);
              }}
            >
              <Plus size={13} color={colors.gold.champagne} />
              <Text style={styles.addAccountHeaderText}>Tambah</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuGroup}>
          {accounts.map((acc, index) => (
            <TouchableOpacity
              key={acc.id}
              activeOpacity={0.7}
              onPress={() => handleAccountPress(acc)}
              style={[styles.accountRow, index > 0 && styles.accountRowBorder]}
            >
              <View style={styles.accountRowLeft}>
                <View style={styles.accountIconCircle}>
                  {getAccountIcon(acc.type)}
                </View>
                <View>
                  <View style={styles.accountNameRow}>
                    <Text style={styles.accountNameText}>{acc.name}</Text>
                    {acc.isDefault && (
                      <View style={styles.defaultPill}>
                        <Text style={styles.defaultPillText}>Utama</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.accountSubText}>
                    {acc.type === 'bank' ? 'Rekening Bank' : acc.type === 'cash' ? 'Uang Tunai' : 'Dompet Digital'} • Ketuk untuk edit
                  </Text>
                </View>
              </View>
              <View style={styles.accountBalanceCol}>
                <Text style={styles.accountBalanceText}>
                  {formatRupiah(acc.currentBalance || 0)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category Management Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>KATEGORI TRANSAKSI</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={styles.addAccountHeaderBtn}
              onPress={() => {
                hapticSelection();
                router.push('/categories');
              }}
            >
              <Text style={styles.addAccountHeaderText}>Kelola Penuh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addAccountHeaderBtn}
              onPress={() => {
                hapticSelection();
                setIsAddCatOpen(true);
              }}
            >
              <Plus size={13} color={colors.gold.champagne} />
              <Text style={styles.addAccountHeaderText}>Tambah</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Type Filter Tabs */}
        <View style={styles.catSegmentRow}>
          <TouchableOpacity
            style={[styles.catSegmentBtn, activeCatFilter === 'expense' && styles.catSegmentBtnActive]}
            onPress={() => {
              hapticSelection();
              setActiveCatFilter('expense');
            }}
          >
            <Text style={[styles.catSegmentText, activeCatFilter === 'expense' && styles.catSegmentTextActive]}>
              Pengeluaran ({categories.filter((c) => c.type === 'expense').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.catSegmentBtn, activeCatFilter === 'income' && styles.catSegmentBtnActive]}
            onPress={() => {
              hapticSelection();
              setActiveCatFilter('income');
            }}
          >
            <Text style={[styles.catSegmentText, activeCatFilter === 'income' && styles.catSegmentTextActive]}>
              Pemasukan ({categories.filter((c) => c.type === 'income').length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuGroup}>
          {categories
            .filter((c) => c.type === activeCatFilter)
            .map((cat, index) => (
              <TouchableOpacity
                key={cat.id}
                activeOpacity={0.7}
                onPress={() => handleCategoryPress(cat)}
                style={[styles.accountRow, index > 0 && styles.accountRowBorder]}
              >
                <View style={styles.accountRowLeft}>
                  <View style={styles.categoryIconCircle}>
                    <Layers size={14} color={activeCatFilter === 'income' ? colors.flow.income : colors.gold.champagne} />
                  </View>
                  <View>
                    <Text style={styles.accountNameText}>{cat.name}</Text>
                    <Text style={styles.accountSubText}>
                      {cat.isSystem ? 'Kategori Bawaan Sistem' : 'Kategori Kustom • Ketuk untuk opsi'}
                    </Text>
                  </View>
                </View>
                {cat.isSystem ? (
                  <View style={styles.systemPill}>
                    <Text style={styles.systemPillText}>Sistem</Text>
                  </View>
                ) : (
                  <View style={styles.customPill}>
                    <Text style={styles.customPillText}>Kustom</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
        </View>

        {/* Recurring Rules Section (PRD Section 58) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>TRANSAKSI BERULANG (JADWAL)</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={styles.addAccountHeaderBtn}
              onPress={() => {
                hapticSelection();
                router.push('/recurring');
              }}
            >
              <Text style={styles.addAccountHeaderText}>Kelola Penuh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addAccountHeaderBtn}
              onPress={() => {
                hapticSelection();
                setIsAddRuleOpen(true);
              }}
            >
              <Plus size={13} color={colors.gold.champagne} />
              <Text style={styles.addAccountHeaderText}>Tambah</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuGroup}>
          {recurringRules.length === 0 ? (
            <View style={styles.emptyRuleContainer}>
              <Repeat size={20} color={colors.text.muted} />
              <Text style={styles.emptyRuleText}>Belum ada jadwal transaksi berulang aktif.</Text>
            </View>
          ) : (
            recurringRules.map((rule, index) => {
              const isIncome = rule.type === 'income';
              const freqLabel =
                rule.frequency === 'daily'
                  ? 'Harian'
                  : rule.frequency === 'weekly'
                  ? 'Mingguan'
                  : rule.frequency === 'biweekly'
                  ? '2 Mingguan'
                  : rule.frequency === 'monthly'
                  ? 'Bulanan'
                  : 'Tahunan';

              return (
                <View
                  key={rule.id}
                  style={[styles.ruleCard, index > 0 && styles.accountRowBorder]}
                >
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
                        <Repeat
                          size={14}
                          color={isIncome ? colors.flow.income : colors.flow.expense}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitleText} numberOfLines={1}>
                          {rule.note || rule.categoryName || 'Transaksi Berulang'}
                        </Text>
                        <Text style={styles.ruleSubtitleText}>
                          {rule.accountName || 'Rekening'} • {freqLabel} • Tempo: {rule.nextDueDate || 'Hari ini'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.ruleRightCol}>
                      <Text
                        style={[
                          styles.ruleAmountText,
                          { color: isIncome ? colors.flow.income : colors.text.primary },
                        ]}
                      >
                        {isIncome ? '+' : '-'}{formatRupiah(rule.amount)}
                      </Text>
                      <Switch
                        value={rule.isActive}
                        onValueChange={() => handleToggleRule(rule.id, rule.isActive)}
                        trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
                        thumbColor={colors.text.primary}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                    </View>
                  </View>

                  <View style={styles.ruleBottomRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.ruleExecuteBtn}
                      onPress={() => handleExecuteRule(rule)}
                    >
                      <Play size={11} color="#090A0E" fill="#090A0E" />
                      <Text style={styles.ruleExecuteText}>Catat Sekarang</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.ruleDeleteBtn}
                      onPress={() => handleDeleteRule(rule)}
                    >
                      <Trash2 size={13} color={colors.flow.expense} />
                      <Text style={styles.ruleDeleteText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 1-Tap Transaction Templates Section (PRD Section 59) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>TEMPLATE TRANSAKSI (1-TAP FAVORIT)</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{templates.length} Tersimpan</Text>
          </View>
        </View>

        <View style={styles.menuGroup}>
          {templates.length === 0 ? (
            <View style={styles.emptyRuleContainer}>
              <Bookmark size={20} color={colors.text.muted} />
              <Text style={styles.emptyRuleText}>
                Belum ada template favorit tersimpan. Simpan template 1-tap dari formulir transaksi baru.
              </Text>
            </View>
          ) : (
            templates.map((tpl, index) => {
              const isExpense = tpl.templatePayload.type === 'expense';
              const isIncome = tpl.templatePayload.type === 'income';
              const typeLabel = isExpense ? 'Pengeluaran' : isIncome ? 'Pemasukan' : 'Transfer';
              return (
                <View
                  key={tpl.id}
                  style={[styles.templateCard, index > 0 && styles.accountRowBorder]}
                >
                  <View style={styles.templateCardLeft}>
                    <View style={styles.templateIconCircle}>
                      <Bookmark size={14} color={colors.gold.champagne} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ruleTitleText} numberOfLines={1}>
                        {tpl.name}
                      </Text>
                      <Text style={styles.ruleSubtitleText} numberOfLines={1}>
                        {typeLabel} • Digunakan {tpl.useCount}x{tpl.templatePayload.note ? ` • "${tpl.templatePayload.note}"` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.templateCardRight}>
                    {tpl.templatePayload.amount ? (
                      <Text
                        style={[
                          styles.ruleAmountText,
                          { color: isIncome ? colors.flow.income : colors.text.primary },
                        ]}
                      >
                        {isIncome ? '+' : '-'}{formatRupiah(tpl.templatePayload.amount)}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.ruleDeleteBtn}
                      onPress={() => handleDeleteTemplate(tpl)}
                    >
                      <Trash2 size={12} color={colors.flow.expense} />
                      <Text style={styles.ruleDeleteText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Notifications & Smart Reminders Section (PRD Section 62) */}
        <Text style={styles.sectionTitle}>NOTIFIKASI & PENGINGAT PINTAR</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Bell size={18} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Pengingat Catat Transaksi</Text>
                <Text style={styles.menuSublabel}>Notifikasi harian pukul 20:00 WIB agar pembukuan disiplin</Text>
              </View>
            </View>
            <Switch
              value={dailyReminderEnabled}
              onValueChange={handleToggleDailyReminder}
              trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
              thumbColor={colors.text.primary}
            />
          </View>

          <View style={[styles.menuItem, styles.menuItemBorder]}>
            <View style={styles.menuLeft}>
              <Calendar size={18} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Pengingat Tagihan & Berulang</Text>
                <Text style={styles.menuSublabel}>Notifikasi saat tanggal jatuh tempo langganan tiba</Text>
              </View>
            </View>
            <Switch
              value={billReminderEnabled}
              onValueChange={handleToggleBillReminder}
              trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
              thumbColor={colors.text.primary}
            />
          </View>
        </View>

        {/* Security Section */}
        <Text style={styles.sectionTitle}>KEAMANAN & PRIVASI</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/security');
            }}
          >
            <View style={styles.menuLeft}>
              <KeyRound size={20} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Pusat Keamanan & PIN</Text>
                <Text style={styles.menuSublabel}>Ubah PIN 6-digit, privasi saldo, & status enkripsi</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={[styles.menuItem, styles.menuItemBorder]}>
            <View style={styles.menuLeft}>
              <ShieldCheck size={20} color={colors.gold.champagne} />
              <Text style={styles.menuLabel}>Kunci Aplikasi (Face ID)</Text>
            </View>
            <Switch
              value={faceIdEnabled}
              onValueChange={handleToggleFaceId}
              trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
              thumbColor={colors.text.primary}
            />
          </View>
        </View>

        {/* Tools & Utilities */}
        <Text style={styles.sectionTitle}>ALAT & FITUR KEUANGAN</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/split-bill');
            }}
          >
            <View style={styles.menuLeft}>
              <Receipt size={19} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Kalkulator Split Bill</Text>
                <Text style={styles.menuSublabel}>Bagi tagihan resto presisi minor-unit & kirim ke WhatsApp</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/budgets');
            }}
          >
            <View style={styles.menuLeft}>
              <PieChart size={19} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Anggaran Fleksibel (Budgets)</Text>
                <Text style={styles.menuSublabel}>Batas amplop belanja per kategori per bulan</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/goals');
            }}
          >
            <View style={styles.menuLeft}>
              <Target size={19} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Target Keuangan (Goals)</Text>
                <Text style={styles.menuSublabel}>Tabungan impian & penguncian alokasi saldo</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/pockets');
            }}
          >
            <View style={styles.menuLeft}>
              <Layers size={19} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Kantong Keuangan (Pockets)</Text>
                <Text style={styles.menuSublabel}>Envelope budgeting alokasi belanja & proteksi terkunci</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/bank-sync');
            }}
          >
            <View style={styles.menuLeft}>
              <Landmark size={19} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Integrasi Bank & Mutasi</Text>
                <Text style={styles.menuSublabel}>Impor e-statement & rekonsiliasi cerdas anti-duplikasi</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Data & Backup */}
        <Text style={styles.sectionTitle}>DATA & CADANGAN</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleExportCsv}>
            <View style={styles.menuLeft}>
              <FileSpreadsheet size={20} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Ekspor Histori (CSV)</Text>
                <Text style={styles.menuSublabel}>Kompatibel Excel & Google Sheets (UTF-8 BOM)</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              setIsImportCsvOpen(true);
            }}
          >
            <View style={styles.menuLeft}>
              <FileUp size={20} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Impor Transaksi (CSV)</Text>
                <Text style={styles.menuSublabel}>Migrasi data transaksi dari aplikasi lain</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={handleManualSync}
          >
            <View style={styles.menuLeft}>
              <RefreshCw size={19} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Sinkronisasi Cloud Outbox</Text>
                <Text style={styles.menuSublabel}>
                  {pendingSyncCount > 0
                    ? `${pendingSyncCount} mutasi menunggu sinkronisasi`
                    : 'Semua mutasi telah tersinkron'}
                </Text>
              </View>
            </View>
            <View style={[styles.activePill, pendingSyncCount > 0 && { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <Text style={[styles.activePillText, pendingSyncCount > 0 && { color: colors.gold.champagne }]}>
                {pendingSyncCount > 0 ? `${pendingSyncCount} Pending` : 'Sinkron'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* About & Compliance */}
        <Text style={styles.sectionTitle}>TENTANG APLIKASI & PRIVASI</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Info size={18} color={colors.gold.champagne} />
              <Text style={styles.menuLabel}>Versi Aplikasi</Text>
            </View>
            <Text style={styles.menuValue}>1.0.0 (Build 1 - Ready)</Text>
          </View>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              setIsOnboardingOpen(true);
            }}
          >
            <View style={styles.menuLeft}>
              <Sparkles size={18} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Panduan Aplikasi (Tour)</Text>
                <Text style={styles.menuSublabel}>Pengenalan fitur dan alur navigasi UangKu</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => setIsPrivacyModalOpen(true)}
          >
            <View style={styles.menuLeft}>
              <ShieldCheck size={18} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Kebijakan Privasi & Ketentuan</Text>
                <Text style={styles.menuSublabel}>Standar Apple App Store Guideline 5.1</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={[styles.menuItem, styles.menuItemBorder]}>
            <View style={styles.menuLeft}>
              <Smartphone size={18} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Penyimpanan Lokal</Text>
                <Text style={styles.menuSublabel}>SQLite Engine (WAL Mode Aktif)</Text>
              </View>
            </View>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Aktif</Text>
            </View>
          </View>
        </View>

        {/* Session & Danger Zone */}
        <Text style={[styles.sectionTitle, { color: colors.flow.expense }]}>SESI & KEAMANAN AKUN</Text>
        <View style={[styles.menuGroup, { borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleLogout}>
            <View style={styles.menuLeft}>
              <LogOut size={19} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Keluar dari Akun</Text>
                <Text style={styles.menuSublabel}>Akhiri sesi login perangkat ini</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={handleResetData}
          >
            <View style={styles.menuLeft}>
              <RefreshCw size={19} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Reset Data ke Nol (Testing)</Text>
                <Text style={styles.menuSublabel}>Hapus seluruh histori transaksi & mulai dari awal</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={handleDeleteAccount}
          >
            <View style={styles.menuLeft}>
              <Trash2 size={19} color={colors.flow.expense} />
              <View>
                <Text style={[styles.menuLabel, { color: colors.flow.expense }]}>Hapus Akun & Semua Data</Text>
                <Text style={styles.menuSublabel}>Kepatuhan Apple App Store Guideline 5.1.1</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.flow.expense} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={isAddAccountOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsAddAccountOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Dompet / Rekening</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddAccountOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAMA AKUN / DOMPET</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Rekening BCA, GoPay, Dompet Tunai"
                placeholderTextColor={colors.text.muted}
                value={newAccName}
                onChangeText={setNewAccName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TIPE AKUN</Text>
              <View style={styles.typeRow}>
                {(['bank', 'cash', 'e_wallet'] as const).map((t) => {
                  const isActive = newAccType === t;
                  const label = t === 'bank' ? 'Bank' : t === 'cash' ? 'Tunai' : 'E-Wallet';
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, isActive && styles.typeBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setNewAccType(t);
                      }}
                    >
                      <Text style={[styles.typeBtnText, isActive && styles.typeBtnTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SALDO AWAL (OPSIONAL)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rp 0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={newAccBalance}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, '');
                  setNewAccBalance(num ? `Rp ${parseInt(num, 10).toLocaleString('id-ID')}` : '');
                }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DANA DISISIHKAN / MENGENDAP (RP)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rp 0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={newAccReserved ? `Rp ${parseInt(newAccReserved.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')}` : ''}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, '');
                  setNewAccReserved(num);
                }}
              />
              <Text style={styles.inputHelperText}>
                Dana yang disisihkan tidak dihitung sebagai Saldo Tersedia untuk belanja (PRD 75).
              </Text>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAccount}>
              <Text style={styles.saveBtnText}>Simpan Dompet / Rekening</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={isAddCatOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Kategori Baru</Text>
              <TouchableOpacity onPress={() => setIsAddCatOpen(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAMA KATEGORI</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Belanja Online, Hobi, Donasi"
                placeholderTextColor={colors.text.muted}
                value={newCatName}
                onChangeText={setNewCatName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TIPE TRANSAKSI</Text>
              <View style={styles.typeRow}>
                {(['expense', 'income'] as const).map((t) => {
                  const isActive = newCatType === t;
                  const label = t === 'expense' ? 'Pengeluaran' : 'Pemasukan';
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, isActive && styles.typeBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setNewCatType(t);
                      }}
                    >
                      <Text style={[styles.typeBtnText, isActive && styles.typeBtnTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCategory}>
              <Text style={styles.saveBtnText}>Simpan Kategori</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Account Modal (PRD Section 73) */}
      <Modal visible={isEditAccountOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsEditAccountOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Dompet & Rekening</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditAccountOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAMA DOMPET / REKENING</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: BCA Prioritas, Jenius, Kas Kecil"
                placeholderTextColor={colors.text.muted}
                value={editAccName}
                onChangeText={setEditAccName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TIPE REKENING</Text>
              <View style={styles.typeRow}>
                {(['bank', 'cash', 'e_wallet'] as const).map((t) => {
                  const isActive = editAccType === t;
                  const label = t === 'bank' ? 'Bank' : t === 'cash' ? 'Tunai' : 'E-Wallet';
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, isActive && styles.typeBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setEditAccType(t);
                      }}
                    >
                      <Text style={[styles.typeBtnText, isActive && styles.typeBtnTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SALDO AWAL (RP)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rp 0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={editAccBalance ? `Rp ${parseInt(editAccBalance.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')}` : ''}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, '');
                  setEditAccBalance(num);
                }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DANA DISISIHKAN / MENGENDAP (RP)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rp 0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={editAccReserved ? `Rp ${parseInt(editAccReserved.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')}` : ''}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, '');
                  setEditAccReserved(num);
                }}
              />
              <Text style={styles.inputHelperText}>
                Dana yang disisihkan tidak dihitung sebagai Saldo Tersedia untuk belanja (PRD 75).
              </Text>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateAccount}>
              <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Category Modal */}
      <Modal visible={isEditCatOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsEditCatOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Nama Kategori</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditCatOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAMA KATEGORI</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Nama kategori"
                placeholderTextColor={colors.text.muted}
                value={editCatName}
                onChangeText={setEditCatName}
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateCategory}>
              <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Recurring Rule Modal (PRD Section 58) */}
      <Modal visible={isAddRuleOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsAddRuleOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Repeat size={20} color={colors.gold.champagne} />
                <Text style={styles.modalTitle}>Tambah Transaksi Berulang</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddRuleOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TIPE TRANSAKSI</Text>
              <View style={styles.typeRow}>
                {(['expense', 'income'] as const).map((t) => {
                  const isActive = newRuleType === t;
                  const label = t === 'expense' ? 'Pengeluaran' : 'Pemasukan';
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, isActive && styles.typeBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setNewRuleType(t);
                      }}
                    >
                      <Text style={[styles.typeBtnText, isActive && styles.typeBtnTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOMINAL TRANSAKSI (RP)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rp 0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={newRuleAmount ? `Rp ${parseInt(newRuleAmount.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')}` : ''}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, '');
                  setNewRuleAmount(num);
                }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FREKUENSI PERULANGAN</Text>
              <View style={styles.typeRow}>
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => {
                  const isActive = newRuleFrequency === freq;
                  const label = freq === 'daily' ? 'Harian' : freq === 'weekly' ? 'Mingguan' : freq === 'monthly' ? 'Bulanan' : 'Tahunan';
                  return (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.typeBtn, isActive && styles.typeBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setNewRuleFrequency(freq);
                      }}
                    >
                      <Text style={[styles.typeBtnText, isActive && styles.typeBtnTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>REKENING / DOMPET</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {accounts.map((acc) => {
                  const isSelected = (newRuleAccountId || (accounts[0]?.id)) === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.rulePillBtn, isSelected && styles.rulePillBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setNewRuleAccountId(acc.id);
                      }}
                    >
                      <Text style={[styles.rulePillText, isSelected && styles.rulePillTextActive]}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>KATEGORI TRANSAKSI</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {categories.filter((c) => c.type === newRuleType).map((cat) => {
                  const isSelected = newRuleCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.rulePillBtn, isSelected && styles.rulePillBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setNewRuleCategoryId(cat.id);
                      }}
                    >
                      <Text style={[styles.rulePillText, isSelected && styles.rulePillTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>KETERANGAN / CATATAN JADWAL</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Langganan Netflix Premium, Listrik PLN"
                placeholderTextColor={colors.text.muted}
                value={newRuleNote}
                onChangeText={setNewRuleNote}
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNewRule}>
              <Text style={styles.saveBtnText}>Simpan Jadwal Berulang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Import CSV Modal (PRD Section 71) */}
      <Modal visible={isImportCsvOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsImportCsvOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FileUp size={20} color={colors.gold.champagne} />
                <Text style={styles.modalTitle}>Impor Transaksi CSV</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsImportCsvOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.csvGuideText}>
              Tempel teks format CSV dengan kolom Tanggal, Nominal, Tipe, Kategori, dan Catatan.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
              <TouchableOpacity style={styles.loadSampleBtn} onPress={handleLoadCsvSample}>
                <Text style={styles.loadSampleText}>+ Muat Contoh Format CSV</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.csvTextInput}
                placeholder="Tanggal,Nominal,Tipe,Kategori,Catatan&#10;2026-10-01,50000,Pengeluaran,Makanan,Makan siang"
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={6}
                value={csvInputText}
                onChangeText={setCsvInputText}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, isImporting && { opacity: 0.6 }]}
              onPress={handleImportCsv}
              disabled={isImporting}
            >
              <Text style={styles.saveBtnText}>
                {isImporting ? 'Mengimpor Data...' : 'Mulai Impor ke Database'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy & Terms Modal (Apple App Store 5.1 compliant) */}
      <Modal visible={isPrivacyModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsPrivacyModalOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.privacyHeaderLeft}>
                <ShieldCheck size={20} color={colors.gold.champagne} />
                <Text style={styles.modalTitle}>Kebijakan Privasi</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsPrivacyModalOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.privacyScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>1. Filosofi & Keamanan Data</Text>
                <Text style={styles.privacyText}>
                  UangKu dibangun dengan prinsip Local-First & Privacy-First. Seluruh catatan transaksi finansial, nominal, dan saldo dompet tersimpan secara lokal di perangkatmu menggunakan database SQLite.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>2. Perlindungan Biometrik</Text>
                <Text style={styles.privacyText}>
                  Akses ke aplikasi dapat dikunci menggunakan Face ID atau Touch ID melalui modul Secure Enclave Apple. Data biometrik kamu tidak pernah diunggah ke jaringan internet.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>3. Hak Pengguna & Penghapusan Data</Text>
                <Text style={styles.privacyText}>
                  Sesuai ketentuan Apple App Store Review Guideline 5.1.1, kamu memiliki kontrol penuh untuk mengekspor seluruh histori catatan transaksimu dalam format CSV atau menghapus akun beserta seluruh data lokal secara permanen kapan saja.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>4. Bebas Pelacak Pihak Ketiga</Text>
                <Text style={styles.privacyText}>
                  UangKu tidak menyematkan pelacak iklan pihak ketiga (third-party ads trackers). Data finansial pribadimu adalah aset rahasia yang sepenuhnya menjadi milikmu.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.privacyAgreeBtn}
              onPress={() => {
                hapticLight();
                setIsPrivacyModalOpen(false);
              }}
            >
              <Text style={styles.privacyAgreeText}>Saya Mengerti</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cloud Authentication Modal */}
      <AuthModal visible={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Interactive Animation & Onboarding Tour Flow */}
      <WelcomeFlow visible={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} startWithAnimation={true} />
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
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141D',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    marginBottom: 20,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.hairline,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: colors.text.muted,
    marginBottom: 6,
  },
  vipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 4,
  },
  vipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  menuGroup: {
    backgroundColor: '#12141D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  menuSublabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 1,
  },
  menuValue: {
    fontSize: 13,
    color: colors.text.muted,
    fontWeight: '500',
  },
  activePill: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addAccountHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  addAccountHeaderText: {
    fontSize: 12,
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  accountRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  accountRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accountIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  defaultPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  accountSubText: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  accountBalanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold.champagne,
    fontVariant: ['tabular-nums'],
  },
  catSegmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  catSegmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#12141D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  catSegmentBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: colors.gold.champagne,
  },
  catSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  catSegmentTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  categoryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  systemPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  systemPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  customPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  customPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
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
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  typeBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: colors.gold.champagne,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  typeBtnTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: colors.gold.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#090A0E',
  },
  privacyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyScroll: {
    maxHeight: 340,
    marginBottom: 16,
  },
  privacySection: {
    marginBottom: 14,
  },
  privacySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold.champagne,
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  privacyAgreeBtn: {
    backgroundColor: colors.gold.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  privacyAgreeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#090A0E',
  },
  accountBalanceCol: {
    alignItems: 'flex-end',
  },
  csvGuideText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
    marginBottom: 10,
  },
  loadSampleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  loadSampleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  csvTextInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 120,
  },
  emptyRuleContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyRuleText: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
  },
  ruleCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  ruleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  ruleIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  ruleSubtitleText: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 2,
  },
  ruleRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  ruleAmountText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ruleBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  ruleExecuteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ruleExecuteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#090A0E',
  },
  ruleDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  ruleDeleteText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.flow.expense,
  },
  rulePillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  rulePillBtnActive: {
    borderColor: colors.gold.primary,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  rulePillText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  rulePillTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  inputHelperText: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 4,
    lineHeight: 15,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  templateCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  templateCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  templateIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
});
