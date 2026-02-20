import React, { forwardRef } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ScrollViewProps,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

type Props = ScrollViewProps & {
  children: React.ReactNode;
  contentPaddingBottom?: number;
  keyboardVerticalOffsetOverride?: number;
};

const KeyboardAwareScroll = forwardRef<ScrollView, Props>(function KeyboardAwareScroll(
  {
    children,
    contentContainerStyle,
    contentPaddingBottom = 24,
    keyboardVerticalOffsetOverride,
    ...props
  },
  ref
) {
  const headerHeight = useHeaderHeight();
  const offset = Platform.OS === 'ios' ? (keyboardVerticalOffsetOverride ?? headerHeight) : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={offset}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          ref={ref}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios' ? false : undefined}
          {...props}
          contentContainerStyle={[
            { paddingBottom: contentPaddingBottom },
            contentContainerStyle,
          ]}
        >
          {children}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
});

export default KeyboardAwareScroll;
