import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  autoFocus?: boolean;
};

export const CommentComposer = React.forwardRef<TextInput, Props>(function CommentComposer({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'コメントを追加',
  maxLength,
  onBlur,
  autoFocus = false,
}, ref) {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';

  const keyboardY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isIOS) return;

    const showSub = Keyboard.addListener('keyboardWillShow', (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      Animated.timing(keyboardY, {
        toValue: -h,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      Animated.timing(keyboardY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isIOS, keyboardY]);

  const canSubmit = useMemo(() => value.trim().length > 0, [value]);

  const handleSubmit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    Keyboard.dismiss();
  };

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          bottom: 0,
          paddingBottom: Platform.OS === 'android' ? 8 : Math.max(insets.bottom, 8),
          transform: [{ translateY: isIOS ? keyboardY : 0 }],
        },
      ]}>
      <View style={styles.bar}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          style={styles.input}
          multiline={false}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          blurOnSubmit={true}
          maxLength={maxLength}
          onBlur={onBlur}
          autoFocus={autoFocus}
        />

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
  },
  bar: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    paddingHorizontal: 12,
    height: 44,
    alignItems: 'center',
    flexDirection: 'row',
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
