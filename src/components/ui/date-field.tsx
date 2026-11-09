import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { formatInputDate, fromPickerDate, INPUT_FORMAT, parseInputDate, toPickerDate } from '@/lib/date';

type DateFieldProps = {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  placeholder?: string;
  error?: string;
};

/**
 * Date input shown as DD/MM/YYYY (UK time) on every platform:
 * Android opens the native date dialog, iOS expands an inline calendar, web types DD/MM/YYYY.
 */
export function DateField({ value, onChange, minimumDate, placeholder = INPUT_FORMAT, error }: DateFieldProps) {
  const [webText, setWebText] = useState(formatInputDate(value));
  const [iosOpen, setIosOpen] = useState(false);
  const border = error ? 'border-red-500' : iosOpen ? 'border-primary' : 'border-slate-300';
  const label = value ? formatInputDate(value) : placeholder;

  const errorText = error ? <Text className="text-xs font-medium text-red-600">{error}</Text> : null;

  if (Platform.OS === 'web') {
    return (
      <View className="gap-1">
        <TextInput
          value={webText}
          onChangeText={(text) => {
            // Auto-insert slashes as digits are typed: 05032026 → 05/03/2026 (DD/MM/YYYY).
            const digits = text.replace(/\D/g, '').slice(0, 8);
            const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
            setWebText(formatted);
            const parsed = parseInputDate(formatted);
            if (parsed) onChange(parsed);
          }}
          placeholder={INPUT_FORMAT}
          placeholderTextColor="#64748b"
          keyboardType="number-pad"
          maxLength={10}
          className={`h-12 rounded-xl border bg-white px-3 text-[15px] text-black ${border}`}
          accessibilityLabel={`Date, format ${INPUT_FORMAT}`}
        />
        {errorText}
      </View>
    );
  }

  const field = (onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `Date ${formatInputDate(value)}` : 'Select a date'}
      className={`h-12 flex-row items-center justify-between rounded-xl border bg-white px-3 active:bg-slate-50 ${border}`}
    >
      <Text className="text-[15px] font-medium text-black">{label}</Text>
      <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={18} tintColor="#000000" />
    </Pressable>
  );

  if (Platform.OS === 'ios') {
    return (
      <View className="gap-1">
        {field(() => setIosOpen((o) => !o))}
        {iosOpen ? (
          <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <DateTimePicker
              value={toPickerDate(value ?? minimumDate) ?? new Date()}
              mode="date"
              display="inline"
              minimumDate={toPickerDate(minimumDate)}
              onValueChange={(_, date) => {
                onChange(fromPickerDate(date));
                setIosOpen(false);
              }}
            />
          </View>
        ) : null}
        {errorText}
      </View>
    );
  }

  return (
    <View className="gap-1">
      {field(() =>
        DateTimePickerAndroid.open({
          value: toPickerDate(value ?? minimumDate) ?? new Date(),
          mode: 'date',
          minimumDate: toPickerDate(minimumDate),
          onValueChange: (_, date) => onChange(fromPickerDate(date)),
        })
      )}
      {errorText}
    </View>
  );
}
