import { LegendList } from '@legendapp/list/react-native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Metric, Viewer } from './useTraceViewer'
import type { InspectorTranslator } from './labels'
import { hierarchyRows, matchesSearch, sourceOf } from './explorerModel'
import {
  apple,
  palette,
  Row,
  SearchField,
  Section,
  Segmented,
  TextButton,
} from './InspectorControls'
import { useStore } from './store'
import { formatMetric } from './viewerModel'

const fixed = (value: number) => value.toFixed(1)

export function MetricDetail({
  series,
  t,
}: {
  series: Metric
  t: InspectorTranslator
}) {
  const stats = [
    ['latest', series.latest],
    ['median', series.median],
    ['p95', series.p95],
    ['min', series.min],
    ['max', series.peak],
  ] as const
  return (
    <>
      <Section header={series.name} footer={t('metricsScope')}>
        <View style={styles.chartCard}>
          <View style={styles.chart}>
            {series.samples.map((sample) => (
              <View
                key={sample.sequence}
                accessibilityLabel={`${sample.value.toFixed(2)} ${sample.unit}`}
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(2, (Math.abs(sample.value) / series.max) * 100)}%`,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.caption}>
            {t('metricWindow', {
              displayed: series.samples.length,
              retained: series.retainedCount,
              start: fixed(series.startMs),
              end: fixed(series.endMs),
            })}
          </Text>
        </View>
        {stats.map(([key, value]) => (
          <Row
            key={key}
            title={t(`stat_${key}`)}
            value={formatMetric(value, series.unit)}
          />
        ))}
        <Row title={t('samples')} value={String(series.retainedCount)} last />
      </Section>
      {!!series.samples.at(-1)?.attributes.length && (
        <Section header={t('attributes')}>
          {series.samples.at(-1)!.attributes.map((attribute, index, all) => (
            <Row
              key={attribute.key}
              title={attribute.key}
              value={attribute.value}
              last={index === all.length - 1}
            />
          ))}
        </Section>
      )}
    </>
  )
}

export function DetailView({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const detail = v.detail!
  const key =
    detail.kind +
    ':' +
    (detail.kind === 'trace'
      ? detail.value.id
      : detail.kind === 'span'
        ? detail.value.spanId
        : detail.kind === 'mark'
          ? detail.value.sequence
          : detail.value.name)
  const saved = v.detailState.current[key]
  const [collapsed, setCollapsed] = useState(
    new Set<string>(saved?.collapsed ?? [])
  )
  const [attributes, setAttributes] = useState(saved?.attributes ?? '')
  const [layout, setLayout] = useState<'waterfall' | 'list'>(
    saved?.layout ?? 'waterfall'
  )
  const offset = useRef(saved?.offset ?? 0)
  useEffect(() => {
    if (Object.keys(v.detailState.current).length > 128)
      delete v.detailState.current[Object.keys(v.detailState.current)[0]]
    v.detailState.current[key] = {
      collapsed: [...collapsed],
      attributes,
      layout,
      offset: offset.current,
    }
  }, [collapsed, attributes, layout, key, v.detailState])
  const scrollProps = {
    contentOffset: { x: 0, y: offset.current },
    scrollEventThrottle: 100,
    onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      offset.current = event.nativeEvent.contentOffset.y
      if (v.detailState.current[key])
        v.detailState.current[key].offset = offset.current
    },
  }
  const items = useMemo(
    () =>
      detail.kind === 'trace'
        ? [
            ...hierarchyRows(detail.value.spans, collapsed).map((row) => ({
              kind: 'span' as const,
              row,
            })),
            ...detail.value.marks.map((mark) => ({
              kind: 'mark' as const,
              mark,
            })),
          ]
        : [],
    [detail, collapsed]
  )
  const traceIds = useMemo(
    () =>
      new Set(
        detail.kind === 'trace' ? detail.value.spans.map((s) => s.spanId) : []
      ),
    [detail]
  )
  if (detail.kind === 'trace') {
    const trace = detail.value
    const toggle = (spanId: string) =>
      setCollapsed((previous) => {
        const next = new Set(previous)
        if (next.has(spanId)) next.delete(spanId)
        else next.add(spanId)
        return next
      })
    return (
      <LegendList
        recycleItems
        {...scrollProps}
        style={styles.list}
        initialScrollOffset={offset.current}
        data={items}
        estimatedItemSize={64}
        keyExtractor={(item) =>
          item.kind === 'span'
            ? `span:${item.row.span.sequence}`
            : `mark:${item.mark.sequence}`
        }
        ListHeaderComponent={
          <View style={styles.traceHeader}>
            <Text style={styles.title}>{trace.name}</Text>
            <Text style={styles.subtitle}>
              {t('traceSummary', {
                duration: fixed(trace.duration),
                events: trace.spans.length + trace.marks.length,
                errors: trace.errors,
              })}
            </Text>
            <Text selectable style={styles.caption}>
              {trace.id} · {fixed(trace.start)}–
              {fixed(trace.start + trace.duration)} ms
            </Text>
            <EvictionNotice v={v} t={t} />
            <FrozenNotice v={v} t={t} />
            <Segmented
              options={[
                { value: 'waterfall', label: t('waterfall') },
                { value: 'list', label: t('spans') },
              ]}
              value={layout}
              onChange={setLayout}
            />
            <View style={styles.headerActions}>
              <TextButton
                label={t('expandAll')}
                onPress={() => setCollapsed(new Set())}
              />
              <TextButton
                label={t('collapseAll')}
                onPress={() =>
                  setCollapsed(new Set(trace.spans.map((span) => span.spanId)))
                }
              />
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('noSpans')}</Text>}
        renderItem={({ item }) => {
          if (item.kind === 'mark')
            return (
              <Row
                icon="◆"
                iconColor={apple.secondary}
                title={item.mark.name}
                value={`${fixed(item.mark.timestampMs)} ms`}
                onPress={() => v.open({ kind: 'mark', value: item.mark })}
              />
            )
          const { row } = item
          const error = row.span.outcome === 'error'
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => v.open({ kind: 'span', value: row.span })}
              style={({ pressed }) => [
                styles.spanRow,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.spanLine,
                  { paddingLeft: Math.min(8, row.depth) * 12 },
                ]}
              >
                {row.children > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${collapsed.has(row.span.spanId) ? t('expandAll') : t('collapseAll')} ${row.span.name}`}
                    onPress={() => toggle(row.span.spanId)}
                    hitSlop={10}
                  >
                    <Text style={styles.disclosure}>
                      {collapsed.has(row.span.spanId) ? '▸' : '▾'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.disclosure}> </Text>
                )}
                <Text
                  style={[styles.spanName, error && styles.error]}
                  numberOfLines={1}
                >
                  {row.span.name}
                  {row.children > 0 && (
                    <Text style={styles.subtitle}> ({row.children})</Text>
                  )}
                </Text>
                <Text style={[styles.spanValue, error && styles.error]}>
                  {row.span.durationMs.toFixed(
                    row.span.durationMs < 10 ? 1 : 0
                  )}{' '}
                  ms
                </Text>
              </View>
              {(v.query.search &&
                matchesSearch(row.span, v.query.search.toLowerCase())) ||
              (row.span.parentSpanId &&
                !traceIds.has(row.span.parentSpanId)) ? (
                <Text
                  style={[
                    styles.caption,
                    { paddingLeft: Math.min(8, row.depth) * 12 + 20 },
                  ]}
                >
                  {v.query.search &&
                  matchesSearch(row.span, v.query.search.toLowerCase())
                    ? t('searchMatch')
                    : t('missingParent')}
                </Text>
              ) : null}
              {layout === 'waterfall' && (
                <View style={styles.track}>
                  <View
                    style={[
                      styles.segment,
                      {
                        marginLeft: `${row.offset * 100}%`,
                        width: `${Math.max(0.5, row.width * 100)}%`,
                        backgroundColor: error ? palette.error : palette.accent,
                      },
                    ]}
                  />
                </View>
              )}
            </Pressable>
          )
        }}
      />
    )
  }
  if (detail.kind === 'metric')
    return (
      <ScrollView {...scrollProps} contentContainerStyle={styles.content}>
        <EvictionNotice v={v} t={t} />
        <MetricDetail series={detail.value} t={t} />
      </ScrollView>
    )
  const event = detail.value
  const span = detail.kind === 'span' ? detail.value : undefined
  const parent = span
    ? v.page.spans.find((s) => s.spanId === span.parentSpanId)
    : undefined
  const children = span
    ? v.page.spans.filter((s) => s.parentSpanId === span.spanId)
    : []
  const trace = span ? v.traceFor(span) : undefined
  const shownAttributes = event.attributes.filter((a) =>
    `${a.key} ${a.value}`.toLowerCase().includes(attributes.toLowerCase())
  )
  return (
    <ScrollView
      {...scrollProps}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.traceHeader}>
        <Text style={styles.title} selectable>
          {event.name}
        </Text>
        <EvictionNotice v={v} t={t} />
      </View>
      <Section>
        {span && (
          <Row
            title={t('outcome')}
            value={t(span.outcome)}
            tint={span.outcome === 'error' ? palette.error : undefined}
          />
        )}
        {span && (
          <Row
            title={t('duration')}
            value={`${span.durationMs.toFixed(2)} ms`}
          />
        )}
        <Row title={t('source')} value={sourceOf(event)} />
        <Row
          title={t('time')}
          value={`${fixed(event.timestampMs)}–${fixed(event.timestampMs + (span?.durationMs ?? 0))} ms`}
        />
        <Row
          title={t('correlationId')}
          subtitle={event.correlationId || t('uncorrelated')}
          last={!span}
        />
        {span && <Row title={t('spanId')} subtitle={span.spanId} last />}
      </Section>
      <Section
        footer={span?.parentSpanId && !parent ? t('missingParent') : undefined}
      >
        {trace && (
          <Row
            icon="☰"
            title={t('wholeTrace')}
            onPress={() => v.open({ kind: 'trace', value: trace })}
          />
        )}
        {parent && (
          <Row
            icon="↑"
            title={t('parent')}
            subtitle={parent.name}
            onPress={() => v.open({ kind: 'span', value: parent })}
          />
        )}
        <Row
          icon="⌕"
          title={t('similar')}
          onPress={() =>
            (detail.kind === 'mark' ? v.showMarks : v.showSpans)({
              search: event.name,
            })
          }
          last
        />
      </Section>
      {event.attributes.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('attributes')}</Text>
          {event.attributes.length > 6 && (
            <SearchField
              value={attributes}
              onChange={setAttributes}
              placeholder={t('attributeSearch')}
            />
          )}
          <Section>
            {shownAttributes.map((a, index) => (
              <Row
                key={a.key}
                title={a.key}
                subtitle={a.value}
                last={index === shownAttributes.length - 1}
              />
            ))}
          </Section>
        </>
      )}
      {children.length > 0 && (
        <Section header={t('children')}>
          {children.map((child, index) => (
            <Row
              key={child.spanId}
              title={child.name}
              value={`${child.durationMs.toFixed(1)} ms`}
              tint={child.outcome === 'error' ? palette.error : undefined}
              onPress={() => v.open({ kind: 'span', value: child })}
              last={index === children.length - 1}
            />
          ))}
        </Section>
      )}
    </ScrollView>
  )
}

