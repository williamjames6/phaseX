import { forwardRef } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

export type KeyboardFormScrollViewRef = ScrollView;

type KeyboardFormScrollViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export const KeyboardFormScrollView = forwardRef<KeyboardFormScrollViewRef, KeyboardFormScrollViewProps>(
  function KeyboardFormScrollView({ children, style, contentContainerStyle }, ref) {
    return (
      <KeyboardAwareScrollView
        ref={ref}
        style={style}
        contentContainerStyle={contentContainerStyle}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
      >
        {children}
      </KeyboardAwareScrollView>
    );
  }
);
