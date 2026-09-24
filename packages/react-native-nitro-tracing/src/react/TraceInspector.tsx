import React, { useEffect } from 'react'
import { Modal, ScrollView, StatusBar, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import type { TraceClient } from '../client/createTraceClient'
import { useTraceViewer, type Viewer } from './useTraceViewer'
import { InspectorHeader } from './InspectorHeader'
import { ExplorerView } from './ExplorerView'
import { DetailView } from './DetailView'
import { MetricsView } from './MetricsView'
import { SummaryView } from './SummaryView'
import { TimelineView } from './TimelineView'
import { NativeTabs } from './native'
import { defaultBudgets, type Budgets } from './topics'
import { apple, palette, Row, Section, TabBar } from './InspectorControls'
import {
  createTranslator,
  type InspectorLabelKey,
  type InspectorLabels,
  type InspectorTranslator,
} from './labels'

const tabs = [
  { value: 'overview', icon: '◉', key: 'overview', iconSize: 18 },
  { value: 'timeline', icon: '☰', key: 'timeline', iconSize: 22 },
  { value: 'explore', icon: '⌕', key: 'explore', iconSize: 30 },
  { value: 'metrics', icon: '▥', key: 'metrics', iconSize: 22 },
] as const
const scenarioKey = {
  nested: 'scenarioNested',
  concurrency: 'scenarioConcurrency',
  cancelled: 'scenarioCancelled',
  idempotent: 'scenarioIdempotent',
  error: 'scenarioError',
  metrics: 'scenarioMetrics',
} as const satisfies Record<string, InspectorLabelKey>

export function TraceInspector({
  client,
  labels,
  translate,
  budgets,
}: {
  client: TraceClient
  labels?: Partial<InspectorLabels>
  translate?: InspectorTranslator
  /** Local issue thresholds for the Summary and Timeline. */
  budgets?: Partial<Budgets>
}) {
  const v = useTraceViewer(client, budgets)
  const stallMs = budgets?.stallMs ?? defaultBudgets.stallMs
  const t = translate ?? createTranslator(labels)
  // Android Modals keep the host's status bar style; push dark icons while open.
  useEffect(() => {
    if (!v.visible) return
    const entry = StatusBar.pushStackEntry({ barStyle: 'dark-content' })
    return () => StatusBar.popStackEntry(entry)
  }, [v.visible])
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
      statusBarTranslucent
      onRequestClose={v.detail ? v.back : client.close}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={styles.root}
          edges={['top', 'bottom', 'left', 'right']}
        >
          <InspectorHeader v={v} t={t} />
          {v.detail ? (
            <DetailView key={`${v.details.length}:${identity}`} v={v} t={t} />
          ) : v.tab === 'tools' ? (
            <ToolsView v={v} t={t} client={client} />
          ) : (
            <NativeTabs
              value={v.tab}
              onChange={v.setTab}
              tint={palette.accent}
              tabs={[
                {
                  key: 'overview',
                  title: t('overview'),
                  sfSymbol: 'gauge.with.dots.needle.67percent',
                  badge: v.issues.length ? String(v.issues.length) : undefined,
                  render: () => <SummaryView v={v} t={t} budgetMs={stallMs} />,
                },
                {
                  key: 'timeline',
                  title: t('timeline'),
                  sfSymbol: 'list.bullet.below.rectangle',
                  render: () => <TimelineView v={v} t={t} />,
                },
                {
                  key: 'explore',
                  title: t('explore'),
                  sfSymbol: 'magnifyingglass',
                  render: () => <ExplorerView v={v} t={t} />,
                },
                {
                  key: 'metrics',
                  title: t('metrics'),
                  sfSymbol: 'chart.xyaxis.line',
                  render: () => <MetricsView v={v} t={t} />,
                },
              ]}
              fallback={(content) => (
                <>
                  {content}
                  <TabBar
                    items={tabs.map((tab) => ({ ...tab, label: t(tab.key) }))}
                    value={v.tab === 'tools' ? 'overview' : v.tab}
                    onChange={v.setTab}
                  />
                </>
              )}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

function ToolsView({
  v,
  t,
  client,
}: {
  v: Viewer
  t: InspectorTranslator
  client: TraceClient
}) {
  const result = v.playgroundResult
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section header={t('profiling')} footer={t('profileSeparate')}>
        {client.canProfile ? (
          <Row
            icon="◷"
            title={t(v.profiling ? 'stopProfile' : 'startProfile')}
            subtitle={t('profilingDescription')}
            onPress={v.busy || !v.recording ? undefined : v.toggleProfile}
            last={!v.profilePath}
          />
        ) : (
          <Row title={t('noProfiler')} last />
        )}
        {v.profilePath && (
          <Row
            icon="⇪"
            title={t('shareProfile')}
            subtitle={v.profilePath}
            onPress={client.canShareProfile ? v.shareProfile : undefined}
            last
          />
        )}
      </Section>
      <Section header={t('playground')} footer={t('playgroundDescription')}>
        <Row
          icon="▷"
          title={t('run')}
          onPress={v.busy || !v.recording ? undefined : v.playground}
          last={!result}
        />
        {result?.checks.map((check) => (
          <Row
            key={check.id}
            icon={check.passed ? '✓' : '✕'}
            iconColor={check.passed ? '#34c759' : palette.error}
            title={t(scenarioKey[check.id])}
          />
        ))}
        {result && (
          <Row title={t('openScenario')} onPress={v.openPlayground} last />
        )}
      </Section>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: apple.grouped },
  content: { paddingBottom: 32 },
})
