import { LegendList } from '@legendapp/list/react-native'
import React, { useState, useMemo } from 'react'
import { InspectorSheet } from './InspectorSheet'
import { Pressable, Text, View } from 'react-native'
import type { Viewer } from './useTraceViewer'
import type { InspectorTranslator } from './labels'
import { Button, Field, ui } from './InspectorControls'
export function MetricsView({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const [filters, setFilters] = useState(false)
  const category = (name: string) =>
    name.startsWith('duration: ')
      ? 'operations'
      : name.startsWith('js.') || name.startsWith('app.ready.')
        ? 'runtime'
        : 'custom'
  const metrics = useMemo(
    () =>
      v.metrics
        .filter(
          (series) =>
            (v.metricCategory === 'all' ||
              category(series.name) === v.metricCategory) &&
            series.name.toLowerCase().includes(v.metricQuery.toLowerCase())
        )
        .sort((a, b) =>
          v.metricSort === 'name'
            ? a.name.localeCompare(b.name)
            : v.metricSort === 'count'
              ? b.retainedCount - a.retainedCount ||
                a.name.localeCompare(b.name)
              : b.p95 - a.p95 || a.name.localeCompare(b.name)
        ),
    [v.metrics, v.metricCategory, v.metricQuery, v.metricSort]
  )
  return (
    <View style={{ flex: 1 }}>
      <View style={ui.header}>
        <Field
          label={t('metricSearch')}
          value={v.metricQuery}
          onChange={v.setMetricQuery}
        />
        <Button
          label={t('filters')}
          onPress={() => {
            v.setHolding(true)
            setFilters(true)
          }}
        />
      </View>
      {filters && (
        <InspectorSheet
          visible
          title={t('filters')}
          close={() => setFilters(false)}
          closeLabel={t('done')}
        >
          <View style={ui.content}>
            <View style={ui.row}>
              {(['all', 'runtime', 'operations', 'custom'] as const).map(
                (category) => (
                  <Button
                    key={category}
                    label={t(category)}
                    selected={v.metricCategory === category}
                    onPress={() => v.setMetricCategory(category)}
                  />
                )
              )}
            </View>
            <View style={ui.row}>
              {(['name', 'count', 'p95'] as const).map((sort) => (
                <Button
                  key={sort}
                  label={t(sort)}
                  selected={v.metricSort === sort}
                  onPress={() => v.setMetricSort(sort)}
                />
              ))}
            </View>
            <Text style={ui.muted}>{t('metricSortNotice')}</Text>
          </View>
        </InspectorSheet>
      )}
      <LegendList
        recycleItems
        data={metrics}
        initialScrollOffset={v.offsets.current.metrics ?? 0}
        onScroll={(event) => {
          v.offsets.current.metrics = event.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={100}
        onScrollBeginDrag={() => v.setHolding(true)}
        keyExtractor={(series) => series.name}
        ListEmptyComponent={
          <View style={ui.content}>
            <Text style={ui.muted}>{t('emptyMetrics')}</Text>
          </View>
        }
        renderItem={({ item: series }) => (
          <Pressable
            accessibilityRole="button"
            style={ui.item}
            onPress={() => v.open({ kind: 'metric', value: series })}
          >
            <Text style={ui.heading}>{series.name}</Text>
            <Text style={ui.text}>
              {t('metricBrief', {
                latest: series.latest.toFixed(1),
                p95: series.p95.toFixed(1),
                count: series.retainedCount,
              })}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          v.metricCategory === 'operations' ? (
            <View style={ui.content}>
              <Text style={ui.heading}>{t('operations')}</Text>
              {v.operations
                .filter((op) =>
                  op.name.toLowerCase().includes(v.metricQuery.toLowerCase())
                )
                .slice(0, 40)
                .map((op) => (
                  <Pressable
                    key={op.name}
                    style={ui.card}
                    onPress={() => v.showSpans({ search: op.name })}
                  >
                    <Text style={ui.text}>{op.name}</Text>
                    <Text style={ui.muted}>
                      {t('operationStats', {
                        ...op,
                        errorRate:
                          op.errorRate === undefined
                            ? '—'
                            : `${op.errorRate.toFixed(1)}%`,
                      })}
                    </Text>
                  </Pressable>
                ))}
            </View>
          ) : null
        }
      />
    </View>
  )
}
