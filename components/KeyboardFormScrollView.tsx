import { forwardRef } from 'react';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

export type KeyboardFormScrollViewRef = KeyboardAwareScrollViewRef;

/**
 * Standardized keyboard-aware scroll container used across the app.
 * Owns the shared config so every input screen behaves identically:
 * on focus, the caret rests ~24pt above the keyboard once it finishes animating.
 *
 * Defaults can be overridden per-screen (props are spread last), e.g. a custom
 * `bottomOffset` or `contentContainerStyle`. The forwarded ref exposes both the
 * RN ScrollView methods (`scrollTo`, `scrollToEnd`) and `assureFocusedInputVisible()`.
 */
export const KeyboardFormScrollView = forwardRef<KeyboardFormScrollViewRef, KeyboardAwareScrollViewProps>(
  function KeyboardFormScrollView(props, ref) {
    return (
      <KeyboardAwareScrollView
        ref={ref}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
        mode="insets"
        {...props}
      />
    );
  }
);
