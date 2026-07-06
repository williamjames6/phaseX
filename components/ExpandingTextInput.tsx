import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';

type ExpandingTextInputProps = Omit<TextInputProps, 'multiline' | 'scrollEnabled'> & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function ExpandingTextInput({
  containerStyle,
  inputStyle,
  style,
  ...rest
}: ExpandingTextInputProps) {
  return (
    <View style={[styles.container, containerStyle, style]}>
      <TextInput
        {...rest}
        style={[styles.input, inputStyle]}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    width: '100%',
  },
});
