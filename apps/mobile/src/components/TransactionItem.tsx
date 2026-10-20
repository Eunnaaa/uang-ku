import React from 'react';
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
} from 'lucide-react-native';
import { type TransactionModel, formatRupiah } from '@uangku/contracts';
import { colors } from '../theme/colors';

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
  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const isTransfer = transaction.type === 'transfer';

  // Dynamic icon selector matching cash flow color
  const renderIcon = (color: string) => {
    const iconName = transaction.category?.icon;
    const size = 17;

    switch (iconName) {
      case 'utensils':
        return <Utensils color={color} size={size} />;
      case 'car':
        return <Car color={color} size={size} />;
      case 'shopping-bag':
        return <ShoppingBag color={color} size={size} />;
      case 'file-text':
        return <FileText color={color} size={size} />;
      case 'film':
        return <Film color={color} size={size} />;
      case 'heart':
        return <Heart color={color} size={size} />;
      case 'book':
        return <Book color={color} size={size} />;
      case 'briefcase':
        return <Briefcase color={color} size={size} />;
      case 'gift':
        return <Gift color={color} size={size} />;
      case 'laptop':
        return <Laptop color={color} size={size} />;
      case 'trending-up':
        return <TrendingUp color={color} size={size} />;
      case 'repeat':
        return <Repeat color={color} size={size} />;
      default:
        return isTransfer ? <Repeat color={color} size={size} /> : <MoreHorizontal color={color} size={size} />;
    }
  };

  const amountColor = isIncome
    ? colors.flow.income
    : isExpense
    ? colors.flow.expense
    : colors.flow.transfer;

  const iconColor = amountColor;
  const iconBg = isIncome
    ? colors.flow.incomeBg
    : isExpense
    ? colors.flow.expenseBg
    : colors.flow.transferBg;
  const iconBorder = isIncome
    ? colors.flow.incomeBorder
    : isExpense
    ? colors.flow.expenseBorder
    : colors.flow.transferBorder;

  const prefix = isIncome ? '+' : isExpense ? '-' : '';

  const accountLabel = isTransfer
    ? `${transaction.account?.name || 'Asal'} → ${transaction.destinationAccount?.name || 'Tujuan'}`
    : transaction.account?.name || 'Kas';

  const title = isTransfer
    ? (transaction.note || 'Transfer Antar Akun')
    : (transaction.category?.name || transaction.note || 'Transaksi');

  const formattedDate = new Date(transaction.transactionDate).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress || onDelete}
      style={[styles.container, isSelected && styles.containerSelected]}
    >
      {isMultiSelectMode && (
        <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
          {isSelected && <Check size={11} color="#090A0E" strokeWidth={3} />}
        </View>
      )}

      <View style={[styles.iconContainer, { backgroundColor: iconBg, borderColor: iconBorder }]}>
        {renderIcon(iconColor)}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.amount, { color: amountColor }]}>
            {prefix}{formatRupiah(transaction.amount)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.metaLeft}>
            <Text style={styles.accountText}>{accountLabel}</Text>
            {transaction.transferFee > 0 && (
              <Text style={styles.feeText}>+fee {formatRupiah(transaction.transferFee)}</Text>
            )}
            {transaction.syncStatus === 'pending_sync' && (
              <View style={styles.pendingBadge}>
                <CloudOff size={10} color={colors.gold.champagne} />
                <Text style={styles.pendingText}>Offline</Text>
              </View>
            )}
          </View>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
    backgroundColor: '#12141D',
    borderRadius: 18,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
  feeText: {
    fontSize: 11,
    color: colors.text.muted,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
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
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  selectCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectCircleActive: {
    backgroundColor: colors.gold.primary,
    borderColor: colors.gold.primary,
  },
});
