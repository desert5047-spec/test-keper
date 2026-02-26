import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Android 3ボタンなどで insets.bottom が 0/不足する場合に備えて、
 * bottom余白の最低保証を行う。
 */
export function useSafeBottom(minAndroid = 16) {
  const insets = useSafeAreaInsets();

  const safeBottom =
    Platform.OS === "android" ? Math.max(insets.bottom, minAndroid) : insets.bottom;

  return { insets, safeBottom };
}

