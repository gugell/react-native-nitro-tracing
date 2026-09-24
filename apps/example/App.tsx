import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context'
import type { TraceClient } from 'react-native-nitro-tracing/client'
import { TraceInspector, TraceOverlay } from 'react-native-nitro-tracing/react'
import { activitySections, type Activity } from './activity'
import { useExampleTracing } from './tracing'

const filters = ['All', ...activitySections.map((section) => section.title)]
const all = activitySections.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.title }))
)

/** Instruments-style chooser: select an activity, read what it does, run it. */
export default function App() {
  const client = useExampleTracing()
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(all[0])
  const [status, setStatus] = useState<string>()
  const run = async (activity: Activity, ready: TraceClient | undefined) => {
    if (!ready) return
    setStatus('Running…')
    try {
      const result = await activity.run(ready)
      setStatus(
        `Done${typeof result === 'number' ? ` · HTTP ${result || 'failed'}` : ''}`
      )
    } catch (error) {
      setStatus(`Failed: ${String(error)}`)
      ready.reportError(error)
    }
  }
  const visible = all.filter(
    (item) => filter === 'All' || item.section === filter
  )
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root}>
        <Text accessibilityRole="header" style={styles.title}>
          Choose an Activity…
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.segmentsBar}
          contentContainerStyle={styles.segments}
        >
          {filters.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === name }}
              onPress={() => setFilter(name)}
              style={[styles.segment, filter === name && styles.segmentOn]}
            >
              <Text
                style={[
                  styles.segmentText,
                  filter === name && styles.segmentTextOn,
                ]}
              >
                {name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={styles.grid}>
          {visible.map((activity) => {
            const isSelected = activity.label === selected.label
            return (
              <Pressable
                key={activity.label}
                accessibilityRole="button"
                accessibilityLabel={activity.label}
                accessibilityHint="Selects the activity; tap again to run it"
                // Tapping the selected tile again runs it, like a double click in Instruments.
                onPress={() =>
                  isSelected
                    ? void run(activity, client)
                    : (setSelected(activity), setStatus(undefined))
                }
                style={styles.tile}
              >
                <View style={[styles.icon, isSelected && styles.iconOn]}>
                  <Text style={[styles.glyph, { color: activity.color }]}>
                    {activity.icon}
                  </Text>
                </View>
                <Text
                  style={[styles.label, isSelected && styles.labelOn]}
                  numberOfLines={2}
                >
                  {activity.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
        <View style={styles.details}>
          <Text style={[styles.detailGlyph, { color: selected.color }]}>
            {selected.icon}
          </Text>
          <View style={styles.detailText}>
            <Text style={styles.detailTitle}>{selected.label}</Text>
            <Text style={styles.detailBody}>{selected.description}</Text>
            {status && <Text style={styles.status}>{status}</Text>}
          </View>
        </View>
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => client?.open()}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Open Inspector…</Text>
          </Pressable>
          <View style={styles.spacer} />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              client &&
              void client
                .playground()
                .then(() => client.open(), client.reportError)
            }
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Playground</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!client}
            onPress={() => void run(selected, client)}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Run</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      {client && <TraceOverlay client={client} />}
      {client && <TraceInspector client={client} />}
    </SafeAreaProvider>
  )
}

const blue = '#007aff'
const hairline = StyleSheet.hairlineWidth
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3a3a3c',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: hairline,
    borderColor: '#d8d8dc',
  },
  segmentsBar: { flexGrow: 0 },
  segments: {
    margin: 12,
    padding: 2,
    borderRadius: 8,
    backgroundColor: '#f2f2f7',
    gap: 2,
  },
  segment: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  segmentOn: { backgroundColor: blue },
  segmentText: { fontSize: 14, color: '#1d1d1f' },
  segmentTextOn: { color: '#fff', fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: hairline,
    borderColor: '#d8d8dc',
  },
  tile: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOn: { backgroundColor: '#e5efff' },
  glyph: { fontSize: 40, fontWeight: '300' },
  label: {
    fontSize: 13,
    color: '#1d1d1f',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  labelOn: { backgroundColor: blue, color: '#fff' },
  details: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderTopWidth: hairline,
    borderColor: '#d8d8dc',
    minHeight: 104,
  },
  detailGlyph: { fontSize: 34, fontWeight: '300', width: 40 },
  detailText: { flex: 1, gap: 3 },
  detailTitle: { fontSize: 15, fontWeight: '600', color: '#1d1d1f' },
  detailBody: { fontSize: 13, color: '#3a3a3c', lineHeight: 18 },
  status: { fontSize: 12, color: blue, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: hairline,
    borderColor: '#d8d8dc',
  },
  spacer: { flex: 1 },
  secondary: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#e9e9ee',
  },
  secondaryText: { fontSize: 14, color: '#1d1d1f' },
  primary: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: blue,
  },
  primaryText: { fontSize: 14, color: '#fff', fontWeight: '600' },
})
