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
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  Tag,
  Search,
  Lock,
  Edit3,
  Trash2,
  X,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Utensils,
  Car,
  ShoppingBag,
  FileText,
  Film,
  Heart,
  Book,
  Briefcase,
  Gift,
  Laptop,
  MoreHorizontal,
  Home,
  Coffee,
  Plane,
  Smartphone,
  Music,
} from 'lucide-react-native';
import { type CategoryModel } from '@uangku/contracts';
import { colors, type ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/themeContext';
import {
  getLocalCategories,
  insertLocalCategory,
  updateLocalCategory,
  archiveLocalCategory,
} from '../../src/db/sqlite';
import { hapticMedium, hapticSelection, hapticSuccess, hapticError, hapticLight } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

const CATEGORY_ICON_PRESETS = [
  { name: 'utensils', label: 'Kuliner', icon: Utensils },
  { name: 'coffee', label: 'Kopi', icon: Coffee },
  { name: 'car', label: 'Transport', icon: Car },
  { name: 'shopping-bag', label: 'Belanja', icon: ShoppingBag },
  { name: 'home', label: 'Rumah', icon: Home },
  { name: 'file-text', label: 'Tagihan', icon: FileText },
  { name: 'film', label: 'Hiburan', icon: Film },
  { name: 'heart', label: 'Kesehatan', icon: Heart },
  { name: 'book', label: 'Pendidikan', icon: Book },
  { name: 'plane', label: 'Liburan', icon: Plane },
  { name: 'briefcase', label: 'Pekerjaan', icon: Briefcase },
  { name: 'laptop', label: 'Freelance', icon: Laptop },
  { name: 'gift', label: 'Hadiah', icon: Gift },
  { name: 'smartphone', label: 'Pulsa', icon: Smartphone },
  { name: 'music', label: 'Langganan', icon: Music },
  { name: 'more-horizontal', label: 'Lainnya', icon: MoreHorizontal },
];

export default function CategoriesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Category Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [newCatIcon, setNewCatIcon] = useState('tag');

  // Edit Category Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryModel | null>(null);
  const [editCatName, setEditCatName] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const list = await getLocalCategories();
      setCategories(list);
    } catch (err: any) {
      toast.showError('Gagal Memuat Kategori', err.message);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) {
      toast.showWarning('Nama Kategori', 'Nama kategori tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      await insertLocalCategory({
        name: newCatName.trim(),
        type: newCatType,
      });

      hapticSuccess();
      toast.showSuccess('Kategori Ditambahkan', newCatName.trim());
      setNewCatName('');
      setIsAddModalOpen(false);
      await loadCategories();
    } catch (err: any) {
      hapticError();
      toast.showError('Gagal Menyimpan', err.message);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCat || !editCatName.trim()) {
      toast.showWarning('Nama Kategori', 'Nama kategori tidak boleh kosong.');
      return;
    }

    try {
      hapticMedium();
      await updateLocalCategory(editingCat.id, {
        name: editCatName.trim(),
      });

      hapticSuccess();
      toast.showSuccess('Kategori Diperbarui', editCatName.trim());
      setIsEditModalOpen(false);
      setEditingCat(null);
      await loadCategories();
    } catch (err: any) {
      hapticError();
      toast.showError('Gagal Memperbarui', err.message);
    }
  };

  const handleArchive = (cat: CategoryModel) => {
    if (cat.isSystem) {
      toast.showWarning('Kategori Sistem', 'Kategori bawaan sistem tidak dapat diarsipkan.');
      return;
    }

    hapticLight();
    Alert.alert(
      'Arsipkan Kategori',
      `Yakin ingin mengarsipkan "${cat.name}"? Kategori ini tidak akan muncul di form input baru, namun riwayat transaksi lama tetap aman.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Arsipkan',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticSuccess();
              await archiveLocalCategory(cat.id);
              toast.showSuccess('Kategori Diarsipkan', cat.name);
              await loadCategories();
            } catch (err: any) {
              hapticError();
              toast.showError('Gagal Mengarsipkan', err.message);
            }
          },
        },
      ]
    );
  };

  const filteredCategories = categories.filter((c) => {
    const matchType = c.type === activeTab;
    const matchSearch =
      !searchQuery.trim() ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchType && matchSearch;
  });

  const expenseCount = categories.filter((c) => c.type === 'expense').length;
  const incomeCount = categories.filter((c) => c.type === 'income').length;
  const systemCount = categories.filter((c) => c.isSystem).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              hapticSelection();
              router.back();
            }}
          >
            <ChevronLeft size={22} color={colors.gold.champagne} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Kategori Transaksi</Text>
            <Text style={styles.headerSubtitle}>Kelola Kategori & Ikon Keuangan</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setNewCatType(activeTab);
            setIsAddModalOpen(true);
          }}
        >
          <Plus size={14} color={isDark ? '#090A0E' : '#FFFFFF'} />
          <Text style={styles.addBtnText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.champagne}
          />
        }
      >
        {/* Metric Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Total Kategori</Text>
              <Text style={styles.summaryValue}>{categories.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Bawaan Sistem</Text>
              <Text style={styles.summaryValueSub}>{systemCount} Default</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Kustom Anda</Text>
              <Text style={styles.summaryValueGold}>{categories.length - systemCount} Kustom</Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'expense' && styles.tabBtnActiveExpense]}
            onPress={() => {
              hapticSelection();
              setActiveTab('expense');
            }}
          >
            <TrendingDown
              size={14}
              color={activeTab === 'expense' ? colors.flow.expense : colors.text.muted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'expense' && styles.tabTextActive,
              ]}
            >
              Pengeluaran ({expenseCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'income' && styles.tabBtnActiveIncome]}
            onPress={() => {
              hapticSelection();
              setActiveTab('income');
            }}
          >
            <TrendingUp
              size={14}
              color={activeTab === 'income' ? colors.flow.income : colors.text.muted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'income' && styles.tabTextActive,
              ]}
            >
              Pemasukan ({incomeCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Search size={16} color={colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama kategori..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories List */}
        <View style={styles.categoryList}>
          {filteredCategories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Tag size={28} color={colors.text.muted} />
              <Text style={styles.emptyTitle}>Kategori Tidak Ditemukan</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `Tidak ada kategori "${searchQuery}" pada kelompok ${activeTab}.`
                  : 'Belum ada kategori pada kelompok ini.'}
              </Text>
            </View>
          ) : (
            filteredCategories.map((cat, index) => {
              return (
                <View
                  key={cat.id}
                  style={[styles.catRow, index > 0 && styles.catRowBorder]}
                >
                  <View style={styles.catLeft}>
                    <View
                      style={[
                        styles.catIconCircle,
                        cat.type === 'expense'
                          ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' }
                          : { backgroundColor: 'rgba(16, 185, 129, 0.12)' },
                      ]}
                    >
                      <Tag
                        size={15}
                        color={
                          cat.type === 'expense'
                            ? colors.flow.expense
                            : colors.flow.income
                        }
                      />
                    </View>
                    <View style={styles.catInfoCol}>
                      <View style={styles.catTitleRow}>
                        <Text style={styles.catName}>{cat.name}</Text>
                        {cat.isSystem ? (
                          <View style={styles.systemBadge}>
                            <Lock size={9} color={colors.text.muted} />
                            <Text style={styles.systemBadgeText}>Sistem</Text>
                          </View>
                        ) : (
                          <View style={styles.customBadge}>
                            <Text style={styles.customBadgeText}>Kustom</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.catSubtext}>
                        {cat.type === 'expense' ? 'Kategori Beban' : 'Kategori Penerimaan'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.catActions}>
                    {!cat.isSystem ? (
                      <>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => {
                            hapticSelection();
                            setEditingCat(cat);
                            setEditCatName(cat.name);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <Edit3 size={14} color={colors.gold.champagne} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, styles.deleteBtn]}
                          onPress={() => handleArchive(cat)}
                        >
                          <Trash2 size={14} color={colors.flow.expense} />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.protectedPill}>
                        <Text style={styles.protectedText}>Terkunci</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add Category Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsAddModalOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Kategori Baru</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Type Switcher */}
              <View style={styles.typeSwitcher}>
                <TouchableOpacity
                  style={[styles.typeBtn, newCatType === 'expense' && styles.typeBtnActiveExpense]}
                  onPress={() => {
                    hapticSelection();
                    setNewCatType('expense');
                  }}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      newCatType === 'expense' && styles.typeBtnTextActive,
                    ]}
                  >
                    Pengeluaran
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, newCatType === 'income' && styles.typeBtnActiveIncome]}
                  onPress={() => {
                    hapticSelection();
                    setNewCatType('income');
                  }}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      newCatType === 'income' && styles.typeBtnTextActive,
                    ]}
                  >
                    Pemasukan
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NAMA KATEGORI</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="cth. Laundry, Kopi & Nongkrong, Servis Kendaraan"
                  placeholderTextColor={colors.text.muted}
                  value={newCatName}
                  onChangeText={setNewCatName}
                  autoFocus
                />
              </View>

              {/* Icon Presets Quick Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>IKON REKOMENDASI</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetIconsRow}>
                  {CATEGORY_ICON_PRESETS.map((preset) => {
                    const IconComp = preset.icon;
                    return (
                      <TouchableOpacity
                        key={preset.name}
                        style={styles.iconPresetPill}
                        onPress={() => {
                          hapticSelection();
                          if (!newCatName) setNewCatName(preset.label);
                        }}
                      >
                        <IconComp size={14} color={colors.gold.champagne} />
                        <Text style={styles.iconPresetLabel}>{preset.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={styles.saveSubmitBtn}
                activeOpacity={0.8}
                onPress={handleSaveCategory}
              >
                <Sparkles size={16} color={isDark ? '#090A0E' : '#FFFFFF'} />
                <Text style={styles.saveSubmitText}>Simpan Kategori</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Category Modal */}
      <Modal visible={isEditModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissOverlay}
            activeOpacity={1}
            onPress={() => setIsEditModalOpen(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Kategori</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NAMA KATEGORI</Text>
                <TextInput
                  style={styles.textInput}
                  value={editCatName}
                  onChangeText={setEditCatName}
                  placeholderTextColor={colors.text.muted}
                />
              </View>

              <TouchableOpacity
                style={styles.saveSubmitBtn}
                activeOpacity={0.8}
                onPress={handleUpdateCategory}
              >
                <Sparkles size={16} color={isDark ? '#090A0E' : '#FFFFFF'} />
                <Text style={styles.saveSubmitText}>Perbarui Kategori</Text>
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
    backgroundColor: colors.bg.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.text.muted,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDark ? '#090A0E' : '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.subtle,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  summaryValueSub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  summaryValueGold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActiveExpense: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  tabBtnActiveIncome: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text.primary,
  },
  categoryList: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  catRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catInfoCol: {
    flex: 1,
  },
  catTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  systemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  systemBadgeText: {
    fontSize: 9,
    color: colors.text.muted,
    fontWeight: '600',
  },
  customBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customBadgeText: {
    fontSize: 9,
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  catSubtext: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  catActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.bg.elevated,
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  protectedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.bg.elevated,
  },
  protectedText: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalDismissOverlay: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.subtle,
    alignSelf: 'center',
    marginVertical: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.bg.elevated,
  },
  modalBody: {
    gap: 16,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    padding: 3,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  typeBtnActiveExpense: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  typeBtnActiveIncome: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  typeBtnTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.text.muted,
  },
  textInput: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  presetIconsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  iconPresetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  iconPresetLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  saveSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  saveSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: isDark ? '#090A0E' : '#FFFFFF',
  },
});
