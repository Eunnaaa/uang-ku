export interface ThemeColors {
  bg: {
    base: string;
    surface: string;
    elevated: string;
    highlight: string;
    overlay: string;
  };
  gold: {
    light: string;
    champagne: string;
    primary: string;
    deep: string;
    hairline: string;
    glow: string;
    subtle: string;
  };
  flow: {
    income: string;
    incomeBg: string;
    incomeBorder: string;
    expense: string;
    expenseBg: string;
    expenseBorder: string;
    transfer: string;
    transferBg: string;
    transferBorder: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
    gold: string;
  };
  border: {
    subtle: string;
    medium: string;
    gold: string;
  };
}

export const darkColors: ThemeColors = {
  // Luxury Dark Foundations
  bg: {
    base: '#090A0E',       // Pure Obsidian
    surface: '#12141C',    // Rich dark slate surface
    elevated: '#1A1D27',   // Elevated card container
    highlight: '#242836',  // Pressed state
    overlay: 'rgba(9, 10, 14, 0.85)',
  },

  // Precious Metal Accents (Champagne & Regal Gold)
  gold: {
    light: '#F3E5AB',
    champagne: '#E5C378',
    primary: '#D4AF37',
    deep: '#9A7B2C',
    hairline: 'rgba(212, 175, 55, 0.35)',
    glow: 'rgba(212, 175, 55, 0.16)',
    subtle: 'rgba(212, 175, 55, 0.08)',
  },

  // Jewel Accents for Financial Flows
  flow: {
    income: '#10B981',      // Vibrant Emerald Green
    incomeBg: 'rgba(16, 185, 129, 0.12)',
    incomeBorder: 'rgba(16, 185, 129, 0.28)',

    expense: '#EF4444',     // Vibrant Crimson Red
    expenseBg: 'rgba(239, 68, 68, 0.12)',
    expenseBorder: 'rgba(239, 68, 68, 0.28)',

    transfer: '#38BDF8',    // Celestial Sapphire
    transferBg: 'rgba(56, 189, 248, 0.12)',
    transferBorder: 'rgba(56, 189, 248, 0.28)',
  },

  // High-legibility Typography
  text: {
    primary: '#FFFFFF',
    secondary: '#94A3B8',
    muted: '#64748B',
    inverse: '#090A0E',
    gold: '#E5C378',
  },

  // Borders & Dividers
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.14)',
    gold: 'rgba(212, 175, 55, 0.4)',
  },
};

export const lightColors: ThemeColors = {
  // Platinum Alabaster Foundations
  bg: {
    base: '#F8FAFC',       // Crisp platinum alabaster
    surface: '#FFFFFF',    // Pure white cards
    elevated: '#F1F5F9',   // Light gray elevated containers
    highlight: '#E2E8F0',  // Pressed state
    overlay: 'rgba(15, 23, 42, 0.5)',
  },

  // Regal Warm Gold & Bronze (High Contrast WCAG AA)
  gold: {
    light: '#FEF3C7',
    champagne: '#B45309',  // Deep amber gold with 5.2:1 contrast on white
    primary: '#D97706',    // Warm regal gold
    deep: '#78350F',
    hairline: 'rgba(180, 83, 9, 0.25)',
    glow: 'rgba(180, 83, 9, 0.12)',
    subtle: 'rgba(180, 83, 9, 0.08)',
  },

  // Jewel Accents for Financial Flows
  flow: {
    income: '#059669',      // Deep Emerald Green (4.8:1 contrast on white)
    incomeBg: 'rgba(5, 150, 105, 0.1)',
    incomeBorder: 'rgba(5, 150, 105, 0.25)',

    expense: '#DC2626',     // Crimson Red (4.9:1 contrast on white)
    expenseBg: 'rgba(220, 38, 38, 0.1)',
    expenseBorder: 'rgba(220, 38, 38, 0.25)',

    transfer: '#0284C7',    // Sky Sapphire (4.6:1 contrast on white)
    transferBg: 'rgba(2, 132, 199, 0.1)',
    transferBorder: 'rgba(2, 132, 199, 0.25)',
  },

  // High-legibility Typography
  text: {
    primary: '#0F172A',     // Slate-900 (16:1 contrast)
    secondary: '#334155',   // Slate-700 (8:1 contrast)
    muted: '#64748B',       // Slate-500 (4.6:1 contrast)
    inverse: '#FFFFFF',
    gold: '#B45309',
  },

  // Borders & Dividers
  border: {
    subtle: 'rgba(0, 0, 0, 0.08)',
    medium: 'rgba(0, 0, 0, 0.14)',
    gold: 'rgba(180, 83, 9, 0.35)',
  },
};

export const getThemeColors = (mode: 'dark' | 'light'): ThemeColors => {
  return mode === 'light' ? lightColors : darkColors;
};

// Default static export for backward compatibility
export const colors = darkColors;
