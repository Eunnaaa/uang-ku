import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Check, Utensils, Car, ShoppingBag, FileText, Film, Heart, Book, MoreHorizontal, Briefcase, Gift, Laptop, TrendingUp, Wallet } from 'lucide-react-native';
import { formatRupiah, type CategoryModel, type AccountModel } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import { CustomKeypad } from '../../src/components/CustomKeypad';
import { getLocalCategories, getLocalAccounts, insertLocalTransaction } from '../../src/db/sqlite';
import { SyncEngine } from '../../src/sync/syncEngine';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError } from '../../src/theme/haptics';

export default function NewTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ initialType?: string }>();

  const [txType, setTxType] = useState<'expense' | 'income' | 'transfer'>(
    (params.initialType as any) || 'expense'
  );
  const [amount, setAmount] = useState<number>(0);
  const [transferFee, setTransferFee] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedDestAccountId, setSelectedDestAccountId] = useState<string>('');

  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [accounts, setAccounts] = useState<AccountModel[]>([]);

  useEffect(() => {
    async function loadFormMetadata() {
      const [cats, accs] = await Promise.all([
        getLocalCategories(txType === 'transfer' ? undefined : txType),
        getLocalAccounts(),
      ]);
      setCategories(cats);
      setAccounts(accs);

      if (cats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(cats[0].id);
      }
      if (accs.length > 0 && !selectedAccountId) {
        const defaultAcc = accs.find((a) => a.isDefault) || accs[0];
        setSelectedAccountId(defaultAcc.id);
        if (accs.length > 1) {
          const secondAcc = accs.find((a) => a.id !== defaultAcc.id);
          if (secondAcc) setSelectedDestAccountId(secondAcc.id);
        }
      }
    }
    loadFormMetadata();
  }, [txType]);

  const handleSave = async () => {
    if (amount <= 0) {
      hapticError();
      Alert.alert('Perhatian', 'Masukkan nominal transaksi terlebih dahulu.');
      return;
    }

    if (txType === 'transfer') {
      if (!selectedDestAccountId || selectedDestAccountId === selectedAccountId) {
        hapticError();
        Alert.alert('Perhatian', 'Akun asal dan akun tujuan transfer tidak boleh sama.');
        return;
      }
    } else {
      if (!selectedCategoryId) {
        hapticError();
        Alert.alert('Perhatian', 'Pilih kategori transaksi.');
        return;
      }
    }

    try {
      hapticMedium();
      await insertLocalTransaction({
        accountId: selectedAccountId,
        destinationAccountId: txType === 'transfer' ? selectedDestAccountId : null,
        categoryId: txType === 'transfer' ? null : selectedCategoryId,
        type: txType,
        amount,
        transferFee: txType === 'transfer' ? transferFee : 0,
        note: note.trim() || null,
        transactionDate: new Date().toISOString(),
      });

      hapticSuccess();
      // Trigger background sync worker asynchronously
      SyncEngine.processOutbox().catch(console.error);

      router.back();
    } catch (err: any) {
      hapticError();
      Alert.alert('Gagal Menyimpan', err.message);
    }
  };

  const getCategoryIcon = (iconName: string | null) => {
    const size = 16;
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
      case 'trending-up': return <TrendingUp size={size} color={color} />;
      default: return <MoreHorizontal size={size} color={color} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <X size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Catat Transaksi</Text>
        <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSave}>
          <Check size={20} color={colors.gold.champagne} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Type Segment Picker */}
        <View style={styles.typeSegment}>
          {(['expense', 'income', 'transfer'] as const).map((t) => {
            const isActive = txType === t;
            const label = t === 'expense' ? 'Pengeluaran' : t === 'income' ? 'Pemasukan' : 'Transfer';
            return (
              <TouchableOpacity
                key={t}
                style={[styles.segmentBtn, isActive && styles.activeSegmentBtn]}
                onPress={() => {
                  hapticSelection();
                  setTxType(t);
                }}
              >
                <Text style={[styles.segmentText, isActive && styles.activeSegmentText]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Amount Display */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>NOMINAL TRANSAKSI</Text>
          <Text style={[
            styles.amountValue,
            txType === 'expense' && { color: colors.flow.expense },
            txType === 'income' && { color: colors.flow.income },
            txType === 'transfer' && { color: colors.flow.transfer },
          ]}>
            {formatRupiah(amount)}
          </Text>
        </View>

        {/* Account Pickers */}
        <View style={styles.formRow}>
          <View style={styles.formCol}>
            <Text style={styles.fieldLabel}>{txType === 'transfer' ? 'DARI AKUN' : 'AKUN'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {accounts.map((acc) => {
                const isSelected = selectedAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountPill, isSelected && styles.accountPillSelected]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedAccountId(acc.id);
                    }}
                  >
                    <Wallet size={12} color={isSelected ? '#090A0E' : colors.text.muted} />
                    <Text style={[styles.accountPillText, isSelected && styles.accountPillTextSelected]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {txType === 'transfer' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={styles.fieldLabel}>KE AKUN TUJUAN</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {accounts.map((acc) => {
                  const isSelected = selectedDestAccountId === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.accountPill, isSelected && styles.destPillSelected]}
                      onPress={() => {
                        hapticSelection();
                        setSelectedDestAccountId(acc.id);
                      }}
                    >
                      <Wallet size={12} color={isSelected ? '#090A0E' : colors.text.muted} />
                      <Text style={[styles.accountPillText, isSelected && styles.accountPillTextSelected]}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Categories Grid (if not transfer) */}
        {txType !== 'transfer' && (
          <View style={styles.categoriesSection}>
            <Text style={styles.fieldLabel}>KATEGORI</Text>
            <View style={styles.catGrid}>
              {categories.map((c) => {
                const isSelected = selectedCategoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catItem, isSelected && styles.catItemSelected]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedCategoryId(c.id);
                    }}
                  >
                    <View style={[styles.catIconWrap, isSelected && styles.catIconWrapSelected]}>
                      {getCategoryIcon(c.icon)}
                    </View>
                    <Text style={[styles.catText, isSelected && styles.catTextSelected]} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Note Input */}
        <View style={styles.noteBox}>
          <TextInput
            style={styles.noteInput}
            placeholder="Tambahkan catatan (opsional)..."
            placeholderTextColor={colors.text.muted}
            value={note}
            onChangeText={setNote}
            maxLength={100}
          />
        </View>

        {/* Tactile Numeric Keypad */}
        <CustomKeypad value={amount} onChange={setAmount} />

        {/* Primary Save Button */}
        <TouchableOpacity activeOpacity={0.85} style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Simpan Transaksi</Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  saveHeaderBtn: {
    padding: 6,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
  },
  typeSegment: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeSegmentBtn: {
    backgroundColor: colors.gold.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.muted,
  },
  activeSegmentText: {
    color: '#090A0E',
    fontWeight: '700',
  },
  amountBox: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 10,
    color: colors.gold.champagne,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  fieldLabel: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  formRow: {
    marginBottom: 12,
  },
  formCol: {
    flex: 1,
  },
  pillRow: {
    gap: 8,
    paddingBottom: 4,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 6,
  },
  accountPillSelected: {
    backgroundColor: colors.gold.champagne,
    borderColor: colors.gold.primary,
  },
  destPillSelected: {
    backgroundColor: colors.flow.transfer,
    borderColor: colors.flow.transfer,
  },
  accountPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  accountPillTextSelected: {
    color: '#090A0E',
    fontWeight: '700',
  },
  categoriesSection: {
    marginBottom: 12,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catItem: {
    width: '31%',
    backgroundColor: colors.bg.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
  },
  catItemSelected: {
    borderColor: colors.gold.champagne,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  catIconWrapSelected: {
    backgroundColor: colors.gold.primary,
  },
  catText: {
    fontSize: 11,
    color: colors.text.muted,
    fontWeight: '600',
  },
  catTextSelected: {
    color: colors.gold.champagne,
  },
  noteBox: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 14,
    height: 44,
    justifyContent: 'center',
    marginBottom: 14,
  },
  noteInput: {
    fontSize: 13,
    color: colors.text.primary,
  },
  saveBtn: {
    backgroundColor: colors.gold.primary,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#090A0E',
    letterSpacing: 0.2,
  },
});
