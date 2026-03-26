import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSubmit: (t: string) => void;
  placeholder?: string;
  maxLength?: number;
  onPressEmoji?: () => void;
  submitLabel?: string;
  onBlur?: () => void;
  onClose?: () => void;
  autoFocus?: boolean;
};

export const CommentComposer = React.forwardRef<TextInput, Props>(function CommentComposer({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'コメントを追加',
  maxLength,
  onBlur,
  onClose,
  autoFocus = false,
}, ref) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const isIOS = Platform.OS === 'ios';

  const inputRef = useRef<TextInput>(null);
  const [keyboardTopY, setKeyboardTopY] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const normalizeAndroid = useCallback((s: string) =>
    Platform.OS === 'android' ? s.replace(/[\r\n]+/g, '') : s, []);

  const handleChangeText = useCallback((t: string) => {
    const cleaned = normalizeAndroid(t);

    if (Platform.OS === 'android' && cleaned !== t) {
      inputRef.current?.setNativeProps({ text: cleaned });
    }

    onChangeText(cleaned);
  }, [onChangeText, normalizeAndroid]);

  // iOS: KeyboardAvoidingView の親がキーボード対応するため、ここではアニメーションしない
  // Android: 自前で androidLift により位置調整

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e: any) => {
      const topY = e?.endCoordinates?.screenY;
      setKeyboardTopY(typeof topY === 'number' ? topY : null);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardTopY(null);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const canSubmit = useMemo(() => value.trim().length > 0, [value]);
  const gap = 4;
  const androidLift = keyboardTopY == null ? 0 : Math.max(0, windowH - keyboardTopY + gap);

  const handleSubmit = () => {
    const v = normalizeAndroid(value).trim();
    if (!v) return;
    onSubmit(v);
    Keyboard.dismiss();
  };

  const handleDonePress = () => {
    Keyboard.dismiss();
    setIsFocused(false);
    onClose?.();
  };

  const mergedRef = useCallback(
    (instance: TextInput | null) => {
      (inputRef as React.MutableRefObject<TextInput | null>).current = instance;
      if (typeof ref === 'function') ref(instance);
      else if (ref) (ref as React.MutableRefObject<TextInput | null>).current = instance;
    },
    [ref]
  );

  const androidSingleLineStyle =
    Platform.OS === 'android'
      ? {
          height: 44,
          paddingVertical: 0,
          textAlignVertical: 'center' as const,
          includeFontPadding: false,
        }
      : {};

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          bottom: 0,
          paddingBottom: Platform.OS === 'ios' ? 0 : Math.max(insets.bottom, 8),
          transform: [{ translateY: isIOS ? 0 : -androidLift }],
        },
      ]}>
      <View style={styles.bar}>
        <View style={styles.inputColumn}>
          <TextInput
            ref={mergedRef}
            value={value}
            onChangeText={handleChangeText}
            key={Platform.OS === 'android' ? 'comment-android-singleline' : 'comment-ios'}
            placeholder={placeholder}
            placeholderTextColor="#999"
            style={[styles.input, androidSingleLineStyle]}
            numberOfLines={Platform.OS === 'android' ? 1 : undefined}
            scrollEnabled={Platform.OS === 'android' ? false : undefined}
            multiline={Platform.OS === 'android' ? false : undefined}
            returnKeyType={Platform.OS === 'android' ? 'send' : 'done'}
            blurOnSubmit={Platform.OS === 'android' ? true : true}
            importantForAutofill={Platform.OS === 'android' ? 'no' : undefined}
            autoCorrect={Platform.OS === 'android' ? false : undefined}
            autoCapitalize={Platform.OS === 'android' ? 'none' : undefined}
            keyboardType={Platform.OS === 'android' ? 'default' : undefined}
            maxLength={maxLength}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              onBlur?.();
            }}
            autoFocus={autoFocus}
          />
        </View>

        {Platform.OS !== 'ios' && (onClose || (Platform.OS === 'android' && isFocused)) && (
          <Pressable onPress={handleDonePress} style={styles.doneButton} hitSlop={12}>
            <Text style={styles.doneButtonText}>完了</Text>
          </Pressable>
        )}

        <View>
          {canSubmit ? (
            <TouchableOpacity
              onPress={handleSubmit}
              activeOpacity={0.7}
              style={styles.sendBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Send size={20} color="#1E88E5" />
            </TouchableOpacity>
          ) : (
            <View style={styles.sendBtnPlaceholder} />
          )}
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  bar: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    paddingHorizontal: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'visible',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111',
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    includeFontPadding: false,
  },
  inputColumn: {
    flex: 1,
  },
  doneButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(47,107,255,0.12)',
  },
  doneButtonText: {
    color: '#2F6BFF',
    fontWeight: '600',
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPlaceholder: {
    width: 40,
    height: 40,
  },
});

CommentComposer.displayName = 'CommentComposer';
