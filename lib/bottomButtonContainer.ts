import { Platform } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

/**
 * bottomButtonContainer の共通スタイル。
 * 画面下部に固定する保存ボタン用コンテナに使用。
 *
 * 仕様:
 * - Android: bottom -2, paddingBottom insets.bottom + 6
 * - iOS: bottom 0, paddingBottom insets.bottom + 10
 */
export function getBottomButtonContainerStyle(
  insets: EdgeInsets,
  layout: 'row' | 'column'
): {
  position: 'absolute';
  bottom: number;
  left: number;
  right: number;
  paddingHorizontal: number;
  paddingTop: number;
  paddingBottom: number;
  flexDirection: 'row' | 'column';
  justifyContent?: 'flex-end';
  alignItems: 'center' | 'stretch';
} {
  return {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? -2 : 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom:
      Platform.OS === 'android' ? insets.bottom + 6 : insets.bottom + 10,
    flexDirection: layout,
    ...(layout === 'row'
      ? { justifyContent: 'flex-end' as const, alignItems: 'center' as const }
      : { alignItems: 'stretch' as const }),
  };
}
