import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
  Alert,
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
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { colors } from '../../src/theme/colors';
import { getLocalTransactions, getDb } from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticLight } from '../../src/theme/haptics';

export default function SettingsScreen() {
  const [faceIdEnabled, setFaceIdEnabled] = useState(true);

  const handleExportCsv = async () => {
    hapticMedium();
    try {
      const txs = await getLocalTransactions();
      if (txs.length === 0) {
        Alert.alert('Ekspor CSV', 'Belum ada transaksi untuk diekspor.');
        return;
      }

      // Generate UTF-8 BOM CSV according to PRD Section 12.3
      const header = 'Tanggal,Waktu,Tipe,Kategori,Nominal (IDR),Dari Akun,Ke Akun,Biaya Admin,Catatan\n';
      const rows = txs.map((t) => {
        const dateObj = new Date(t.transactionDate);
        const dateStr = dateObj.toISOString().slice(0, 10);
        const timeStr = dateObj.toTimeString().slice(0, 8);
        const typeLabel = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer';
        const catName = t.category?.name || (t.type === 'transfer' ? 'Transfer Antar Akun' : 'Lainnya');
        const fromAccount = t.account?.name || 'Kas';
        const toAccount = t.destinationAccount?.name || '';
        const fee = t.transferFee || 0;
        const note = (t.note || '').replace(/"/g, '""');

        return `"${dateStr}","${timeStr}","${typeLabel}","${catName}",${t.amount},"${fromAccount}","${toAccount}",${fee},"${note}"`;
      }).join('\n');

      const csvContent = '\uFEFF' + header + rows;
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
            const db = await getDb();
            await db.execAsync(`
              DELETE FROM local_transactions;
              DELETE FROM mutation_outbox;
            `);
            Alert.alert('Akun Dihapus', 'Seluruh data lokal telah dibersihkan secara tuntas.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pengaturan</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <User size={24} color={colors.gold.champagne} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Gary Hardyansyah</Text>
            <Text style={styles.profileEmail}>gary@example.com</Text>
            <View style={styles.vipPill}>
              <Sparkles size={10} color={colors.gold.primary} />
              <Text style={styles.vipText}>PREMIUM MEMBER</Text>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <Text style={styles.sectionTitle}>KEAMANAN & PRIVASI</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <ShieldCheck size={20} color={colors.gold.champagne} />
              <Text style={styles.menuLabel}>Kunci Aplikasi (Face ID)</Text>
            </View>
            <Switch
              value={faceIdEnabled}
              onValueChange={(val) => {
                hapticSelection();
                setFaceIdEnabled(val);
              }}
              trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
              thumbColor={colors.text.primary}
            />
          </View>
        </View>

        {/* Data & Backup */}
        <Text style={styles.sectionTitle}>DATA & CADANGAN</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleExportCsv}>
            <View style={styles.menuLeft}>
              <FileSpreadsheet size={20} color={colors.gold.champagne} />
              <View>
                <Text style={styles.menuLabel}>Ekspor Histori (CSV)</Text>
                <Text style={styles.menuSublabel}>Kompatibel Excel & Google Sheets</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* About & Compliance */}
        <Text style={styles.sectionTitle}>TENTANG APLIKASI</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Info size={20} color={colors.text.muted} />
              <Text style={styles.menuLabel}>Versi Aplikasi</Text>
            </View>
            <Text style={styles.menuValue}>1.0.0 (MVP Release)</Text>
          </View>
        </View>

        {/* Danger Zone: App Store Account Deletion */}
        <Text style={[styles.sectionTitle, { color: colors.flow.expense }]}>ZONA DESTRUKTIF</Text>
        <View style={[styles.menuGroup, { borderColor: 'rgba(244, 63, 94, 0.25)' }]}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleDeleteAccount}>
            <View style={styles.menuLeft}>
              <Trash2 size={20} color={colors.flow.expense} />
              <View>
                <Text style={[styles.menuLabel, { color: colors.flow.expense }]}>Hapus Akun & Semua Data</Text>
                <Text style={styles.menuSublabel}>Kepatuhan Apple App Store Guideline 5.1.1</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.flow.expense} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    marginBottom: 24,
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
    backgroundColor: colors.bg.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.subtle,
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
});
