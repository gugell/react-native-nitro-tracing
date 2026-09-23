import React from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  SafeAreaView,
} from 'react-native'

import { useTraceViewer } from './useTraceViewer'
import type { TraceClient } from '../client/createTraceClient'
import {
  createTranslator,
  type InspectorLabels,
  type InspectorTranslator,
} from './labels'
const Action = ({
  label,
  testID,
  onPress,
  disabled = false,
}: {
  label: string
  testID?: string
  onPress: () => void
  disabled?: boolean
}) => (
  <Pressable
    testID={testID}
    disabled={disabled}
    onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}
    accessibilityRole="button"
  >
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
)
export const TraceInspector = ({
  client,
  labels,
  translate,
}: {
  client: TraceClient
  labels?: Partial<InspectorLabels>
  translate?: InspectorTranslator
}) => {
  const viewer = useTraceViewer(client)
  const t = translate ?? createTranslator(labels)
  return (
    <Modal
      visible={viewer.visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={viewer.close}
    >
      <SafeAreaView testID="trace-viewer" style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('eyebrow')}</Text>
            <Text style={styles.title}>{t('title')}</Text>
          </View>
          <Action
            testID="trace-viewer-close"
            label={t('close')}
            onPress={viewer.close}
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>
            {viewer.stats?.recording ? t('recording') : t('stopped')}
          </Text>
          <Text style={styles.muted}>
            {t('counters', {
              events: viewer.stats?.eventCount ?? 0,
              active: viewer.stats?.activeSpans ?? 0,
              dropped: viewer.stats?.droppedEvents ?? 0,
              bytes: viewer.stats?.retainedBytes ?? 0,
            })}
          </Text>
          <View style={styles.actions}>
            <Action
              testID="trace-viewer-start"
              label={t('start')}
              onPress={viewer.start}
              disabled={viewer.busy || viewer.stats?.recording}
            />
            <Action
              testID="trace-viewer-stop"
              label={t('stop')}
              onPress={viewer.stop}
              disabled={viewer.busy || !viewer.stats?.recording}
            />
            <Action
              testID="trace-viewer-clear"
              label={t('clear')}
              onPress={viewer.clear}
              disabled={viewer.busy}
            />
            <Action
              testID="trace-viewer-export"
              label={t('export')}
              onPress={viewer.export}
              disabled={viewer.busy || !viewer.stats || !viewer.canShare}
            />
          </View>
          <Text style={styles.muted}>{t('retention')}</Text>
        </View>
        <View style={styles.actions} accessibilityLabel={t('tabs')}>
          {(['overview', 'traces', 'metrics', 'playground'] as const).map(
            (tab) => (
              <Action
                key={tab}
                testID={`trace-viewer-tab-${tab}`}
                label={t(tab)}
                onPress={() => viewer.setTab(tab)}
                disabled={viewer.tab === tab}
              />
            )
          )}
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {viewer.error && (
            <Text selectable style={styles.error}>
              {viewer.error}
            </Text>
          )}
          {viewer.truncated && (
            <Text style={styles.muted}>{t('truncated')}</Text>
          )}
          {viewer.tab === 'traces' && (
            <>
              <Text style={styles.heading}>{t('traces')}</Text>
              <TextInput
                testID="trace-viewer-search"
                style={styles.search}
                placeholderTextColor="#9993b1"
                placeholder={t('search')}
                accessibilityLabel={t('search')}
                value={viewer.query}
                onChangeText={viewer.setQuery}
              />
              <ScrollView style={styles.traceList} nestedScrollEnabled>
                {viewer.groups.map((group) => (
                  <Pressable
                    key={group.id}
                    onPress={() => viewer.select(group.id)}
                    style={[
                      styles.trace,
                      group.id === viewer.selectedId && styles.selected,
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.text}>
                      {group.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.muted}>
                      {group.id}
                    </Text>
                    <Text style={group.errors ? styles.error : styles.muted}>
                      {t('traceSummary', {
                        duration: group.duration.toFixed(1),
                        events: group.events,
                        errors: group.errors,
                      })}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {!viewer.groups.length && (
                <Text style={styles.muted}>{t('empty')}</Text>
              )}
              <Text style={styles.heading}>{t('waterfall')}</Text>
              <View style={styles.card}>
                {viewer.rows.map(({ span, depth, offset, width }) => (
                  <Pressable
                    key={span.spanId}
                    onPress={() => viewer.selectSpan(span.spanId)}
                    style={styles.span}
                  >
                    <View style={{ marginLeft: depth * 12 }}>
                      <Text style={styles.text}>{span.name}</Text>
                      <Text style={styles.muted}>
                        {span.durationMs.toFixed(2)} ms · {span.outcome}
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.bar,
                          {
                            marginLeft: `${offset * 100}%`,
                            width: `${Math.max(0.5, width * 100)}%`,
                            backgroundColor:
                              span.outcome === 'error' ? '#fb7185' : '#a78bfa',
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                ))}
                {!viewer.rows.length && (
                  <Text style={styles.muted}>{t('noSpans')}</Text>
                )}
              </View>
              {viewer.span && (
                <View style={styles.card}>
                  <Text style={styles.heading}>{viewer.span.name}</Text>
                  <Text selectable style={styles.muted}>
                    {t('spanDetails', {
                      id: viewer.span.spanId,
                      parent: viewer.span.parentSpanId || '—',
                      outcome: viewer.span.outcome,
                    })}
                  </Text>
                  <Text selectable style={styles.text}>
                    {JSON.stringify(viewer.span.attributes, null, 2)}
                  </Text>
                </View>
              )}
            </>
          )}
          {viewer.tab === 'metrics' && (
            <>
              <Text style={styles.heading}>{t('metrics')}</Text>
              {viewer.metrics.map((series) => (
                <View key={series.name} style={styles.card}>
                  <Text style={styles.text}>{series.name}</Text>
                  <Text style={styles.muted}>
                    {t('metricWindow', {
                      displayed: series.samples.length,
                      retained: series.retainedCount,
                      start: series.startMs.toFixed(1),
                      end: series.endMs.toFixed(1),
                    })}
                  </Text>
                  <View style={styles.chart}>
                    {series.samples.map((sample) => (
                      <View
                        key={sample.sequence}
                        style={[
                          styles.sample,
                          {
                            height: `${Math.max(
                              2,
                              (Math.abs(sample.value) / series.max) * 100
                            )}%`,
                          },
                        ]}
                        accessibilityLabel={`${sample.value} ${sample.unit}`}
                      />
                    ))}
                  </View>
                  <Text style={styles.muted}>
                    {series.samples
                      .map((sample) => sample.value.toFixed(1))
                      .join(' · ')}
                  </Text>
                </View>
              ))}
              {viewer.marks.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.heading}>{t('marks')}</Text>
                  {viewer.marks.map((mark) => (
                    <Text key={mark.sequence} style={styles.muted}>
                      {mark.timestampMs.toFixed(1)} ms · {mark.name}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}
          {viewer.tab === 'overview' && (
            <View style={styles.card}>
              <Text style={styles.heading}>{t('recordingSummary')}</Text>
              <Text style={styles.muted}>{t('summary', viewer.summary)}</Text>
              <Text selectable style={styles.muted}>
                {t('session', {
                  id: viewer.stats?.sessionId ?? '—',
                  elapsed: (viewer.stats?.nowMs ?? 0).toFixed(1),
                })}
              </Text>
            </View>
          )}
          {viewer.tab === 'overview' && viewer.canProfile && (
            <>
              <View style={styles.card}>
                <Text style={styles.heading}>{t('profiling')}</Text>
                <Text style={styles.muted}>{t('profilingDescription')}</Text>
                <Action
                  label={t(viewer.profiling ? 'stopProfile' : 'startProfile')}
                  testID="trace-viewer-toggle-profile"
                  onPress={viewer.toggleProfile}
                  disabled={viewer.busy || !viewer.stats?.recording}
                />
                {viewer.profilePath && viewer.canShareProfile && (
                  <Action
                    testID="trace-viewer-shareProfile"
                    label={t('shareProfile')}
                    onPress={viewer.shareProfile}
                    disabled={viewer.busy}
                  />
                )}
              </View>
            </>
          )}
          {viewer.tab === 'playground' && (
            <>
              <View style={styles.card}>
                <Text style={styles.heading}>{t('playground')}</Text>
                <Text style={styles.muted}>{t('playgroundDescription')}</Text>
                <Action
                  testID="trace-viewer-run"
                  label={t('run')}
                  onPress={viewer.playground}
                  disabled={viewer.busy || !viewer.stats?.recording}
                />
                {viewer.playgroundResult && (
                  <View
                    testID="trace-viewer-scenario-results"
                    style={styles.card}
                  >
                    <Text style={styles.heading}>
                      {t('scenarioResults')} ·{' '}
                      {t(viewer.playgroundResult.passed ? 'passed' : 'failed')}
                    </Text>
                    <Text style={styles.muted}>{t('scenarioNotice')}</Text>
                    {viewer.playgroundResult.checks.map((check) => (
                      <Text
                        key={check.id}
                        style={check.passed ? styles.text : styles.error}
                      >
                        {t(check.passed ? 'passed' : 'failed')} ·{' '}
                        {t(
                          (
                            {
                              nested: 'scenarioNested',
                              concurrency: 'scenarioConcurrency',
                              cancelled: 'scenarioCancelled',
                              idempotent: 'scenarioIdempotent',
                              error: 'scenarioError',
                              metrics: 'scenarioMetrics',
                            } as const
                          )[check.id]
                        )}
                      </Text>
                    ))}
                    <Action
                      testID="trace-viewer-open-scenario"
                      label={t('openScenario')}
                      onPress={viewer.openPlaygroundTrace}
                    />
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#14111d' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  content: { padding: 18, gap: 14 },
  eyebrow: { color: '#a78bfa', fontSize: 10, letterSpacing: 2 },
  title: { color: '#fff', fontSize: 25, fontWeight: '700' },
  heading: { color: '#eee9fa', fontSize: 17, fontWeight: '600' },
  text: { color: '#eee9fa', fontSize: 13 },
  muted: { color: '#aaa3ba', fontSize: 12, lineHeight: 19 },
  card: { backgroundColor: '#211b2e', borderRadius: 12, padding: 14, gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    backgroundColor: '#3c2e57',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 7,
  },
  buttonText: { color: '#f2eaff', fontWeight: '600', fontSize: 12 },
  disabled: { opacity: 0.4 },
  search: {
    borderColor: '#4c405f',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: '#fff',
  },
  traceList: { maxHeight: 240 },
  trace: { padding: 12, borderBottomWidth: 1, borderColor: '#3b304d' },
  selected: {
    backgroundColor: '#352744',
    borderLeftWidth: 3,
    borderLeftColor: '#a78bfa',
  },
  error: { color: '#fb7185', fontSize: 12 },
  span: { gap: 7, paddingVertical: 6 },
  track: {
    height: 8,
    backgroundColor: '#30263f',
    overflow: 'hidden',
    borderRadius: 3,
  },
  bar: { height: 8, borderRadius: 3 },
  chart: { height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  sample: {
    flex: 1,
    backgroundColor: '#6dd4c7',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
})
