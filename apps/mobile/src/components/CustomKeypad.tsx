import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Delete } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { hapticLight, hapticSelection } from '../theme/haptics';

interface CustomKeypadProps {
  value: number;
  onChange: (value: number) => void;
  onDone?: () => void;
}

export function CustomKeypad({ value, onChange, onDone }: CustomKeypadProps) {
  const handlePressDigit = (digit: string) => {
    hapticLight();
    const str = value === 0 ? digit : `${value}${digit}`;
    const num = parseInt(str, 10);
    // Max constraint: 999 milyar
    if (!isNaN(num) && num <= 999_999_999_999) {
      onChange(num);
    }
  };

  const handleBackspace = () => {
    hapticLight();
    const str = value.toString();
    if (str.length <= 1) {
      onChange(0);
    } else {
      onChange(parseInt(str.slice(0, -1), 10));
    }
  };

  const handleQuickAdd = (added: number) => {
    hapticSelection();
    const next = value + added;
    if (next <= 999_999_999_999) {
      onChange(next);
    }
  };

  return (
    <View style={styles.container}>
      {/* Quick Amount Suggestion Chips */}
      <View style={styles.chipsRow}>
        {[10_000, 50_000, 100_000, 500_000].map((amount) => (
          <TouchableOpacity
            key={amount}
            activeOpacity={0.7}
            style={styles.chip}
            onPress={() => handleQuickAdd(amount)}
          >
            <Text style={styles.chipText}>+{amount >= 1_000_000 ? `${amount / 1_000_000}jt` : `${amount / 1_000}rb`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 3x4 Grid */}
      <View style={styles.grid}>
        <View style={styles.row}>
          {['1', '2', '3'].map((d) => (
            <TouchableOpacity key={d} style={styles.key} activeOpacity={0.6} onPress={() => handlePressDigit(d)}>
              <Text style={styles.keyText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          {['4', '5', '6'].map((d) => (
            <TouchableOpacity key={d} style={styles.key} activeOpacity={0.6} onPress={() => handlePressDigit(d)}>
              <Text style={styles.keyText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          {['7', '8', '9'].map((d) => (
            <TouchableOpacity key={d} style={styles.key} activeOpacity={0.6} onPress={() => handlePressDigit(d)}>
              <Text style={styles.keyText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <TouchableOpacity style={styles.key} activeOpacity={0.6} onPress={() => handlePressDigit('000')}>
            <Text style={[styles.keyText, { fontSize: 18, letterSpacing: 1 }]}>000</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} activeOpacity={0.6} onPress={() => handlePressDigit('0')}>
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.key, styles.backspaceKey]} activeOpacity={0.6} onPress={handleBackspace}>
            <Delete color={colors.gold.champagne} size={22} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.bg.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    color: colors.gold.champagne,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  key: {
    flex: 1,
    height: 56,
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backspaceKey: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderColor: colors.gold.hairline,
  },
  keyText: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
