import { LegendList } from '@legendapp/list/react-native'
import React, { useCallback, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Metric, Viewer } from './useTraceViewer'
import { formatMetric } from './viewerModel'
import type { InspectorTranslator } from './labels'
import { useMenu } from './native'
import {
  apple,
  palette,
  Row,
  SearchField,
  Segmented,
} from './InspectorControls'

const categories = ['all', 'runtime', 'operations', 'custom'] as const
const sorts = ['name', 'count', 'p95'] as const
const category = (name: string) =>
  name.startsWith('duration: ')
    ? 'operations'
    : /^(js|ui|process|app)\./.test(name)
      ? 'runtime'
      : 'custom'

export function MetricsView({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const menu = useMenu()
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
  const { open } = v
  const renderItem = useCallback(
    ({ item }: { item: Metric }) => (
      <Row
        title={item.metric}
        subtitle={t('metricBrief', {
          latest: formatMetric(item.latest, item.unit),
          p95: formatMetric(item.p95, item.unit),
          count: item.retainedCount,
        })}
        value={formatMetric(item.latest, item.unit)}
        onPress={() => open({ kind: 'metric', value: item })}
      />
    ),
    [open, t]
  )
  return (
    <View style={styles.root}>
      <SearchField
        value={v.metricQuery}
        onChange={v.setMetricQuery}
        placeholder={t('metricSearch')}
      />
      <Segmented
        options={categories.map((value) => ({
          value,
          label: t(value === 'operations' ? 'operationsShort' : value),
        }))}
        value={v.metricCategory as (typeof categories)[number]}
        onChange={v.setMetricCategory}
      />
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            menu.open({
              title: t('sort'),
              cancelLabel: t('cancel'),
              options: sorts.map((sort) => ({
                label: t(sort),
                selected: sort === v.metricSort,
                onPress: () => v.setMetricSort(sort),
              })),
            })
          }
          hitSlop={8}
        >
          <Text style={styles.toolbarButton}>
            {t('sortBy', {
              sort: t(v.metricSort as (typeof sorts)[number]),
            })}{' '}
            ⌄
          </Text>
        </Pressable>
        <Text style={styles.count}>{metrics.length}</Text>
      </View>
      <LegendList
        recycleItems
        contentInsetAdjustmentBehavior="automatic"
        style={styles.list}
        data={metrics}
        keyExtractor={(series) => series.name}
        estimatedItemSize={56}
        keyboardDismissMode="on-drag"
        initialScrollOffset={v.offsets.current.metrics ?? 0}
        onScroll={(event) => {
          v.offsets.current.metrics = event.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={100}
        onScrollBeginDrag={() => v.setHolding(true)}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('emptyMetrics')}</Text>
        }
        renderItem={renderItem}
        ListFooterComponent={
          v.metricCategory === 'operations' && v.operations.length ? (
            <View>
              <Text style={styles.header}>{t('operations')}</Text>
              {v.operations
                .filter((op) =>
                  op.name.toLowerCase().includes(v.metricQuery.toLowerCase())
                )
                .slice(0, 40)
                .map((op) => (
                  <Row
                    key={op.name}
                    title={op.name}
                    subtitle={t('operationStats', {
                      ...op,
                      errorRate:
                        op.errorRate === undefined
                          ? '—'
                          : `${op.errorRate.toFixed(1)}%`,
                    })}
                    tint={op.errors ? palette.error : undefined}
                    onPress={() => v.showSpans({ search: op.name })}
                  />
                ))}
            </View>
          ) : null
        }
      />
      {menu.element}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  toolbarButton: { fontSize: 15, color: palette.accent, fontWeight: '500' },
  count: { fontSize: 13, color: apple.secondary },
  list: { flex: 1, backgroundColor: apple.card },
  header: {
    fontSize: 13,
    fontWeight: '600',
    color: apple.secondary,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
    backgroundColor: apple.grouped,
  },
  empty: {
    fontSize: 15,
    color: apple.secondary,
    textAlign: 'center',
    padding: 32,
  },
})
