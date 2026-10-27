import React from 'react';
import {
  Target,
  Shield,
  Home,
  Car,
  Plane,
  Laptop,
  GraduationCap,
  Coins,
  Heart,
  Gift,
  Users,
  User,
  ShoppingBag,
  Utensils,
  Zap,
  Book,
  Briefcase,
  Folder,
  FolderHeart,
  Wallet,
  CreditCard,
  Landmark,
  FileText,
  Receipt,
  Link,
  Globe,
  Lock,
  Sparkles,
  Star,
  Smile,
  Crown,
  Award,
  Bell,
  Check,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  Archive,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react-native';
import { colors } from '../theme/colors';

// Map of canonical icon keys to Lucide components
export const ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  shield: Shield,
  home: Home,
  car: Car,
  plane: Plane,
  laptop: Laptop,
  'graduation-cap': GraduationCap,
  coins: Coins,
  heart: Heart,
  gift: Gift,
  users: Users,
  user: User,
  'shopping-bag': ShoppingBag,
  utensils: Utensils,
  zap: Zap,
  book: Book,
  briefcase: Briefcase,
  folder: Folder,
  'folder-heart': FolderHeart,
  wallet: Wallet,
  'credit-card': CreditCard,
  landmark: Landmark,
  'file-text': FileText,
  receipt: Receipt,
  link: Link,
  globe: Globe,
  lock: Lock,
  sparkles: Sparkles,
  star: Star,
  smile: Smile,
  crown: Crown,
  award: Award,
  bell: Bell,
  check: Check,
  'check-circle': CheckCircle2,
  alert: AlertTriangle,
  coffee: Coffee,
  archive: Archive,
};

// Comprehensive emoji-to-canonical-icon fallback map
export const EMOJI_TO_ICON_KEY: Record<string, string> = {
  '🎯': 'target',
  '🏡': 'home',
  '🏠': 'home',
  '🚗': 'car',
  '✈️': 'plane',
  '🏖️': 'plane',
  '🌴': 'plane',
  '💻': 'laptop',
  '💍': 'gift',
  '🎓': 'graduation-cap',
  '🛡️': 'shield',
  '🛡': 'shield',
  '💰': 'coins',
  '👶': 'heart',
  '🤝': 'users',
  '👤': 'user',
  '👩': 'user',
  '👨': 'user',
  '😎': 'smile',
  '🌟': 'star',
  '🦊': 'zap',
  '🚀': 'zap',
  '⚡️': 'zap',
  '⚡': 'zap',
  '👑': 'crown',
  '🦄': 'sparkles',
  '🦁': 'award',
  '🍜': 'utensils',
  '🍱': 'utensils',
  '☕': 'coffee',
  '🛒': 'shopping-bag',
  '📚': 'book',
  '📦': 'archive',
  '📁': 'folder',
  '🧾': 'receipt',
  '💳': 'credit-card',
  '🏦': 'landmark',
  '📄': 'file-text',
  '🔗': 'link',
  '🌐': 'globe',
  '🔒': 'lock',
  '✨': 'sparkles',
  '🎉': 'sparkles',
  '🔔': 'bell',
  '⚠️': 'alert',
  '✓': 'check',
};

export const GOAL_ICON_KEYS = [
  'target',
  'home',
  'car',
  'plane',
  'laptop',
  'graduation-cap',
  'shield',
  'coins',
  'heart',
  'gift',
] as const;

export const POCKET_ICON_KEYS = [
  'users',
  'wallet',
  'shopping-bag',
  'utensils',
  'zap',
  'shield',
  'car',
  'plane',
  'gift',
  'home',
  'book',
  'briefcase',
] as const;

export const AVATAR_ICON_KEYS = [
  'user',
  'smile',
  'star',
  'crown',
  'award',
  'zap',
  'heart',
  'sparkles',
] as const;

export interface AppIconProps {
  name?: string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: any;
  defaultFallback?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 18,
  color = colors.gold.champagne,
  strokeWidth = 2,
  style,
  defaultFallback = 'folder',
}) => {
  const normalizedKey = React.useMemo(() => {
    if (!name || typeof name !== 'string') return defaultFallback;
    const trimmed = name.trim();
    if (ICON_MAP[trimmed]) return trimmed;
    if (EMOJI_TO_ICON_KEY[trimmed]) return EMOJI_TO_ICON_KEY[trimmed];
    // Check if key is lowercase
    const lower = trimmed.toLowerCase();
    if (ICON_MAP[lower]) return lower;
    return defaultFallback;
  }, [name, defaultFallback]);

  const IconComponent = ICON_MAP[normalizedKey] || CircleHelp;

  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} style={style} />;
};

export default AppIcon;
