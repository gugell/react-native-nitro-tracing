import React from 'react'
import { Button, SafeAreaView, StyleSheet, Text } from 'react-native'
import { TraceInspector } from 'react-native-nitro-tracing/react'
import { useExampleTracing } from './tracing'
export default function App() {
  const client = useExampleTracing()
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Nitro Tracing</Text>
      <Text style={styles.text}>
        Open the inspector here or from the Expo development menu. Use
        Playground to create nested, concurrent and failed spans.
      </Text>
      <Button
        title="Open performance inspector"
        disabled={!client}
        onPress={() => client?.open()}
      />
      {client && <TraceInspector client={client} />}
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#10101b',
    padding: 24,
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 20 },
  text: { color: '#c3bed4', fontSize: 16, marginBottom: 24 },
})
