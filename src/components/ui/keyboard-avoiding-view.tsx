import { cssInterop } from 'nativewind';
import type { ViewProps } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

type KeyboardPaddingViewProps = ViewProps & {
  /**
   * Bottom padding the content already has for the phone's navigation bar / home indicator.
   * It's subtracted so that space isn't added twice while the keyboard is open.
   */
  bottomInset?: number;
};

/**
 * Pads its bottom by the keyboard's height, animated with the keyboard. Use it for views that reach
 * the bottom of the screen (full-screen pages and <Modal> content).
 *
 * The keyboard height comes from react-native-keyboard-controller, which tracks the keyboard natively,
 * so this works with Android edge-to-edge (where the window no longer resizes for the keyboard) and
 * inside Modals.
 */
export function KeyboardPaddingView({ style, bottomInset = 0, ...props }: KeyboardPaddingViewProps) {
  // `height` goes from 0 to -keyboardHeight as the keyboard opens.
  const { height } = useReanimatedKeyboardAnimation();
  const padding = useAnimatedStyle(() => {
    const keyboard = -height.value;
    return { paddingBottom: keyboard > 0 ? Math.max(keyboard - bottomInset, 0) : 0 };
  }, [bottomInset]);
  return <Animated.View {...props} style={[style, padding]} />;
}

cssInterop(KeyboardPaddingView, { className: 'style' });
