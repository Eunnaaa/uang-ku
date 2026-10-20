import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  X,
  Check,
  Utensils,
  Car,
  ShoppingBag,
  FileText,
  Film,
  Heart,
  Book,
  MoreHorizontal,
  Briefcase,
  Gift,
  Laptop,
  TrendingUp,
  Wallet,
  Calendar,
  Sparkles,
  Repeat,
  Bookmark,
  Star,
  Camera,
  Trash2,
} from 'lucide-react-native';
import {
  formatRupiah,
  type CategoryModel,
  type AccountModel,
  type RecurringFrequency,
  type TemplateModel,
} from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import { CustomKeypad } from '../../src/components/CustomKeypad';
import {
  getLocalCategories,
  getLocalAccounts,
  insertLocalTransaction,
  updateLocalTransaction,
  getLocalTransactions,
  insertLocalRecurringRule,
  getLocalBudgets,
  getLocalTemplates,
  insertLocalTemplate,
  incrementLocalTemplateUseCount,
  checkPotentialDuplicateTransaction,
} from '../../src/db/sqlite';
import { SyncEngine } from '../../src/sync/syncEngine';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError, hapticLight } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

export default function NewTransactionScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    initialType?: string;
    editId?: string;
    presetAmount?: string;
    presetNote?: string;
    presetAccountId?: string;
    presetCategoryId?: string;
  }>();
  const isEditMode = Boolean(params.editId);

  const [txType, setTxType] = useState<'expense' | 'income' | 'transfer'>(
    (params.initialType as any) || 'expense'
  );
  const [amount, setAmount] = useState<number>(0);
  const [transferFee, setTransferFee] = useState<number>(0);
  const [selectedDaysAgo, setSelectedDaysAgo] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedDestAccountId, setSelectedDestAccountId] = useState<string>('');

  // Recurring Transaction (PRD Section 58)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');

  // Receipt Photo Attachment (PRD Section 63)
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  // Template Favorit 1-Tap (PRD Section 59)
  const [templates, setTemplates] = useState<TemplateModel[]>([]);
  const [isFromTemplate, setIsFromTemplate] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [accounts, setAccounts] = useState<AccountModel[]>([]);

  useEffect(() => {
    async function loadFormMetadata() {
      const [cats, accs, allTxs, tmpls] = await Promise.all([
        getLocalCategories(txType === 'transfer' ? undefined : txType),
        getLocalAccounts(),
        params.editId ? getLocalTransactions() : Promise.resolve([]),
        getLocalTemplates(),
      ]);
      setCategories(cats);
      setAccounts(accs);
      setTemplates(tmpls);

      if (params.editId) {
        const existingTx = allTxs.find((t) => t.id === params.editId);
        if (existingTx) {
          setTxType(existingTx.type);
          setAmount(existingTx.amount);
          setTransferFee(existingTx.transferFee || 0);
          setNote(existingTx.note || '');
          if (existingTx.receiptUrl) {
            setReceiptUri(existingTx.receiptUrl);
          }
          setSelectedAccountId(existingTx.accountId);
          if (existingTx.destinationAccountId) {
            setSelectedDestAccountId(existingTx.destinationAccountId);
          }
          if (existingTx.categoryId) {
            setSelectedCategoryId(existingTx.categoryId);
          }
          return;
        }
      }

      // Check presets from external navigation (e.g. Split Bill, Accounts transfer)
      if (params.presetAmount) {
        const pNum = parseInt(params.presetAmount, 10);
        if (!isNaN(pNum) && pNum > 0) setAmount(pNum);
      }
      if (params.presetNote) {
        setNote(params.presetNote);
      }
      if (params.presetAccountId) {
        setSelectedAccountId(params.presetAccountId);
      }
      if (params.presetCategoryId) {
        setSelectedCategoryId(params.presetCategoryId);
      }

      if (cats.length > 0 && !params.presetCategoryId) {
        const isCurrentCatValid = cats.some((c) => c.id === selectedCategoryId);
        if (!selectedCategoryId || !isCurrentCatValid) {
          setSelectedCategoryId(cats[0].id);
        }
      }
      if (accs.length > 0 && !selectedAccountId && !params.presetAccountId) {
        const defaultAcc = accs.find((a) => a.isDefault) || accs[0];
        setSelectedAccountId(defaultAcc.id);
        if (accs.length > 1) {
          const secondAcc = accs.find((a) => a.id !== defaultAcc.id);
          if (secondAcc) setSelectedDestAccountId(secondAcc.id);
        }
      }
    }
    loadFormMetadata();
  }, [txType, params.editId, params.presetAmount, params.presetNote, params.presetAccountId, params.presetCategoryId]);

  const handleApplyTemplate = async (tmpl: TemplateModel) => {
    hapticSuccess();
    setIsFromTemplate(true);
    setTxType(tmpl.templatePayload.type);
    setAmount(tmpl.templatePayload.amount);
    if (tmpl.templatePayload.accountId) setSelectedAccountId(tmpl.templatePayload.accountId);
    if (tmpl.templatePayload.destinationAccountId) setSelectedDestAccountId(tmpl.templatePayload.destinationAccountId);
    if (tmpl.templatePayload.categoryId) setSelectedCategoryId(tmpl.templatePayload.categoryId);
    if (tmpl.templatePayload.note) setNote(tmpl.templatePayload.note);
    await incrementLocalTemplateUseCount(tmpl.id);
  };

  const handleSaveAsTemplate = async () => {
    if (!templateNameInput.trim()) {
      toast.showWarning('Perhatian', 'Masukkan nama template.');
      return;
    }
    if (amount <= 0) {
      toast.showWarning('Perhatian', 'Masukkan nominal sebelum menyimpan template.');
      return;
    }
    try {
      hapticMedium();
      await insertLocalTemplate({
        name: templateNameInput.trim(),
        templatePayload: {
          amount,
          categoryId: txType === 'transfer' ? null : selectedCategoryId,
          accountId: selectedAccountId,
          destinationAccountId: txType === 'transfer' ? selectedDestAccountId : null,
          type: txType,
          note: note.trim() || null,
          currency: 'IDR',
        },
      });
      setIsSaveTemplateModalOpen(false);
      setTemplateNameInput('');
      const updated = await getLocalTemplates();
      setTemplates(updated);
      toast.showSuccess('Template Tersimpan', `Template "${templateNameInput.trim()}" siap digunakan.`);
    } catch (err: any) {
      toast.showError('Gagal Menyimpan Template', err.message);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (amount <= 0) {
      toast.showWarning('Nominal Kosong', 'Masukkan nominal transaksi terlebih dahulu.');
      return;
    }

    if (txType === 'transfer') {
      if (!selectedDestAccountId || selectedDestAccountId === selectedAccountId) {
        toast.showError('Akun Tidak Valid', 'Akun asal dan akun tujuan transfer tidak boleh sama.');
        return;
      }
    } else {
      if (!selectedCategoryId) {
        toast.showWarning('Kategori Diperlukan', 'Pilih kategori transaksi.');
        return;
      }
    }

    setIsSaving(true);

    const executeSave = async () => {
      try {
        hapticMedium();
        const txDateObj = new Date();
        if (selectedDaysAgo > 0) {
          txDateObj.setDate(txDateObj.getDate() - selectedDaysAgo);
        }

        if (isEditMode && params.editId) {
          await updateLocalTransaction(params.editId, {
            accountId: selectedAccountId,
            destinationAccountId: txType === 'transfer' ? selectedDestAccountId : null,
            categoryId: txType === 'transfer' ? null : selectedCategoryId,
            amount,
            transferFee: txType === 'transfer' ? transferFee : 0,
            note: note.trim() || null,
            receiptUrl: receiptUri,
          });
        } else {
          await insertLocalTransaction({
            accountId: selectedAccountId,
            destinationAccountId: txType === 'transfer' ? selectedDestAccountId : null,
            categoryId: txType === 'transfer' ? null : selectedCategoryId,
            type: txType,
            amount,
            transferFee: txType === 'transfer' ? transferFee : 0,
            note: note.trim() || null,
            receiptUrl: receiptUri,
            transactionDate: txDateObj.toISOString(),
          });

          if (isRecurring && txType !== 'transfer') {
            await insertLocalRecurringRule({
              accountId: selectedAccountId,
              categoryId: selectedCategoryId,
              type: txType,
              amount,
              frequency: recurringFrequency,
              note: note.trim() || null,
            });
          }
        }

        toast.showSuccess(
          isEditMode ? 'Transaksi Diperbarui' : 'Transaksi Berhasil Dicatat',
          formatRupiah(amount)
        );

        // Trigger background sync worker asynchronously
        SyncEngine.processOutbox().catch(console.error);

        router.back();
      } catch (err: any) {
        toast.showError('Gagal Menyimpan', err.message);
      } finally {
        setIsSaving(false);
      }
    };

    if (isEditMode) {
      await executeSave();
      return;
    }

    // Duplicate Transaction Detector (PRD Seksi 68)
    // Deteksi tidak berlaku untuk transaksi dari template (PRD Seksi 68.4)
    if (!isFromTemplate) {
      try {
        const potentialDuplicate = await checkPotentialDuplicateTransaction({
          amount,
          accountId: selectedAccountId,
          type: txType,
        });

        if (potentialDuplicate) {
          const targetCategory = categories.find((c) => c.id === selectedCategoryId);
          const catName = targetCategory?.name || (txType === 'transfer' ? 'Transfer Antar Akun' : 'transaksi');
          Alert.alert(
            'Potensi Transaksi Ganda',
            `Kamu baru saja mencatat ${formatRupiah(amount)} untuk ${catName}. Apakah ini transaksi yang berbeda?`,
            [
              {
                text: 'Batal',
                style: 'cancel',
                onPress: () => setIsSaving(false),
              },
              {
                text: 'Ya, Simpan',
                onPress: executeSave,
              },
            ]
          );
          return;
        }
      } catch {}
    }

    // Budget Overspending Alert (PRD Section 60)
    if (txType === 'expense' && selectedCategoryId) {
      try {
        const budgets = await getLocalBudgets();
        const categoryBudget = budgets[selectedCategoryId];
        if (categoryBudget && categoryBudget > 0) {
          const now = new Date();
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const allTxs = await getLocalTransactions();
          const currentSpent = allTxs
            .filter((t) => t.type === 'expense' && t.categoryId === selectedCategoryId && t.transactionDate.startsWith(monthKey))
            .reduce((sum, t) => sum + t.amount, 0);

          const projectedSpent = currentSpent + amount;
          if (projectedSpent > categoryBudget) {
            const targetCategory = categories.find((c) => c.id === selectedCategoryId);
            const catName = targetCategory?.name || 'kategori ini';
            const overAmount = projectedSpent - categoryBudget;
            Alert.alert(
              '⚠️ Melebihi Anggaran Belanja',
              `Transaksi ini akan membuat pengeluaran ${catName} bulan ini menjadi ${formatRupiah(projectedSpent)}, melebihi batas anggaranmu sebesar ${formatRupiah(overAmount)}. Tetap simpan?`,
              [
                { text: 'Batal', style: 'cancel', onPress: () => setIsSaving(false) },
                { text: 'Tetap Simpan', onPress: executeSave },
              ]
            );
            return;
          }
        }
      } catch {}
    }

    await executeSave();
  };

  const handlePickReceipt = () => {
    hapticSelection();
    Alert.alert(
      'Lampirkan Foto Struk / Bukti',
      'Pilih sumber foto bukti transaksi:',
      [
        {
          text: 'Ambil Foto (Kamera)',
          onPress: async () => {
            try {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Izin Kamera Ditolak', 'Aktifkan izin akses kamera pada pengaturan perangkat untuk mengambil foto bukti.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.7,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                hapticSuccess();
                setReceiptUri(result.assets[0].uri);
              }
            } catch (err: any) {
              Alert.alert('Gagal Mengambil Foto', err.message);
            }
          },
        },
        {
          text: 'Pilih dari Galeri',
          onPress: async () => {
            try {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Izin Galeri Ditolak', 'Aktifkan izin akses galeri foto pada pengaturan perangkat untuk memilih foto bukti.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.7,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                hapticSuccess();
                setReceiptUri(result.assets[0].uri);
              }
            } catch (err: any) {
              Alert.alert('Gagal Memilih Foto', err.message);
            }
          },
        },
        { text: 'Batal', style: 'cancel' },
      ]
    );
  };

  const handleRemoveReceipt = () => {
    hapticLight();
    setReceiptUri(null);
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
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Transaksi' : 'Catat Transaksi'}</Text>
        <TouchableOpacity
          style={[styles.saveHeaderBtn, isSaving && { opacity: 0.4 }]}
          disabled={isSaving}
          onPress={handleSave}
        >
          <Check size={20} color={colors.gold.champagne} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Type Segment Picker */}
        <View style={styles.typeSegment}>
          {(['expense', 'income', 'transfer'] as const).map((t) => {
            const isActive = txType === t;
            const label = t === 'expense' ? 'Pengeluaran' : t === 'income' ? 'Pemasukan' : 'Transfer';
            const activeColor = t === 'income' ? colors.flow.income : t === 'expense' ? colors.flow.expense : colors.flow.transfer;

            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.segmentBtn,
                  isActive && { backgroundColor: activeColor },
                ]}
                onPress={() => {
                  hapticSelection();
                  setTxType(t);
                  if (t === 'transfer' && (!selectedDestAccountId || selectedDestAccountId === selectedAccountId) && accounts.length > 1) {
                    const alt = accounts.find((a) => a.id !== selectedAccountId);
                    if (alt) setSelectedDestAccountId(alt.id);
                  }
                }}
              >
                <Text style={[styles.segmentText, isActive && { color: '#FFFFFF', fontWeight: '700' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Amount Display */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>NOMINAL TRANSAKSI</Text>
          <Text
            style={[
              styles.amountValue,
              {
                color:
                  txType === 'income'
                    ? colors.flow.income
                    : txType === 'expense'
                    ? colors.flow.expense
                    : colors.flow.transfer,
              },
            ]}
          >
            {txType === 'income' ? '+ ' : txType === 'expense' ? '- ' : ''}
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
                      style={[styles.accountPill, isSelected && styles.accountPillSelected]}
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

        {/* Transfer Fee Options (if transfer) */}
        {txType === 'transfer' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <View style={styles.labelWithHintRow}>
                <Text style={styles.fieldLabel}>BIAYA ADMIN TRANSFER</Text>
                {transferFee > 0 && amount > 0 && (
                  <Text style={styles.transferFeeTotalHint}>
                    Total keluar: {formatRupiah(amount + transferFee)}
                  </Text>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {[
                  { label: 'Gratis (Rp 0)', fee: 0 },
                  { label: 'Rp 1.000', fee: 1000 },
                  { label: 'BI-Fast (Rp 2.500)', fee: 2500 },
                  { label: 'Rp 6.500', fee: 6500 },
                ].map((item) => {
                  const isSelected = transferFee === item.fee;
                  return (
                    <TouchableOpacity
                      key={item.fee}
                      style={[styles.accountPill, isSelected && styles.accountPillSelected]}
                      onPress={() => {
                        hapticSelection();
                        setTransferFee(item.fee);
                      }}
                    >
                      <Text style={[styles.accountPillText, isSelected && styles.accountPillTextSelected]}>
                        {item.label}
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

        {/* Date Quick Selector */}
        <View style={styles.dateSelectorRow}>
          <View style={styles.dateLabelRow}>
            <Calendar size={12} color={colors.gold.champagne} />
            <Text style={styles.fieldLabelNoMargin}>WAKTU TRANSAKSI</Text>
          </View>
          <View style={styles.dateChipsRow}>
            {[
              { label: 'Hari Ini', days: 0 },
              { label: 'Kemarin', days: 1 },
              { label: '2 Hari Lalu', days: 2 },
            ].map((d) => {
              const isSelected = selectedDaysAgo === d.days;
              return (
                <TouchableOpacity
                  key={d.days}
                  style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                  onPress={() => {
                    hapticSelection();
                    setSelectedDaysAgo(d.days);
                  }}
                >
                  <Text style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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

        {/* Receipt Attachment Section (PRD Section 63) */}
        <View style={styles.receiptSection}>
          {receiptUri ? (
            <View style={styles.receiptPreviewCard}>
              <View style={styles.receiptPreviewLeft}>
                <Image source={{ uri: receiptUri }} style={styles.receiptThumbnail} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptAttachedText}>Foto Bukti Terlampir</Text>
                  <Text style={styles.receiptSubText}>Tersimpan di perangkat lokal</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.removeReceiptBtn}
                onPress={handleRemoveReceipt}
              >
                <Trash2 size={15} color={colors.flow.expense} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.attachReceiptBtn}
              activeOpacity={0.7}
              onPress={handlePickReceipt}
            >
              <Camera size={14} color={colors.gold.champagne} />
              <Text style={styles.attachReceiptText}>+ Lampirkan Foto Struk / Bukti (Nota)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recurring Transaction Toggle (PRD Section 58) */}
        {!isEditMode && txType !== 'transfer' && (
          <View style={styles.recurringSection}>
            <View style={styles.recurringHeaderRow}>
              <View style={styles.recurringLeft}>
                <Repeat size={15} color={colors.gold.champagne} />
                <View>
                  <Text style={styles.recurringLabel}>Jadikan Transaksi Berulang</Text>
                  <Text style={styles.recurringSublabel}>Jadwalkan pencatatan otomatis & tagihan rutin</Text>
                </View>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={(val) => {
                  hapticSelection();
                  setIsRecurring(val);
                }}
                trackColor={{ false: colors.bg.highlight, true: colors.gold.primary }}
                thumbColor={colors.text.primary}
              />
            </View>

            {isRecurring && (
              <View style={styles.freqChipsRow}>
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => {
                  const isSelected = recurringFrequency === freq;
                  const label =
                    freq === 'daily'
                      ? 'Harian'
                      : freq === 'weekly'
                      ? 'Mingguan'
                      : freq === 'monthly'
                      ? 'Bulanan'
                      : 'Tahunan';

                  return (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.freqChip, isSelected && styles.freqChipSelected]}
                      onPress={() => {
                        hapticSelection();
                        setRecurringFrequency(freq);
                      }}
                    >
                      <Text style={[styles.freqChipText, isSelected && styles.freqChipTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Quick Favorite Templates (PRD Section 59) */}
        {!isEditMode && (
          <View style={styles.templatesSection}>
            <View style={styles.templateHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Sparkles size={11} color={colors.gold.champagne} />
                <Text style={styles.fieldLabelNoMargin}>TEMPLATE FAVORIT (1-TAP)</Text>
              </View>
              {amount > 0 && (
                <TouchableOpacity
                  style={styles.addTemplateHeaderBtn}
                  onPress={() => {
                    hapticSelection();
                    setTemplateNameInput(note || '');
                    setIsSaveTemplateModalOpen(true);
                  }}
                >
                  <Star size={11} color={colors.gold.champagne} />
                  <Text style={styles.addTemplateHeaderText}>+ Simpan Template</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateScroll}>
              {templates.map((tpl) => (
                <TouchableOpacity
                  key={tpl.id}
                  style={styles.templateChip}
                  onPress={() => handleApplyTemplate(tpl)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Bookmark size={9} color={colors.gold.champagne} />
                    <Text style={styles.templateChipTitle}>{tpl.name}</Text>
                  </View>
                  <Text style={styles.templateChipAmount}>{formatRupiah(tpl.templatePayload.amount)}</Text>
                </TouchableOpacity>
              ))}

              {templates.length === 0 &&
                [
                  { name: 'Kopi', amount: 25000, cat: 'Makanan' },
                  { name: 'Makan Siang', amount: 45000, cat: 'Makanan' },
                  { name: 'Bensin Motor', amount: 35000, cat: 'Transportasi' },
                  { name: 'Bensin Mobil', amount: 200000, cat: 'Transportasi' },
                  { name: 'Jajan Sore', amount: 20000, cat: 'Makanan' },
                ].map((tpl) => (
                  <TouchableOpacity
                    key={tpl.name}
                    style={styles.templateChip}
                    onPress={() => {
                      hapticSelection();
                      setAmount(tpl.amount);
                      setNote(tpl.name);
                      const matchingCat = categories.find((c) => c.name.toLowerCase().includes(tpl.cat.toLowerCase()));
                      if (matchingCat) setSelectedCategoryId(matchingCat.id);
                    }}
                  >
                    <Text style={styles.templateChipTitle}>{tpl.name}</Text>
                    <Text style={styles.templateChipAmount}>{formatRupiah(tpl.amount)}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        )}

        {/* Tactile Numeric Keypad */}
        <CustomKeypad value={amount} onChange={setAmount} />

        {/* Primary Save Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
          disabled={isSaving}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Menyimpan...' : isEditMode ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Save Template Modal (PRD Section 59) */}
      <Modal visible={isSaveTemplateModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Star size={16} color={colors.gold.champagne} />
                <Text style={styles.modalTitle}>Simpan Template Favorit</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSaveTemplateModalOpen(false)}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Simpan transaksi {formatRupiah(amount)} ini sebagai pintasan cepat 1-ketuk.
            </Text>

            <TextInput
              style={styles.templateNameInput}
              placeholder="Contoh: Kopi Kenangan Pagi..."
              placeholderTextColor={colors.text.muted}
              value={templateNameInput}
              onChangeText={setTemplateNameInput}
              maxLength={50}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsSaveTemplateModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveAsTemplate}
              >
                <Text style={styles.modalSaveText}>Simpan Template</Text>
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
    backgroundColor: '#12141D',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
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
  labelWithHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transferFeeTotalHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.flow.expense,
  },
  dateSelectorRow: {
    marginBottom: 14,
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  fieldLabelNoMargin: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#12141D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: colors.gold.champagne,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  dateChipTextSelected: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#12141D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
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
  templatesSection: {
    marginBottom: 14,
  },
  templateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  templateScroll: {
    gap: 8,
  },
  templateChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#12141D',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    alignItems: 'center',
  },
  templateChipTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  templateChipAmount: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gold.champagne,
    fontVariant: ['tabular-nums'],
  },
  recurringSection: {
    backgroundColor: '#12141D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    padding: 14,
    marginBottom: 14,
  },
  recurringHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recurringLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  recurringLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  recurringSublabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  freqChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  freqChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  freqChipSelected: {
    borderColor: colors.gold.primary,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  freqChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  freqChipTextSelected: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  addTemplateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  addTemplateHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#12141D',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 17,
    marginBottom: 16,
  },
  templateNameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.muted,
  },
  modalSaveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.gold.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#090A0E',
  },
  receiptSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  attachReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  attachReceiptText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold.champagne,
  },
  receiptPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  receiptPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  receiptThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  receiptAttachedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  receiptSubText: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  removeReceiptBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
});
