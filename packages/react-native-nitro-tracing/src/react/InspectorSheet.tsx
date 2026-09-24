import React, { type ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { apple, NavBar, palette, TextButton } from './InspectorControls'
/**
 * iOS page sheet: nav bar with Cancel and an optional primary action, grouped body.
 * Mount only while open; a pre-mounted Modal inside the inspector's Modal presents unreliably.
 */
export function InspectorSheet({
  title,
  close,
  closeLabel,
  primary,
  children,
}: {
  title: string
  close: () => void
  closeLabel: string
  primary?: { label: string; onPress: () => void; disabled?: boolean }
  children: ReactNode
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <SafeAreaProvider>
        <KeyboardAvoidingView
          style={styles.scrim}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            edges={['bottom', 'left', 'right']}
            style={styles.sheet}
          >
            <View style={styles.grabber} />
            <NavBar
              left={<TextButton label={closeLabel} onPress={close} />}
              title={title}
              right={
                primary && (
                  <TextButton
                    label={primary.label}
                    onPress={primary.onPress}
                    disabled={primary.disabled}
                    bold
                  />
                )
              }
            />
            {children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  )
}
const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.scrim,
  },
  sheet: {
    height: '88%',
    backgroundColor: apple.grouped,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#c7c7cc',
    marginTop: 6,
  },
})
