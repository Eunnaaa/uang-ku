import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  RefreshControl,
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
  Wallet,
  X,
  LogOut,
  Layers,
  RefreshCw,
  FileUp,
  Repeat,
  Bell,
  Calendar,
  Bookmark,
  Receipt,
  KeyRound,
  Sun,
  Moon,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { NotificationService } from '../../src/services/notificationService';
import {
  generateTransactionsCsv,
  type AccountModel,
  type CategoryModel,
  type RecurringRuleModel,
} from '@uangku/contracts';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
import { SyncEngine } from '../../src/sync/syncEngine';
import {
  getLocalTransactions,
  getDb,
  getLocalAccounts,
  getLocalCategories,
  importTransactionsFromCsv,
  getLocalRecurringRules,
  clearAllLocalTransactions,
} from '../../src/db/sqlite';
import {
  hapticMedium,
  hapticSelection,
  hapticLight,
  hapticSuccess,
  hapticError,
} from '../../src/theme/haptics';
import { useAuth } from '../../src/auth/authContext';
import { AuthModal } from '../../src/components/AuthModal';
import { WelcomeFlow } from '../../src/components/WelcomeFlow';
import { useToast } from '../../src/components/Toast';

const BIOMETRIC_PREF_KEY = 'uangku_biometric_enabled';

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, logout, deleteAccount, isGuest } = useAuth();
  const { theme, setTheme, colors, isDark } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Preference Toggles
  const [faceIdEnabled, setFaceIdEnabled] = useState(true);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [billReminderEnabled, setBillReminderEnabled] = useState(true);

  // Summary counts
  const [accounts, setAccounts] = useState<AccountModel[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRuleModel[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // CSV Import Modal
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [csvInputText, setCsvInputText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDb();
      const [accs, cats, rules, pending] = await Promise.all([
        getLocalAccounts(),
        getLocalCategories(),
        getLocalRecurringRules(),
        db.getFirstAsync<{ count: number }>(
          `SELECT count(*) as count FROM mutation_outbox WHERE status = 'pending';`
        ),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setRecurringRules(rules);
      setPendingSyncCount(pending?.count || 0);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();

    SecureStore.getItemAsync(BIOMETRIC_PREF_KEY)
      .then((val) => {
        if (val !== null) setFaceIdEnabled(val === '1');
      })
      .catch(() => {});
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleManualSync = async () => {
    hapticMedium();
    try {
      const res = await SyncEngine.syncAll();
      await loadData();

      if (res.pushed > 0 || res.pulled > 0) {
        toast.showSuccess(
          'Sinkronisasi Sukses',
          `${res.pushed} terkirim, ${res.pulled} data terbaru ditarik.`
        );
      } else {
        toast.showInfo(
          'Sinkronisasi Lengkap',
          'Seluruh transaksi telah sinkron sempurna dengan server.'
        );
      }
    } catch {
      toast.showWarning(
        'Mode Offline',
        'Koneksi ke server terputus. Data tetap tersimpan aman di SQLite lokal.'
      );
    }
  };

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

  const handleExportCsv = async () => {
    hapticMedium();
    try {
      const txs = await getLocalTransactions();
      if (txs.length === 0) {
        Alert.alert('Ekspor CSV', 'Belum ada transaksi untuk diekspor.');
        return;
      }

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
        await loadData();
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
              await loadData();
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
              await loadData();
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

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pengaturan</Text>
        <Text style={styles.headerSubtitle}>Kelola preferensi & akun Anda</Text>
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
        {/* 1. Profile Hero Card */}
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
            <Text style={styles.profileEmail}>{user?.email || 'Mode Tamu (Offline SQLite)'}</Text>
            <View style={styles.vipPill}>
              <Sparkles size={10} color={colors.gold.primary} />
              <Text style={styles.vipText}>{isGuest ? 'GUEST USER' : 'PREMIUM MEMBER'}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.text.muted} />
        </TouchableOpacity>

        {/* 2. Tema & Tampilan (Light & Dark Mode) */}
        <Text style={styles.sectionTitle}>TEMA & TAMPILAN</Text>
        <View style={styles.themeSelectorGroup}>
          {(
            [
              { key: 'light', label: 'Terang', icon: Sun, desc: 'Mode Siang' },
              { key: 'dark', label: 'Gelap', icon: Moon, desc: 'Obsidian Emas' },
              { key: 'system', label: 'Sistem', icon: Smartphone, desc: 'Ikuti Perangkat' },
            ] as const
          ).map((item) => {
            const isSelected = theme === item.key;
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                style={[
                  styles.themeOptionCard,
                  isSelected && styles.themeOptionCardActive,
                ]}
                onPress={() => setTheme(item.key)}
              >
                <View
                  style={[
                    styles.themeOptionIconCircle,
                    isSelected && styles.themeOptionIconCircleActive,
                  ]}
                >
                  <Icon
                    size={18}
                    color={isSelected ? colors.gold.champagne : colors.text.muted}
                  />
                </View>
                <Text
                  style={[
                    styles.themeOptionLabel,
                    isSelected && styles.themeOptionLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={styles.themeOptionDesc}>{item.desc}</Text>
                {isSelected && <View style={styles.themeActiveDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 3. Keuangan & Master Data */}
        <Text style={styles.sectionTitle}>KEUANGAN & MASTER DATA</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/accounts');
            }}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Wallet size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Dompet & Rekening</Text>
                <Text style={styles.menuSublabel}>
                  {accounts.length} akun aktif (Bank, Tunai, E-Wallet)
                </Text>
              </View>
            </View>
            <View style={styles.menuRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{accounts.length}</Text>
              </View>
              <ChevronRight size={16} color={colors.text.muted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/categories');
            }}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Layers size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Kategori Transaksi</Text>
                <Text style={styles.menuSublabel}>
                  {categories.length} kategori pengeluaran & pemasukan
                </Text>
              </View>
            </View>
            <View style={styles.menuRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{categories.length}</Text>
              </View>
              <ChevronRight size={16} color={colors.text.muted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/recurring');
            }}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Repeat size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Transaksi Berulang (Jadwal)</Text>
                <Text style={styles.menuSublabel}>
                  {recurringRules.filter((r) => r.isActive).length} jadwal aktif
                </Text>
              </View>
            </View>
            <View style={styles.menuRight}>
              {recurringRules.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{recurringRules.length}</Text>
                </View>
              )}
              <ChevronRight size={16} color={colors.text.muted} />
            </View>
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
              <View style={styles.menuIconCircle}>
                <Bookmark size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Kantong Keuangan (Pockets)</Text>
                <Text style={styles.menuSublabel}>Envelope budgeting alokasi saldo terkunci</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* 4. Fitur Cerdas & Integrasi */}
        <Text style={styles.sectionTitle}>FITUR CERDAS & INTEGRASI</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/bank-sync');
            }}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Landmark size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Integrasi Bank & Mutasi</Text>
                <Text style={styles.menuSublabel}>Impor e-statement & rekonsiliasi cerdas</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              router.push('/split-bill');
            }}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Receipt size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Kalkulator Split Bill</Text>
                <Text style={styles.menuSublabel}>Bagi tagihan resto presisi & kirim WhatsApp</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={handleManualSync}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <RefreshCw size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Sinkronisasi Cloud Outbox</Text>
                <Text style={styles.menuSublabel}>
                  {pendingSyncCount > 0
                    ? `${pendingSyncCount} mutasi menunggu sinkronisasi`
                    : 'Semua mutasi telah tersinkron'}
                </Text>
              </View>
            </View>
            <View style={[styles.syncPill, pendingSyncCount > 0 && styles.syncPillPending]}>
              <Text style={[styles.syncPillText, pendingSyncCount > 0 && styles.syncPillTextPending]}>
                {pendingSyncCount > 0 ? `${pendingSyncCount} Pending` : 'Sinkron ✓'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 5. Keamanan & Notifikasi */}
        <Text style={styles.sectionTitle}>KEAMANAN & NOTIFIKASI</Text>
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
              <View style={styles.menuIconCircle}>
                <KeyRound size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Pusat Keamanan & PIN</Text>
                <Text style={styles.menuSublabel}>PIN 6-digit & privasi sensor saldo</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={[styles.menuItem, styles.menuItemBorder]}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <ShieldCheck size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Kunci Aplikasi (Face ID)</Text>
                <Text style={styles.menuSublabel}>Verifikasi biometrik saat membuka app</Text>
              </View>
            </View>
            <Switch
              value={faceIdEnabled}
              onValueChange={handleToggleFaceId}
              trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
              thumbColor={colors.text.primary}
            />
          </View>

          <View style={[styles.menuItem, styles.menuItemBorder]}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Bell size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Pengingat Harian (20:00 WIB)</Text>
                <Text style={styles.menuSublabel}>Disiplin mencatat pengeluaran harian</Text>
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
              <View style={styles.menuIconCircle}>
                <Calendar size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Pengingat Tagihan & Tempo</Text>
                <Text style={styles.menuSublabel}>Notifikasi jatuh tempo jadwal berulang</Text>
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

        {/* 6. Data & Cadangan */}
        <Text style={styles.sectionTitle}>DATA & CADANGAN</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleExportCsv}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <FileSpreadsheet size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Ekspor Histori Transaksi (CSV)</Text>
                <Text style={styles.menuSublabel}>Format Excel / Google Sheets (UTF-8 BOM)</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
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
              <View style={styles.menuIconCircle}>
                <FileUp size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Impor Transaksi (CSV)</Text>
                <Text style={styles.menuSublabel}>Migrasi data transaksi dari file CSV</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* 7. Tentang & Informasi */}
        <Text style={styles.sectionTitle}>TENTANG & INFORMASI</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              hapticSelection();
              setIsOnboardingOpen(true);
            }}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Sparkles size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Panduan Aplikasi (Tour)</Text>
                <Text style={styles.menuSublabel}>Pengenalan fitur dan alur navigasi UangKu</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={() => setIsPrivacyModalOpen(true)}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Info size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Kebijakan Privasi & Ketentuan</Text>
                <Text style={styles.menuSublabel}>Standar Apple App Store Guideline 5.1</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={[styles.menuItem, styles.menuItemBorder]}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconCircle}>
                <Smartphone size={16} color={colors.gold.champagne} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Penyimpanan & Versi</Text>
                <Text style={styles.menuSublabel}>SQLite Local Engine (WAL Mode)</Text>
              </View>
            </View>
            <Text style={styles.menuValue}>v1.0.0 (Ready)</Text>
          </View>
        </View>

        {/* 8. Zona Bahaya & Sesi */}
        <Text style={[styles.sectionTitle, { color: colors.flow.expense }]}>SESI & ZONA TINDAKAN</Text>
        <View style={[styles.menuGroup, { borderColor: 'rgba(239, 68, 68, 0.22)' }]}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' }]}>
                <LogOut size={16} color={colors.text.secondary} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Keluar Akun</Text>
                <Text style={styles.menuSublabel}>Akhiri sesi login perangkat ini</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={handleResetData}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' }]}>
                <RefreshCw size={16} color={colors.text.secondary} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Reset Data ke Nol (Testing)</Text>
                <Text style={styles.menuSublabel}>Hapus seluruh catatan transaksi lokal</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            activeOpacity={0.7}
            onPress={handleDeleteAccount}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: colors.flow.expenseBg }]}>
                <Trash2 size={16} color={colors.flow.expense} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: colors.flow.expense }]}>
                  Hapus Akun & Semua Data
                </Text>
                <Text style={styles.menuSublabel}>Pemusnahan permanen data Apple Guideline 5.1.1</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.flow.expense} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CSV Import Modal */}
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
              <Text style={styles.modalTitle}>Impor Transaksi (CSV)</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsImportCsvOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHelperText}>
              Tempel baris teks CSV dengan format: Tanggal,Nominal,Tipe,Kategori,Catatan
            </Text>

            <TextInput
              style={styles.csvTextInput}
              multiline
              numberOfLines={6}
              placeholder="Tanggal,Nominal,Tipe,Kategori,Catatan..."
              placeholderTextColor={colors.text.muted}
              value={csvInputText}
              onChangeText={setCsvInputText}
              textAlignVertical="top"
            />

            <View style={styles.csvActionsRow}>
              <TouchableOpacity
                style={styles.csvSampleBtn}
                onPress={handleLoadCsvSample}
              >
                <Text style={styles.csvSampleText}>Muat Contoh Data</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.csvImportBtn, isImporting && { opacity: 0.6 }]}
                disabled={isImporting}
                onPress={handleImportCsv}
              >
                <Text style={styles.csvImportText}>
                  {isImporting ? 'Mengimpor...' : 'Mulai Impor'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
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
              <Text style={styles.modalTitle}>Kebijakan Privasi UangKu</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsPrivacyModalOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>1. Filosofi Offline-First & Keamanan</Text>
                <Text style={styles.privacyText}>
                  UangKu dibangun dengan prinsip privasi mutlak. Seluruh data keuangan, dompet, dan histori transaksi disimpan secara aman di perangkat lokal menggunakan SQLite dengan SQLite WAL Mode.
                </Text>
              </View>

              <View style={styles.privacySection}>
                <Text style={styles.privacySectionTitle}>2. Enkripsi & Pengamanan Biometrik</Text>
                <Text style={styles.privacyText}>
                  Kredensial sesi diamankan dengan Apple Keychain / Android Keystore. Autentikasi biometrik Face ID / Touch ID hanya diproses di Secure Enclave perangkat Anda.
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
      <WelcomeFlow
        visible={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        startWithAnimation={true}
      />
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
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: colors.bg.base,
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
      marginTop: 2,
    },
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 32,
    },

    // Profile Card
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg.surface,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.22)' : 'rgba(180, 83, 9, 0.25)',
      marginBottom: 16,
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
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
      fontSize: 12.5,
      color: colors.text.muted,
      marginBottom: 6,
    },
    vipPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(180, 83, 9, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      alignSelf: 'flex-start',
      gap: 4,
    },
    vipText: {
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.gold.champagne,
      letterSpacing: 0.5,
    },

    // Theme Selector (Light & Dark Mode)
    themeSelectorGroup: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    themeOptionCard: {
      flex: 1,
      backgroundColor: colors.bg.surface,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: 'center',
      borderWidth: 1.2,
      borderColor: colors.border.subtle,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    themeOptionCardActive: {
      borderColor: colors.gold.primary,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(217, 119, 6, 0.08)',
    },
    themeOptionIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.bg.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    themeOptionIconCircleActive: {
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(217, 119, 6, 0.16)',
    },
    themeOptionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.muted,
      marginBottom: 2,
    },
    themeOptionLabelActive: {
      color: colors.text.primary,
      fontWeight: '700',
    },
    themeOptionDesc: {
      fontSize: 9.5,
      color: colors.text.muted,
      textAlign: 'center',
    },
    themeActiveDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.gold.primary,
      marginTop: 6,
    },

    // Section Headers & Groups
    sectionTitle: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 6,
      paddingHorizontal: 4,
    },
    menuGroup: {
      backgroundColor: colors.bg.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      marginBottom: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      paddingHorizontal: 15,
    },
    menuItemBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
    },
    menuLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    menuRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    menuIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 83, 9, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.16)' : 'rgba(180, 83, 9, 0.18)',
    },
    menuLabel: {
      fontSize: 13.5,
      fontWeight: '600',
      color: colors.text.primary,
    },
    menuSublabel: {
      fontSize: 11,
      color: colors.text.muted,
      marginTop: 2,
    },
    menuValue: {
      fontSize: 12,
      color: colors.text.muted,
      fontWeight: '600',
    },
    countBadge: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.secondary,
    },
    syncPill: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(5, 150, 105, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    syncPillPending: {
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(217, 119, 6, 0.14)',
    },
    syncPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.flow.income,
    },
    syncPillTextPending: {
      color: colors.gold.champagne,
    },

    // Modals
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.bg.overlay,
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
      borderColor: colors.border.subtle,
    },
    modalHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      alignSelf: 'center',
      marginBottom: 14,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
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
    modalHelperText: {
      fontSize: 12,
      color: colors.text.muted,
      lineHeight: 17,
      marginBottom: 12,
    },
    csvTextInput: {
      backgroundColor: colors.bg.elevated,
      borderRadius: 12,
      padding: 12,
      height: 120,
      color: colors.text.primary,
      fontSize: 12,
      fontFamily: 'monospace',
      borderWidth: 1,
      borderColor: colors.border.subtle,
      marginBottom: 14,
    },
    csvActionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    csvSampleBtn: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    csvSampleText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    csvImportBtn: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.gold.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    csvImportText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // Privacy Modal
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
      color: colors.text.secondary,
      lineHeight: 18,
    },
    privacyAgreeBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.gold.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    privacyAgreeText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
