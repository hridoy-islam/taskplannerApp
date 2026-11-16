import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Slide-up bottom sheet with a title row, close button and optional footer. */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/40">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close" />
        <View className="max-h-[85%] rounded-t-3xl bg-white" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="items-center pt-2.5">
            <View className="h-1 w-10 rounded-full bg-slate-300" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-3 pt-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-black">{title}</Text>
              {subtitle ? <Text className="text-[13px] text-black">{subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
            >
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor="#000000" />
            </Pressable>
          </View>
          {children}
          {footer ? <View className="px-5 pt-3">{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = 'mx-5 mb-2',
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <View className={`h-11 flex-row items-center gap-2 rounded-xl bg-slate-100 px-3 ${className}`}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor="#000000" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        className="flex-1 text-[15px] text-black"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}
