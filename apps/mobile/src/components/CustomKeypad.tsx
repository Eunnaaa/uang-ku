import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Delete } from 'lucide-react-native';
import { colors, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/themeContext';
import { hapticLight, hapticSelection } from '../theme/haptics';

interface CustomKeypadProps {
  value: number;
  onChange: (value: number) => void;
  onDone?: () => void;
}

export function CustomKeypad({ value, onChange, onDone }: CustomKeypadProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

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
            <Delete color={colors.gold.champagne} size={20} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 2,
    paddingBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(212, 175, 55, 0.22)' : 'rgba(180, 83, 9, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 3,
    elevation: isDark ? 0 : 1,
  },
  chipText: {
    color: colors.gold.champagne,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  key: {
    flex: 1,
    height: 52,
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 3,
    elevation: isDark ? 0 : 1,
  },
  backspaceKey: {
    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 83, 9, 0.08)',
    borderColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(180, 83, 9, 0.2)',
  },
  keyText: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
