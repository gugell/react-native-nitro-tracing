import React, { useCallback, useState, type ReactNode } from 'react'
import {
  ActionSheetIOS,
  Platform,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { ActionSheet, type SheetOption } from './InspectorControls'

/**
 * Native building blocks with React Native fallbacks. Optional peers are required directly
 * inside `try` so Metro treats them as optional; apps without them get the RN UI.
 */
type BottomTabs = typeof import('react-native-bottom-tabs').default
type GlassModule = typeof import('expo-glass-effect')
let NativeTabView: BottomTabs | undefined
let glass: GlassModule | undefined
try {
  NativeTabView = require('react-native-bottom-tabs').default
} catch {
  NativeTabView = undefined
}
try {
  glass = require('expo-glass-effect')
} catch {
  glass = undefined
}
const liquidGlass = (() => {
  try {
    return Platform.OS === 'ios' && !!glass?.isLiquidGlassAvailable()
  } catch {
    return false
  }
})()

export interface MenuConfig {
  title?: string
  options: SheetOption[]
  cancelLabel: string
}
/**
 * `open(config)` shows a native action sheet on iOS (UIAlertController, Liquid Glass on
 * iOS 26) and the RN sheet elsewhere; render `element` once in the calling component.
 */
export function useMenu() {
  const [config, setConfig] = useState<MenuConfig>()
  const open = useCallback((next: MenuConfig) => {
    if (Platform.OS !== 'ios') return setConfig(next)
    const enabled = next.options.filter((option) => !option.disabled)
    const destructive = enabled.findIndex((option) => option.destructive)
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: next.title,
        options: [
          ...enabled.map(
            (option) => `${option.selected ? '✓ ' : ''}${option.label}`
          ),
          next.cancelLabel,
        ],
        cancelButtonIndex: enabled.length,
        destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
      },
      (index) => enabled[index]?.onPress()
    )
  }, [])
  const element = config ? (
    <ActionSheet {...config} close={() => setConfig(undefined)} />
  ) : null
  return { open, element }
}

export interface NativeTab<K extends string> {
  key: K
  title: string
  /** SF Symbol name for the native iOS tab bar. */
  sfSymbol: string
  badge?: string
  render: () => ReactNode
}
/**
 * Native tab bar (UITabBarController / Material) when react-native-bottom-tabs is
 * installed; inactive screens are lazy and frozen so live ticks only render the visible tab.
 */
export function NativeTabs<K extends string>({
  tabs,
  value,
  onChange,
  tint,
  fallback,
}: {
  tabs: NativeTab<K>[]
  value: K
  onChange: (key: K) => void
  tint: ColorValue
  fallback: (content: ReactNode) => ReactNode
}) {
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === value)
  )
  // ponytail: iOS only. Android's Material tab bar needs a MaterialComponents app theme
  // (crashes on AppCompat hosts) and image icons instead of SF Symbols.
  if (!NativeTabView || Platform.OS !== 'ios')
    return <>{fallback(tabs[index]?.render())}</>
  return (
    <NativeTabView
      navigationState={{
        index,
        routes: tabs.map((tab) => ({
          key: tab.key,
          title: tab.title,
          focusedIcon: { sfSymbol: tab.sfSymbol } as never,
          badge: tab.badge,
        })),
      }}
      onIndexChange={(next) => onChange(tabs[next].key)}
      renderScene={({ route }) =>
        tabs.find((tab) => tab.key === route.key)?.render() ?? null
      }
      getLazy={() => true}
      getFreezeOnBlur={() => true}
      getBadge={({ route }) => tabs.find((tab) => tab.key === route.key)?.badge}
      minimizeBehavior="onScrollDown"
      tabBarActiveTintColor={tint}
      hapticFeedbackEnabled
    />
  )
}

/** Liquid Glass surface on iOS 26 (expo-glass-effect); a solid fallback elsewhere. */
export function Glass({
  style,
  fallbackColor,
  children,
  interactive,
}: {
  style?: StyleProp<ViewStyle>
  fallbackColor: ColorValue
  children?: ReactNode
  interactive?: boolean
}) {
  if (liquidGlass && glass) {
    const { GlassView } = glass
    return (
      <GlassView
        style={style}
        glassEffectStyle="regular"
        isInteractive={interactive}
      >
        {children}
      </GlassView>
    )
  }
  return (
    <View style={[style, { backgroundColor: fallbackColor }]}>{children}</View>
  )
}
