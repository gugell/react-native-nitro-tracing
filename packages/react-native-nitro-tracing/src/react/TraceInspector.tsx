import React from 'react'
import { Modal, ScrollView, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import type { TraceClient } from '../client/createTraceClient'
import { useTraceViewer } from './useTraceViewer'
import { InspectorHeader } from './InspectorHeader'
import { ExplorerView } from './ExplorerView'
import { DetailView } from './DetailView'
import { MetricsView } from './MetricsView'
import { Button, ui } from './InspectorControls'
import {
  createTranslator,
  type InspectorLabels,
  type InspectorTranslator,
} from './labels'
export function TraceInspector({
  client,
  labels,
  translate,
}: {
  client: TraceClient
  labels?: Partial<InspectorLabels>
  translate?: InspectorTranslator
}) {
  const v = useTraceViewer(client)
  const t = translate ?? createTranslator(labels)
  const identity =
    v.detail?.kind === 'span'
      ? v.detail.value.spanId
      : v.detail?.kind === 'trace'
        ? v.detail.value.id
        : v.detail?.kind === 'metric'
          ? v.detail.value.name
          : v.detail?.kind === 'mark'
            ? String(v.detail.value.sequence)
            : ''
  return (
    <Modal
      visible={v.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={v.detail ? v.back : client.close}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={ui.root}
          edges={['top', 'bottom', 'left', 'right']}
        >
          <InspectorHeader v={v} t={t} />
          {v.detail ? (
            <DetailView key={`${v.details.length}:${identity}`} v={v} t={t} />
          ) : v.tab === 'explore' ? (
            <ExplorerView v={v} t={t} />
          ) : v.tab === 'metrics' ? (
            <MetricsView v={v} t={t} />
          ) : (
            <ScrollView contentContainerStyle={ui.content}>
              {v.tab === 'overview' && (
                <>
                  <View style={ui.card}>
                    <Text style={ui.heading}>{t('recordingSummary')}</Text>
                    <Text style={ui.muted}>
                      {t('summary', {
                        traces: v.traces.length,
                        spans: v.page.spans.length,
                        marks: v.page.marks.length,
                        metrics: v.page.metrics.length,
                      })}
                    </Text>
                    <Text style={ui.muted}>{t('retainedScope')}</Text>
                  </View>
                  <View style={ui.row}>
                    <Button
                      label={t('slowest')}
                      onPress={() => v.showSpans({ sort: 'longest' })}
                    />
                    <Button
                      label={t('errorsOnly')}
                      onPress={() => v.showSpans({ outcomes: ['error'] })}
                    />
                  </View>
                  {v.metrics
                    .filter(
                      (s) =>
                        s.name.startsWith('app.ready.') ||
                        s.name.startsWith('js.')
                    )
                    .map((s) => (
                      <View key={s.name} style={ui.card}>
                        <Text style={ui.text}>{s.name}</Text>
                        <Text style={ui.title}>{s.latest.toFixed(1)}</Text>
                        <Button
                          label={t('details')}
                          onPress={() => v.open({ kind: 'metric', value: s })}
                        />
                      </View>
                    ))}
                  <Text style={ui.heading}>{t('slowest')}</Text>
                  {[...v.page.spans]
                    .sort((a, b) => b.durationMs - a.durationMs)
                    .slice(0, 5)
                    .map((span) => (
                      <Button
                        key={span.spanId}
                        label={`${span.name} · ${span.durationMs.toFixed(1)} ms`}
                        onPress={() => v.open({ kind: 'span', value: span })}
                      />
                    ))}
                </>
              )}
              {v.tab === 'profiles' && (
                <View style={ui.card}>
                  <Text style={ui.heading}>{t('profiling')}</Text>
                  <Text style={ui.muted}>{t('profilingDescription')}</Text>
                  <Text style={ui.muted}>{t('profileSeparate')}</Text>
                  {client.canProfile ? (
                    <Button
                      label={t(v.profiling ? 'stopProfile' : 'startProfile')}
                      onPress={v.toggleProfile}
                      disabled={v.busy || !v.recording}
                    />
                  ) : (
                    <Text style={ui.muted}>{t('noProfiler')}</Text>
                  )}
                  {v.profilePath && (
                    <>
                      <Text selectable style={ui.muted}>
                        {v.profilePath}
                      </Text>
                      <Button
                        label={t('shareProfile')}
                        onPress={v.shareProfile}
                        disabled={v.busy || !client.canShareProfile}
                      />
                    </>
                  )}
                </View>
              )}
              {v.tab === 'playground' && (
                <View style={ui.card}>
                  <Text style={ui.heading}>{t('playground')}</Text>
                  <Text style={ui.muted}>{t('playgroundDescription')}</Text>
                  <Button
                    label={t('run')}
                    onPress={v.playground}
                    disabled={v.busy || !v.recording}
                  />
                  {v.playgroundResult && (
                    <>
                      <Text style={ui.heading}>
                        {t(v.playgroundResult.passed ? 'passed' : 'failed')}
                      </Text>
                      {v.playgroundResult.checks.map((check) => (
                        <Text
                          key={check.id}
                          style={check.passed ? ui.text : ui.error}
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
                      <Button
                        label={t('openScenario')}
                        onPress={v.openPlayground}
                      />
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          )}
          {!v.detail && (
            <View style={ui.bottomNav}>
              <View style={ui.row}>
                {(['overview', 'explore', 'metrics', 'profiles'] as const).map(
                  (tab) => (
                    <Button
                      key={tab}
                      label={t(tab)}
                      selected={v.tab === tab}
                      onPress={() => v.setTab(tab)}
                    />
                  )
                )}
              </View>
            </View>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}
