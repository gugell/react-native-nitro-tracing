import React from 'react'
import { ScrollView } from 'react-native'
import type { InspectorLabelKey, InspectorTranslator } from './labels'
import type { Viewer } from './useTraceViewer'
import {
  defaultBudgets,
  topicGlyph,
  type AnyEvent,
  type Issue,
  type TopicId,
} from './topics'
import { formatMetric } from './viewerModel'
import { apple, palette, Row, Section } from './InspectorControls'
const capital = (id: string) => id[0].toUpperCase() + id.slice(1)
const issueLabel = (issue: Issue) =>
  `issue${capital(issue.kind)}` as InspectorLabelKey
const ms = (value: number | undefined) =>
  value === undefined ? '—' : value.toFixed(0)
const MAX_ISSUES = 20
/** Opens the matching detail; metric samples open their series. */
export const openEvent = (v: Viewer, event: AnyEvent) => {
  if ('spanId' in event) v.open({ kind: 'span', value: event })
  else if ('unit' in event) {
    const series = v.metrics.find(
      (s) => s.name === `${event.name} (${event.unit})`
    )
    if (series) v.open({ kind: 'metric', value: series })
  } else v.open({ kind: 'mark', value: event })
}
export function SummaryView({
  v,
  t,
  budgetMs = defaultBudgets.stallMs,
}: {
  v: Viewer
  t: InspectorTranslator
  budgetMs?: number
}) {
  const explore = (id: TopicId) => {
    if (id === 'startup' || id === 'responsiveness' || id === 'resources') {
      v.setTab('metrics')
      v.setMetricCategory('runtime')
    } else if (id === 'errors') v.showMarks({ sources: ['error'] })
    else if (id === 'network')
      v.showSpans({ sources: ['network'], sort: 'longest' })
    else if (id === 'screens') v.showSpans({ sources: ['navigation'] })
    else v.showSpans({})
  }
  const shown = v.issues.slice(0, MAX_ISSUES)
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Section
        header={
          v.issues.length ? t('issues', { count: v.issues.length }) : undefined
        }
        footer={
          v.issues.length > shown.length
            ? t('moreIssues', { count: v.issues.length - shown.length })
            : undefined
        }
      >
        {shown.length ? (
          shown.map((issue, index) => (
            <Row
              key={index}
              icon="⚠"
              iconColor={palette.error}
              title={issue.title}
              subtitle={`${t(issueLabel(issue))} · +${(issue.event.timestampMs / 1000).toFixed(1)} s`}
              value={
                issue.valueMs === undefined
                  ? undefined
                  : formatMetric(issue.valueMs, 'ms')
              }
              tint={palette.error}
              onPress={() => openEvent(v, issue.event)}
              last={index === shown.length - 1}
            />
          ))
        ) : (
          <Row icon="✓" iconColor="#34c759" title={t('noIssues')} last />
        )}
      </Section>
      <Section header={t('topics')} footer={t('summaryScope')}>
        {v.topics.map((topic, index) => {
          const name = capital(topic.id)
          const hasIssues = topic.issues.length > 0
          return (
            <Row
              key={topic.id}
              icon={topicGlyph[topic.id].icon}
              iconColor={
                topic.tracked ? topicGlyph[topic.id].color : apple.secondary
              }
              title={t(`topic${name}` as InspectorLabelKey)}
              subtitle={
                !topic.tracked
                  ? `${t('notTracked')} · ${t(`hint${name}` as InspectorLabelKey)}`
                  : !topic.count && topic.id !== 'responsiveness'
                    ? t('quiet')
                    : t(`headline${name}` as InspectorLabelKey, {
                        count: topic.count,
                        value: ms(topic.value),
                        budget: budgetMs,
                        ...topic.values,
                      })
              }
              value={hasIssues ? String(topic.issues.length) : undefined}
              tint={hasIssues ? palette.error : undefined}
              onPress={() => explore(topic.id)}
              last={index === v.topics.length - 1}
            />
          )
        })}
      </Section>
    </ScrollView>
  )
}
