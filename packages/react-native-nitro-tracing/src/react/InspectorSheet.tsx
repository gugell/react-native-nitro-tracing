import React, { type ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Button, palette, ui } from './InspectorControls'
export function InspectorSheet({
  visible,
  title,
  close,
  closeLabel,
  children,
}: {
  visible: boolean
  title: string
  close: () => void
  closeLabel: string
  children: ReactNode
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <SafeAreaProvider>
        <KeyboardAvoidingView
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: '#0008',
          }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={close}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <SafeAreaView
            edges={['bottom', 'left', 'right']}
            style={{
              height: '85%',
              backgroundColor: palette.bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            }}
          >
            <View style={ui.header}>
              <View style={ui.spread}>
                <Text accessibilityRole="header" style={ui.title}>
                  {title}
                </Text>
                <Button label={closeLabel} onPress={close} />
              </View>
            </View>
            {children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  )
}
