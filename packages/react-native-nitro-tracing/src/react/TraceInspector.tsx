import React, { useState } from 'react'
import { Alert, Modal, ScrollView, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import type { TraceClient } from '../client/createTraceClient'
import { useTraceViewer } from './useTraceViewer'
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
  const [actions, setActions] = useState(false)
  const switchTab = (tab: typeof v.tab) => v.setTab(tab)
  const newRecording = () =>
    Alert.alert(t('replaceTitle'), t('replaceDescription'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('start'), style: 'destructive', onPress: v.start },
    ])
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
          <View style={ui.header}>
            <View style={ui.spread}>
              {v.detail && <Button label={t('back')} onPress={v.back} />}
              <Text style={ui.title}>
                {v.detail
                  ? t(
                      v.detail.kind === 'trace'
                        ? 'traces'
                        : v.detail.kind === 'span'
                          ? 'spans'
                          : v.detail.kind === 'metric'
                            ? 'metrics'
                            : 'marks'
                    )
                  : t('title')}
              </Text>
              <Button label={t('close')} onPress={client.close} />
            </View>
            <View style={ui.spread}>
              <Text style={ui.muted}>
                {v.recording ? '●' : '○'}{' '}
                {t(v.recording ? 'recording' : 'stopped')} ·{' '}
                {((v.stats?.nowMs ?? 0) / 1000).toFixed(0)}s ·{' '}
                {v.stats?.eventCount ?? 0} {t('events')}
              </Text>
              <Button
                label={t('actions')}
                onPress={() => setActions(!actions)}
                selected={actions}
              />
            </View>
            {actions && (
              <View style={ui.row}>
                <Button
                  label={t('stop')}
                  onPress={v.stop}
                  disabled={v.busy || !v.recording}
                />
                <Button
                  label={t('exportAll')}
                  onPress={v.export}
                  disabled={v.busy || !client.canShare || !v.stats}
                />
                <Button
                  label={t('start')}
                  onPress={newRecording}
                  disabled={v.busy}
                />
                <Button
                  label={t('tools')}
                  onPress={() => {
                    v.setTab('playground')
                    setActions(false)
                  }}
                />
              </View>
            )}
            {(v.stats?.droppedEvents ?? 0) > 0 && (
              <Text style={ui.error}>
                {t('lostHistory', { count: v.stats!.droppedEvents })}
              </Text>
            )}
            {v.error && (
              <Text selectable style={ui.error}>
                {v.error}
              </Text>
            )}
            {!v.detail && (
              <>
                <View style={ui.row}>
                  {(
                    ['overview', 'explore', 'metrics', 'profiles'] as const
                  ).map((tab) => (
                    <Button
                      key={tab}
                      label={t(tab)}
                      selected={v.tab === tab}
                      onPress={() => switchTab(tab)}
                    />
                  ))}
                </View>
                <View style={ui.row}>
                  <Button
                    label={t(v.paused ? 'resumeUpdates' : 'pauseUpdates')}
                    selected={v.paused}
                    onPress={v.togglePause}
                  />
                  {v.pending && (
                    <Button
                      label={t('newEvents', {
                        count: Math.max(
                          0,
                          v.pending.nextSequence - v.page.nextSequence
                        ),
                      })}
                      onPress={v.apply}
                      disabled={v.paused}
                    />
                  )}
                </View>
              </>
            )}
          </View>
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
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}
