import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

type AuthFieldProps = TextInputProps & {
  label: string;
  error?: string;
  /** Renders an eye toggle and hides the text by default. */
  password?: boolean;
};

const FIELD_HEIGHT = 56;
const LABEL_RESTING_SIZE = 16;
const LABEL_FLOATING_SIZE = 12;
// Resting: vertically centred in the box. Floating: centred on the top border.
const LABEL_RESTING_TOP = FIELD_HEIGHT / 2 - LABEL_RESTING_SIZE * 0.7;
const LABEL_FLOATING_TOP = -LABEL_FLOATING_SIZE * 0.75;

/**
 * Outlined input with a floating label: the label sits inside the empty field
 * and animates up onto the top border when focused or filled.
 */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error, password = false, style, value, placeholder, onFocus, onBlur, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(password);
  const floated = focused || !!value;

  const progress = useSharedValue(floated ? 1 : 0);
  const focus = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(floated ? 1 : 0, { duration: 180 });
  }, [floated, progress]);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, focus]);

  const borderColor = error ? Brand.error : undefined;

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: borderColor ?? interpolateColor(focus.value, [0, 1], [Brand.border, Brand.borderFocused]),
    borderWidth: interpolate(focus.value, [0, 1], [1, 1.5]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    top: interpolate(progress.value, [0, 1], [LABEL_RESTING_TOP, LABEL_FLOATING_TOP]),
    fontSize: interpolate(progress.value, [0, 1], [LABEL_RESTING_SIZE, LABEL_FLOATING_SIZE]),
    color:
      borderColor ??
      interpolateColor(focus.value, [0, 1], [Brand.placeholder, Brand.borderFocused]),
  }));

  return (
    <View>
      <Animated.View style={[styles.box, boxStyle]}>
        <TextInput
          ref={ref}
          {...props}
          value={value}
          // Only show the hint once the label has moved out of the way.
          placeholder={focused ? placeholder : undefined}
          secureTextEntry={hidden}
          placeholderTextColor={Brand.placeholder}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
          accessibilityLabel={label}
        />

        <Animated.Text
          pointerEvents="none"
          numberOfLines={1}
          style={[styles.label, labelStyle]}
          importantForAccessibility="no"
        >
          {label}
        </Animated.Text>

        {password ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setHidden((h) => !h);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={styles.eye}
          >
            <SymbolView
              name={
                hidden
                  ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
                  : { ios: 'eye', android: 'visibility', web: 'visibility' }
              }
              size={20}
              tintColor={Brand.textMuted}
              fallback={<Text style={styles.eyeFallback}>{hidden ? 'Show' : 'Hide'}</Text>}
            />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    height: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: Brand.text,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  label: {
    position: 'absolute',
    left: 10,
    paddingHorizontal: 4,
    // Masks the border line behind the floating label.
    backgroundColor: Brand.surface,
  },
  eye: { paddingLeft: 8 },
  eyeFallback: { fontSize: 12, color: Brand.textMuted },
  error: { marginTop: 4, marginLeft: 4, fontSize: 12, color: Brand.error },
});
