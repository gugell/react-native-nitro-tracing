import { useSelector } from '@legendapp/state/react'
import { LegendList } from '@legendapp/list/react-native'
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { Viewer, Metric } from './useTraceViewer'
import type { InspectorTranslator } from './labels'
import { hierarchyRows, sourceOf, matchesSearch } from './explorerModel'
import { Button, Field, ui } from './InspectorControls'
export function MetricDetail({
  series,
  t,
}: {
  series: Metric
  t: InspectorTranslator
}) {
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>{series.name}</Text>
      <Text style={ui.text}>
        {t('metricStats', {
          latest: series.latest.toFixed(1),
          median: series.median.toFixed(1),
          min: series.min.toFixed(1),
          max: series.peak.toFixed(1),
          p95: series.p95.toFixed(1),
          count: series.retainedCount,
        })}
      </Text>
      <Text style={ui.muted}>
        {t('metricWindow', {
          displayed: series.samples.length,
          retained: series.retainedCount,
          start: series.startMs.toFixed(1),
          end: series.endMs.toFixed(1),
        })}
      </Text>
      <View style={ui.chart}>
        {series.samples.map((sample) => (
          <View
            key={sample.sequence}
            accessibilityLabel={`${sample.value.toFixed(2)} ${sample.unit}`}
            style={[
              ui.bar,
              {
                height: `${Math.max(2, (Math.abs(sample.value) / series.max) * 100)}%`,
              },
            ]}
          />
        ))}
      </View>
      {series.samples.at(-1)?.attributes.map((attribute) => (
        <Text selectable key={attribute.key} style={ui.muted}>
          {attribute.key}: {attribute.value}
        </Text>
      ))}
      <Text style={ui.muted}>{t('metricsScope')}</Text>
    </View>
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
  if (detail.kind === 'trace') {
    const trace = detail.value
    return (
      <LegendList
        recycleItems
        {...scrollProps}
        initialScrollOffset={offset.current}
        data={items}
        keyExtractor={(item) =>
          item.kind === 'span'
            ? item.row.span.spanId
            : `mark:${item.mark.sequence}`
        }
        ListHeaderComponent={
          <View style={ui.content}>
            <Text style={ui.title}>{trace.name}</Text>
            <Text style={ui.muted}>
              {t('traceSummary', {
                duration: trace.duration.toFixed(1),
                events: trace.spans.length + trace.marks.length,
                errors: trace.errors,
              })}
            </Text>
            <Text selectable style={ui.muted}>
              {trace.id} · {trace.start.toFixed(1)}–
              {(trace.start + trace.duration).toFixed(1)} ms
            </Text>
            <EvictionNotice v={v} t={t} />
            {v.pending && <Text style={ui.muted}>{t('detailFrozen')}</Text>}
            <View style={ui.row}>
              <Button
                label={t('waterfall')}
                selected={layout === 'waterfall'}
                onPress={() => setLayout('waterfall')}
              />
              <Button
                label={t('spans')}
                selected={layout === 'list'}
                onPress={() => setLayout('list')}
              />
              <Button
                label={t('expandAll')}
                onPress={() => setCollapsed(new Set())}
              />
              <Button
                label={t('collapseAll')}
                onPress={() =>
                  setCollapsed(new Set(trace.spans.map((span) => span.spanId)))
                }
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={ui.content}>
            <Text style={ui.muted}>{t('noSpans')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'mark')
            return (
              <Pressable
                accessibilityRole="button"
                style={ui.item}
                onPress={() => v.open({ kind: 'mark', value: item.mark })}
              >
                <Text style={ui.text}>{item.mark.name}</Text>
                <Text style={ui.muted}>
                  {item.mark.timestampMs.toFixed(1)} ms
                </Text>
              </Pressable>
            )
          const row = item.row
          return (
            <View style={ui.item}>
              <View
                style={[ui.row, { paddingLeft: Math.min(8, row.depth) * 10 }]}
              >
                {row.children > 0 && (
                  <Button
                    label={`${collapsed.has(row.span.spanId) ? '▸' : '▾'} ${row.children}`}
                    onPress={() =>
                      setCollapsed((previous) => {
                        const next = new Set(previous)
                        if (next.has(row.span.spanId))
                          next.delete(row.span.spanId)
                        else next.add(row.span.spanId)
                        return next
                      })
                    }
                  />
                )}
                <Pressable
                  accessibilityRole="button"
                  style={{ flex: 1, gap: 5 }}
                  onPress={() => v.open({ kind: 'span', value: row.span })}
                >
                  <Text style={ui.heading}>{row.span.name}</Text>
                  {v.query.search &&
                    matchesSearch(row.span, v.query.search.toLowerCase()) && (
                      <Text style={ui.link}>{t('searchMatch')}</Text>
                    )}
                  <Text
                    style={row.span.outcome === 'error' ? ui.error : ui.muted}
                  >
                    {row.span.durationMs.toFixed(2)} ms · {t(row.span.outcome)}
                  </Text>
                  {row.span.parentSpanId &&
                    !trace.spans.some(
                      (s) => s.spanId === row.span.parentSpanId
                    ) && <Text style={ui.muted}>{t('missingParent')}</Text>}
                </Pressable>
              </View>
              {layout === 'waterfall' && (
                <View style={ui.track}>
                  <View
                    style={{
                      height: 7,
                      marginLeft: `${row.offset * 100}%`,
                      width: `${Math.max(0.5, row.width * 100)}%`,
                      backgroundColor:
                        row.span.outcome === 'error' ? '#ff8d98' : '#a8c7ff',
                    }}
                  />
                </View>
              )}
            </View>
          )
        }}
      />
    )
  }
  if (detail.kind === 'metric')
    return (
      <ScrollView {...scrollProps} contentContainerStyle={ui.content}>
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
  return (
    <ScrollView
      {...scrollProps}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled"
    >
      <EvictionNotice v={v} t={t} />
      <Text style={ui.title}>{event.name}</Text>
      <View style={ui.card}>
        <Text style={ui.text}>
          {span
            ? `${t(span.outcome)} · ${span.durationMs.toFixed(2)} ms`
            : t('marks')}
        </Text>
        <Text style={ui.muted}>
          {sourceOf(event)} · {event.timestampMs.toFixed(1)}–
          {(event.timestampMs + (span?.durationMs ?? 0)).toFixed(1)} ms
        </Text>
        <Text selectable style={ui.muted}>
          {event.correlationId || t('uncorrelated')}
        </Text>
        {span && (
          <Text selectable style={ui.muted}>
            {span.spanId}
          </Text>
        )}
      </View>
      <View style={ui.row}>
        {trace && (
          <Button
            label={t('wholeTrace')}
            onPress={() => v.open({ kind: 'trace', value: trace })}
          />
        )}
        <Button
          label={t('similar')}
          onPress={() =>
            (detail.kind === 'mark' ? v.showMarks : v.showSpans)({
              search: event.name,
            })
          }
        />
        {parent && (
          <Button
            label={t('parent')}
            onPress={() => v.open({ kind: 'span', value: parent })}
          />
        )}
      </View>
      {span?.parentSpanId && !parent && (
        <Text style={ui.muted}>{t('missingParent')}</Text>
      )}
      <Field
        label={t('attributes')}
        value={attributes}
        onChange={setAttributes}
      />
      {event.attributes
        .filter((a) =>
          `${a.key} ${a.value}`.toLowerCase().includes(attributes.toLowerCase())
        )
        .map((a) => (
          <View key={a.key} style={ui.card}>
            <Text style={ui.muted}>{a.key}</Text>
            <Text selectable style={ui.text}>
              {a.value}
            </Text>
          </View>
        ))}
      {children.length > 0 && <Text style={ui.heading}>{t('children')}</Text>}
      {children.map((child) => (
        <Button
          key={child.spanId}
          label={`${child.name} · ${child.durationMs.toFixed(1)} ms`}
          onPress={() => v.open({ kind: 'span', value: child })}
        />
      ))}
    </ScrollView>
  )
}

function EvictionNotice({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const earliest =
    useSelector(() => v.telemetry.pending.earliestSequence.get()) ??
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
    <Text style={ui.error}>{t('evicted')}</Text>
  ) : null
}
