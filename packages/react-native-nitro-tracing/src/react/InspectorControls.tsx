import React from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
export const palette = {
  // Light system colors, in the spirit of Xcode Instruments.
  bg: '#ffffff',
  panel: '#f2f2f7',
  line: '#d8d8dc',
  text: '#1d1d1f',
  muted: '#6e6e73',
  accent: '#007aff',
  selected: '#e5efff',
  error: '#ff3b30',
  scrim: '#0003',
}
export const ui = StyleSheet.create({
  bottomNav: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  root: { flex: 1, backgroundColor: palette.bg },
  header: {
    padding: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: palette.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  selected: { backgroundColor: palette.selected, borderColor: palette.accent },
  buttonText: { color: palette.text, fontSize: 13, fontWeight: '500' },
  selectedText: { color: palette.accent },
  link: { color: palette.accent, fontSize: 13 },
  chart: { height: 86, flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  bar: { flex: 1, backgroundColor: palette.accent, minHeight: 2 },
  track: {
    height: 7,
    backgroundColor: palette.panel,
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
      <Text style={[ui.buttonText, selected && ui.selectedText]}>{label}</Text>
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

// ── Apple-style primitives: grouped lists, bars and sheets ──────────────────
export const apple = {
  grouped: '#f2f2f7',
  card: '#ffffff',
  separator: '#c6c6c8',
  secondary: '#8e8e93',
  fill: '#e3e3e8',
}
const hairline = StyleSheet.hairlineWidth
const s = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 44,
    backgroundColor: apple.grouped,
  },
  navSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'center',
  },
  textButton: { paddingHorizontal: 8, paddingVertical: 10 },
  textButtonLabel: { fontSize: 17, color: palette.accent },
  iconLabel: { fontSize: 20, color: palette.accent },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: {
    fontSize: 13,
    color: apple.secondary,
    textTransform: 'uppercase',
    marginLeft: 16,
    marginBottom: 6,
  },
  sectionFooter: {
    fontSize: 13,
    color: apple.secondary,
    marginHorizontal: 16,
    marginTop: 6,
    lineHeight: 18,
  },
  sectionBody: {
    backgroundColor: apple.card,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 12,
    backgroundColor: apple.card,
    gap: 12,
  },
  rowSeparator: {
    position: 'absolute',
    left: 16,
    right: 0,
    bottom: 0,
    height: hairline,
    backgroundColor: apple.separator,
  },
  rowIcon: { width: 22, textAlign: 'center', fontSize: 17 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, color: palette.text },
  rowSubtitle: { fontSize: 12, color: apple.secondary },
  rowValue: {
    fontSize: 15,
    fontWeight: '500',
    color: apple.secondary,
    fontVariant: ['tabular-nums'],
  },
  chevron: { fontSize: 20, color: '#c4c4c7', marginLeft: -4 },
  check: { width: 20, fontSize: 17, fontWeight: '600', color: palette.accent },
  pressed: { backgroundColor: '#e5e5ea' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 10,
    backgroundColor: apple.fill,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 16, color: palette.text, padding: 0 },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 2,
    borderRadius: 9,
    backgroundColor: apple.fill,
  },
  segment: {
    flex: 1,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: 7,
  },
  segmentOn: {
    backgroundColor: apple.card,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '500', color: palette.text },
  segmentTextOn: { fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: hairline,
    borderColor: apple.separator,
    backgroundColor: '#f9f9f9',
    paddingTop: 6,
    paddingBottom: 4,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: {
    height: 26,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    color: apple.secondary,
  },
  tabLabel: { fontSize: 10, fontWeight: '500', color: apple.secondary },
  tabOn: { color: palette.accent },
  banner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: palette.accent,
  },
  bannerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  scrim: {
    flex: 1,
    backgroundColor: palette.scrim,
    justifyContent: 'flex-end',
  },
  sheet: { padding: 8, gap: 8 },
  sheetGroup: {
    backgroundColor: 'rgba(249,249,249,0.97)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  sheetTitle: {
    fontSize: 13,
    color: apple.secondary,
    textAlign: 'center',
    padding: 14,
    borderBottomWidth: hairline,
    borderColor: apple.separator,
  },
  sheetOption: {
    minHeight: 57,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: hairline,
    borderColor: apple.separator,
    paddingHorizontal: 16,
  },
  sheetOptionText: { fontSize: 20, color: palette.accent },
  sheetCancel: { fontWeight: '600' },
})

