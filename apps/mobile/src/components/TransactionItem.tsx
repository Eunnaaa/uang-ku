import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
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
  Repeat,
  CloudOff,
  Check,
  Folder,
  Receipt,
} from 'lucide-react-native';
import { type TransactionModel, formatRupiah } from '@uangku/contracts';
import { colors, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/themeContext';

interface TransactionItemProps {
  transaction: TransactionModel;
  onPress?: () => void;
  onDelete?: () => void;
  onLongPress?: () => void;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
}

export function TransactionItem({
  transaction,
  onPress,
  onDelete,
  onLongPress,
  isMultiSelectMode,
  isSelected,
}: TransactionItemProps) {
  const { colors, isDark } = useTheme();
  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const isTransfer = transaction.type === 'transfer';

  const amountColor = isIncome
    ? colors.flow.income
    : isExpense
    ? colors.flow.expense
    : colors.flow.transfer;

  const amountPrefix = isIncome ? '+' : isExpense ? '-' : '';

  const renderIcon = () => {
    const iconName = transaction.category?.icon;
    const size = 18;
    const iconColor = amountColor;

    if (isTransfer) {
      return <Repeat size={size} color={iconColor} />;
    }

    switch (iconName) {
      case 'utensils':
        return <Utensils size={size} color={iconColor} />;
      case 'car':
        return <Car size={size} color={iconColor} />;
      case 'shopping-bag':
        return <ShoppingBag size={size} color={iconColor} />;
      case 'file-text':
        return <FileText size={size} color={iconColor} />;
      case 'film':
        return <Film size={size} color={iconColor} />;
      case 'heart':
        return <Heart size={size} color={iconColor} />;
      case 'book':
        return <Book size={size} color={iconColor} />;
      case 'briefcase':
        return <Briefcase size={size} color={iconColor} />;
      case 'gift':
        return <Gift size={size} color={iconColor} />;
      case 'laptop':
        return <Laptop size={size} color={iconColor} />;
      default:
        return isIncome ? (
          <TrendingUp size={size} color={iconColor} />
        ) : (
          <MoreHorizontal size={size} color={iconColor} />
        );
    }
  };

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(transaction.transactionDate));

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.container, isSelected && styles.containerSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {isMultiSelectMode && (
        <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
          {isSelected && <Check size={12} color="#090A0E" strokeWidth={3} />}
        </View>
      )}

      <View style={styles.iconContainer}>{renderIcon()}</View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {transaction.note || transaction.category?.name || 'Transaksi'}
          </Text>
          <Text style={[styles.amount, { color: amountColor }]}>
            {amountPrefix}
            {formatRupiah(transaction.amount)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.metaLeft}>
            <Text style={styles.accountText}>
              {isTransfer
                ? `${transaction.account?.name || 'Dompet'} → ${transaction.destinationAccount?.name || 'Tujuan'}`
                : transaction.account?.name || 'Dompet'}
            </Text>

            {/* Pocket Allocation Indicator (PRD Section 79.5) */}
            {Boolean(transaction.pocket?.name || (transaction as any).pocketName) && (
              <View style={styles.pocketBadge}>
                <Folder size={10} color={colors.gold.champagne} />
                <Text style={styles.pocketText} numberOfLines={1}>
                  {transaction.pocket?.name || (transaction as any).pocketName}
                </Text>
              </View>
            )}

            {/* Receipt / Invoice Indicator Badge */}
            {Boolean(transaction.receiptUrl || (transaction as any).receiptUri) && (
              <View style={styles.receiptBadge}>
                <Receipt size={10} color={colors.gold.champagne} />
                <Text style={styles.receiptBadgeText}>Nota</Text>
              </View>
            )}

            {/* Bank Mutation Verified Indicator */}
            {Boolean(transaction.isBankVerified || (transaction as any).sourceType === 'bank_sync') && (
              <View style={styles.bankVerifiedBadge}>
                <Check size={9} color={colors.flow.income} strokeWidth={2.5} />
                <Text style={styles.bankVerifiedText}>Bank</Text>
              </View>
            )}

            {isTransfer && transaction.transferFee ? (
              <Text style={styles.feeText}>
                +{formatRupiah(transaction.transferFee)}
              </Text>
            ) : null}

            {(transaction.syncStatus === 'pending_sync' || (transaction.syncStatus as any) === 'pending') && (
              <View style={styles.pendingBadge}>
                <CloudOff size={10} color={colors.gold.champagne} />
                <Text style={styles.pendingText}>Lokal</Text>
              </View>
            )}
          </View>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.bg.surface,
      borderRadius: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    iconContainer: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 83, 9, 0.08)',
      borderWidth: 0.8,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.18)' : 'rgba(180, 83, 9, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },
    content: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    title: {
      fontSize: 14.5,
      fontWeight: '600',
      color: colors.text.primary,
      flex: 1,
      marginRight: 8,
      letterSpacing: -0.2,
    },
    amount: {
      fontSize: 14.5,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.2,
    },
    bottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metaLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    accountText: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    pocketBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(180, 83, 9, 0.1)',
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 6,
      maxWidth: 110,
    },
    pocketText: {
      fontSize: 10,
      color: colors.gold.champagne,
      fontWeight: '600',
    },
    receiptBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(180, 83, 9, 0.08)',
      paddingHorizontal: 5,
      paddingVertical: 1.5,
      borderRadius: 6,
      gap: 3,
    },
    receiptBadgeText: {
      fontSize: 9.5,
      color: colors.gold.champagne,
      fontWeight: '600',
    },
    bankVerifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(5, 150, 105, 0.12)',
      paddingHorizontal: 5,
      paddingVertical: 1.5,
      borderRadius: 6,
      gap: 2,
    },
    bankVerifiedText: {
      fontSize: 9.5,
      color: colors.flow.income,
      fontWeight: '700',
    },
    feeText: {
      fontSize: 11,
      color: colors.text.muted,
    },
    pendingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(180, 83, 9, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      gap: 3,
    },
    pendingText: {
      fontSize: 10,
      color: colors.gold.champagne,
      fontWeight: '600',
    },
    dateText: {
      fontSize: 12,
      color: colors.text.muted,
    },
    containerSelected: {
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 83, 9, 0.08)',
      borderColor: isDark ? 'rgba(212, 175, 55, 0.35)' : 'rgba(180, 83, 9, 0.3)',
    },
    selectCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    selectCircleActive: {
      backgroundColor: colors.gold.primary,
      borderColor: colors.gold.primary,
    },
  });
