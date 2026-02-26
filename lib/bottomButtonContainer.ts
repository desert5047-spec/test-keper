import type { EdgeInsets } from 'react-native-safe-area-context';

/** 保存ボタン高さ */
const SAVE_BUTTON_HEIGHT = 44;

/** 固定フッターの paddingTop */
const FOOTER_PADDING_TOP = 10;

/**
 * 固定フッター（画面下部）のスタイル。
 * 記録・編集両画面で同一レイアウトに統一。
 * 白塗りなし、保存ボタンのみ表示。
 */
export function getFooterStyle(insets: EdgeInsets): {
  position: 'absolute';
  left: number;
  right: number;
  bottom: number;
  paddingHorizontal: number;
  paddingTop: number;
  paddingBottom: number;
} {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: FOOTER_PADDING_TOP,
    paddingBottom: Math.max(insets.bottom, 12),
  };
}

/**
 * ScrollView の contentContainerStyle.paddingBottom 用。
 * 固定フッターでコンテンツが隠れないよう余白を確保する。
 */
export function getScrollPaddingBottom(insets: EdgeInsets): number {
  const footerHeight =
    SAVE_BUTTON_HEIGHT + FOOTER_PADDING_TOP + Math.max(insets.bottom, 12);
  return footerHeight + 12;
}
