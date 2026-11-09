import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Brand } from '@/constants/theme';

type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
};

/**
 * Row of digit boxes backed by one hidden TextInput, so paste and
 * SMS/email autofill work and backspace behaves naturally.
 */
export function OtpInput({ length = 4, value, onChange }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
      {Array.from({ length }, (_, i) => {
        const active = focused && (i === value.length || (i === length - 1 && value.length === length));
        return (
          <View key={i} style={[styles.box, active && styles.boxActive]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
        accessibilityLabel={`${length} digit verification code`}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  box: {
    flex: 1,
    maxWidth: 64,
    aspectRatio: 0.88,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: Brand.borderFocused, borderWidth: 1.5 },
  digit: { fontSize: 24, fontWeight: '600', color: Brand.text },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
