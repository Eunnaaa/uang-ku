import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors } from '../theme/colors';

interface LuxuryCardProps extends ViewProps {
  variant?: 'gold' | 'default' | 'elevated';
  children: React.ReactNode;
}

export function LuxuryCard({ variant = 'default', style, children, ...props }: LuxuryCardProps) {
  const borderStyle =
    variant === 'gold'
      ? { borderColor: colors.gold.hairline, backgroundColor: 'rgba(20, 22, 30, 0.95)' }
      : variant === 'elevated'
      ? { borderColor: colors.border.medium, backgroundColor: colors.bg.elevated }
      : { borderColor: colors.border.subtle, backgroundColor: colors.bg.surface };

  return (
    <View style={[styles.card, borderStyle, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
});
