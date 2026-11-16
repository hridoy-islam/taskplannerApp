import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

export type DropdownItem = {
  label: string;
  onPress: () => void;
  /** Red text, e.g. "Exit group". */
  danger?: boolean;
  hidden?: boolean;
};

const MENU_WIDTH = 220;
const SCREEN_MARGIN = 8;
/** Lets the menu finish closing before the action opens its own modal (iOS can't stack them mid-animation). */
const ACTION_DELAY = Platform.OS === 'ios' ? 350 : 0;

/**
 * ⋮ button that opens a WhatsApp-style menu anchored under it (top-right, plain text rows).
 */
export function DropdownMenu({ items, label = 'More options' }: { items: DropdownItem[]; label?: string }) {
  const triggerRef = useRef<View>(null);
  const { width: screenWidth } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const visibleItems = items.filter((i) => !i.hidden);

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ top: y + h + 4, right: Math.max(SCREEN_MARGIN, screenWidth - (x + w)) });
    });
  };

  const close = () => setAnchor(null);

  const select = (item: DropdownItem) => {
    close();
    setTimeout(item.onPress, ACTION_DELAY);
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={open}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100"
      >
        <SymbolView name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }} size={20} tintColor="#000000" style={{ transform: Platform.OS === 'ios' ? [{ rotate: '90deg' }] : undefined }} />
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <Pressable className="flex-1" onPress={close} accessibilityLabel="Close menu">
          {anchor ? (
            <View
              accessibilityRole="menu"
              className="absolute overflow-hidden rounded-xl bg-white py-1.5"
              style={{
                top: anchor.top,
                right: anchor.right,
                width: MENU_WIDTH,
                elevation: 8,
                shadowColor: '#0f172a',
                shadowOpacity: 0.18,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              {visibleItems.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => select(item)}
                  accessibilityRole="menuitem"
                  className="px-5 py-3 active:bg-slate-100"
                >
                  <Text className={`text-[15px] ${item.danger ? 'font-medium text-red-600' : 'text-black'}`}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
