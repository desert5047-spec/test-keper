/**
 * UIトークン定義
 * Tailwind相当の色・文字スタイルを定数化
 */

// カラーパレット
export const colors = {
  // Blue系
  blue50: '#EFF6FF',
  blue100: '#DBEAFE',
  blue200: '#BFDBFE',
  blue300: '#93C5FD',
  blue400: '#60A5FA',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  blue700: '#1D4ED8',
  blue800: '#1E40AF',
  blue900: '#1E3A8A',

  // Gray系
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // その他
  white: '#FFFFFF',
  black: '#000000',
};

// テキストスタイル
export const textStyles = {
  // 見出し系
  heading: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    fontWeight: 600 as const,
    color: colors.blue900,
  },
  // 本文系
  body: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    fontWeight: 400 as const,
    color: colors.gray900,
  },
  bodyMedium: {
    fontSize: 14,
    fontFamily: 'Nunito-Medium',
    fontWeight: 500 as const,
    color: colors.gray900,
  },
  // 小さいテキスト
  small: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    fontWeight: 400 as const,
    color: colors.gray500,
  },
};

// カードスタイル
export const cardStyles = {
  monthSummaryCard: {
    backgroundColor: '#EEF6FF',
    borderColor: '#D8E5FF',
    borderWidth: 1,
  },
  screenBackground: '#F3F7FF',
};
