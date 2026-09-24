import React from 'react'
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context'
import { TraceInspector } from 'react-native-nitro-tracing/react'
import { useExampleTracing } from './tracing'

export default function App() {
  const client = useExampleTracing()
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.introduction}>
            <Text accessibilityRole="header" style={styles.title}>
              Nitro Tracing
            </Text>
            <Text style={styles.text}>
              Open the inspector here or from the Expo development menu. Use
              Actions → Tools → Playground to create nested, concurrent and failed spans.
            </Text>
            <Button
              title="Open performance inspector"
              disabled={!client}
              onPress={() => client?.open()}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
      {client && <TraceInspector client={client} />}
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#10101b' },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  introduction: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 20 },
  text: { color: '#c3bed4', fontSize: 16, marginBottom: 24 },
})
