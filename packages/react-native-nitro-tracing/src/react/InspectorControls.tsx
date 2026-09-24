import React from 'react'
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native'
export const palette = {
  bg: '#101217',
  panel: '#1b1f28',
  line: '#303744',
  text: '#f2f4f8',
  muted: '#a3adbd',
  accent: '#a8c7ff',
  error: '#ff8d98',
}
export const ui = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: {
    padding: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  content: { padding: 16, gap: 12 },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: palette.text,
    flexShrink: 1,
  },
  heading: { fontSize: 16, fontWeight: '600', color: palette.text },
  text: { fontSize: 14, color: palette.text },
  muted: { fontSize: 12, lineHeight: 18, color: palette.muted },
  error: { color: palette.error, fontSize: 13 },
  card: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: palette.panel,
    gap: 9,
  },
  item: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: palette.line,
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 14,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 7,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
  },
  selected: { backgroundColor: '#263b56', borderColor: palette.accent },
  buttonText: { color: palette.text, fontSize: 12, fontWeight: '600' },
  link: { color: palette.accent, fontSize: 13 },
  chart: { height: 86, flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  bar: { flex: 1, backgroundColor: '#7dc9c1', minHeight: 2 },
  track: {
    height: 7,
    backgroundColor: '#303744',
    borderRadius: 3,
    overflow: 'hidden',
  },
})
export function Button({
  label,
  onPress,
  selected,
  disabled,
  testID,
}: {
  label: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
  testID?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[ui.button, selected && ui.selected, disabled && { opacity: 0.4 }]}
    >
      <Text style={ui.buttonText}>{label}</Text>
    </Pressable>
  )
}
export function Field({
  label,
  value,
  onChange,
  numeric = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  numeric?: boolean
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={ui.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={palette.muted}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        style={ui.input}
      />
    </View>
  )
}