export function NavBar({
  left,
  title,
  right,
}: {
  left?: React.ReactNode
  title: string
  right?: React.ReactNode
}) {
  return (
    <View style={s.navBar}>
      <View style={s.navSide}>{left}</View>
      <Text style={s.navTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={[s.navSide, { justifyContent: 'flex-end' }]}>{right}</View>
    </View>
  )
}
/** Blue text or glyph button, as in iOS navigation bars and toolbars. */
export function TextButton({
  label,
  icon,
  onPress,
  disabled,
  bold,
  accessibilityLabel,
}: {
  label?: string
  icon?: string
  onPress: () => void
  disabled?: boolean
  bold?: boolean
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={[s.textButton, disabled && { opacity: 0.35 }]}
    >
      <Text
        style={[
          icon ? s.iconLabel : s.textButtonLabel,
          bold && { fontWeight: '600' },
        ]}
      >
        {icon ?? label}
      </Text>
    </Pressable>
  )
}
export function Section({
  header,
  footer,
  children,
}: {
  header?: string
  footer?: string
  children: React.ReactNode
}) {
  return (
    <View style={s.section}>
      {header && <Text style={s.sectionHeader}>{header}</Text>}
      <View style={s.sectionBody}>{children}</View>
      {footer && <Text style={s.sectionFooter}>{footer}</Text>}
    </View>
  )
}
export interface RowProps {
  title: string
  subtitle?: string
  value?: string
  icon?: string
  iconColor?: string
  /** Tints title and value, e.g. errors. */
  tint?: string
  onPress?: () => void
  /** Hide the separator on the last row of a section. */
  last?: boolean
  /** Toggle row: shows a checkmark instead of a disclosure chevron. */
  checked?: boolean
}
/** Memoized: unchanged rows skip re-rendering when live data ticks. */
export const Row = React.memo(function Row({
  title,
  subtitle,
  value,
  icon,
  iconColor,
  tint,
  onPress,
  last,
  checked,
}: RowProps) {
  return (
    <Pressable
      accessibilityRole={
        checked !== undefined ? 'checkbox' : onPress ? 'button' : undefined
      }
      accessibilityState={checked !== undefined ? { checked } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      {icon !== undefined && (
        <Text style={[s.rowIcon, { color: iconColor ?? palette.accent }]}>
          {icon}
        </Text>
      )}
      <View style={s.rowText}>
        <Text
          style={[s.rowTitle, tint && { color: tint }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={s.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!value && (
        <Text style={[s.rowValue, tint && { color: tint }]}>{value}</Text>
      )}
      {checked !== undefined ? (
        <Text style={s.check}>{checked ? '✓' : ''}</Text>
      ) : (
        onPress && <Text style={s.chevron}>›</Text>
      )}
      {!last && <View style={s.rowSeparator} />}
    </Pressable>
  )
})
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <View style={s.search}>
      <Text style={{ color: apple.secondary, fontSize: 20 }}>⌕</Text>
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={apple.secondary}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={s.searchInput}
      />
    </View>
  )
}
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={s.segmented} accessibilityRole="tablist">
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={[s.segment, option.value === value && s.segmentOn]}
        >
          <Text
            style={[s.segmentText, option.value === value && s.segmentTextOn]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
export function TabBar<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly { value: T; label: string; icon: string; iconSize?: number }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={s.tabBar} accessibilityRole="tablist">
      {items.map((item) => {
        const on = item.value === value
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(item.value)}
            style={s.tab}
          >
            <Text
              style={[
                s.tabIcon,
                item.iconSize ? { fontSize: item.iconSize } : undefined,
                on && s.tabOn,
              ]}
            >
              {item.icon}
            </Text>
            <Text style={[s.tabLabel, on && s.tabOn]}>{item.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
export function Banner({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.banner}>
      <Text style={s.bannerText}>↑ {label}</Text>
    </Pressable>
  )
}
export interface SheetOption {
  label: string
  onPress: () => void
  selected?: boolean
  destructive?: boolean
  disabled?: boolean
}
/** iOS-style action sheet fallback (Android, or without @expo/ui). Mount only while open. */
export function ActionSheet({
  title,
  options,
  cancelLabel,
  close,
}: {
  title?: string
  options: SheetOption[]
  cancelLabel: string
  close: () => void
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable
        style={s.scrim}
        onPress={close}
        accessibilityLabel={cancelLabel}
      >
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          <View style={s.sheetGroup}>
            {title && <Text style={s.sheetTitle}>{title}</Text>}
            {options.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityState={{
                  selected: option.selected,
                  disabled: option.disabled,
                }}
                disabled={option.disabled}
                onPress={() => {
                  close()
                  option.onPress()
                }}
                style={({ pressed }) => [s.sheetOption, pressed && s.pressed]}
              >
                <Text
                  style={[
                    s.sheetOptionText,
                    option.destructive && { color: palette.error },
                    option.disabled && { color: apple.secondary },
                  ]}
                >
                  {option.selected ? '✓ ' : ''}
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [
              s.sheetGroup,
              s.sheetOption,
              pressed && s.pressed,
            ]}
          >
            <Text style={[s.sheetOptionText, s.sheetCancel]}>
              {cancelLabel}
            </Text>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}