function EvictionNotice({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const earliest =
    useStore(v.telemetry, (s) => s.pending?.earliestSequence) ??
    v.page.earliestSequence
  const detail = v.detail
  if (!detail) return null
  const events =
    detail.kind === 'trace'
      ? [...detail.value.spans, ...detail.value.marks]
      : detail.kind === 'metric'
        ? detail.value.samples
        : [detail.value]
  return events.some((event) => event.sequence < earliest) ? (
    <Text style={[styles.caption, styles.error]}>{t('evicted')}</Text>
  ) : null
}
function FrozenNotice({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const pending = useStore(v.telemetry, (s) => s.pending)
  return pending ? (
    <Text style={styles.caption}>{t('detailFrozen')}</Text>
  ) : null
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingBottom: 32 },
  traceHeader: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },
  title: { fontSize: 22, fontWeight: '700', color: palette.text },
  subtitle: { fontSize: 15, color: apple.secondary },
  caption: { fontSize: 12, color: apple.secondary },
  error: { color: palette.error },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    color: apple.secondary,
    textTransform: 'uppercase',
    marginLeft: 32,
    marginTop: 20,
  },
  spanRow: {
    backgroundColor: apple.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: apple.separator,
  },
  pressed: { backgroundColor: '#e5e5ea' },
  spanLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disclosure: { width: 14, fontSize: 13, color: apple.secondary },
  spanName: { flex: 1, fontSize: 15, color: palette.text },
  spanValue: {
    fontSize: 13,
    color: apple.secondary,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: apple.fill,
    overflow: 'hidden',
  },
  segment: { height: 4, borderRadius: 2 },
  chartCard: { padding: 16, gap: 8, backgroundColor: apple.card },
  chart: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: {
    flex: 1,
    minHeight: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: palette.accent,
  },
  empty: {
    fontSize: 15,
    color: apple.secondary,
    textAlign: 'center',
    padding: 32,
  },
})
