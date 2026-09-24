import { LegendList } from '@legendapp/list/react-native'
import React, { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ExplorerFilters } from './ExplorerFilters'
import { useMenu } from './native'
import type { InspectorTranslator } from './labels'
import type { Viewer } from './useTraceViewer'
import { sourceOf, type Event, type Sort, type Trace } from './explorerModel'
import {
  apple,
  palette,
  Row,
  SearchField,
  Segmented,
} from './InspectorControls'

const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
const isTrace = (item: Trace | Event): item is Trace => 'spans' in item
const keyOf = (item: Trace | Event) =>
  isTrace(item)
    ? item.id
    : // Sequence is unique per event; span ids can repeat if a collector reuses one.
      `${'spanId' in item ? 'span' : 'mark'}:${item.sequence}`
export const sortsFor = (mode: Viewer['mode']): Sort[] =>
  mode === 'traces'
    ? ['newest', 'oldest', 'longest', 'errors', 'count', 'name']
    : mode === 'spans'
      ? ['newest', 'oldest', 'longest', 'shortest', 'name']
      : ['newest', 'oldest', 'name']

export function ExplorerView({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const [filters, setFilters] = useState(false)
  const menu = useMenu()
  const chips = [
    ...v.query.outcomes.map((value) => ({
      key: `outcome:${value}`,
      label: t(
        value === 'success' && v.mode === 'traces'
          ? 'noErrors'
          : (value as 'success')
      ),
      clear: () => v.updateQuery({ outcomes: toggle(v.query.outcomes, value) }),
    })),
    ...v.query.sources.map((value) => ({
      key: `source:${value}`,
      label: value,
      clear: () => v.updateQuery({ sources: toggle(v.query.sources, value) }),
    })),
    ...(['minDuration', 'from', 'to', 'correlation'] as const)
      .filter((key) => v.query[key])
      .map((key) => ({
        key,
        label: `${t(key)}: ${v.query[key]}`,
        clear: () => v.updateQuery({ [key]: '' }),
      })),
  ]
  const { open } = v
  const renderItem = useCallback(
    ({ item }: { item: Trace | Event }) => {
      if (isTrace(item))
        return (
          <Row
            title={item.name}
            subtitle={t('traceRow', {
              spans: item.spans.length,
              errors: item.errors,
              source: item.sources.join(', '),
            })}
            value={`${item.duration.toFixed(0)} ms`}
            tint={item.errors ? palette.error : undefined}
            onPress={() => open({ kind: 'trace', value: item })}
          />
        )
      const span = 'spanId' in item ? item : undefined
      return (
        <Row
          title={item.name}
          subtitle={`${span ? t(span.outcome) : t('marks')} · ${sourceOf(item)} · ${(item.timestampMs / 1000).toFixed(2)} s`}
          value={span ? `${span.durationMs.toFixed(0)} ms` : undefined}
          tint={span?.outcome === 'error' ? palette.error : undefined}
          onPress={() =>
            open(
              span
                ? { kind: 'span', value: span }
                : { kind: 'mark', value: item as never }
            )
          }
        />
      )
    },
    [open, t]
  )
  return (
    <View style={styles.root}>
      <SearchField
        value={v.query.search}
        onChange={(search) => v.updateQuery({ search })}
        placeholder={t('exploreSearch')}
      />
      <Segmented
        options={(['traces', 'spans', 'marks'] as const).map((mode) => ({
          value: mode,
          label: t(mode),
        }))}
        value={v.mode}
        onChange={v.setMode}
      />
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            menu.open({
              title: t('sort'),
              cancelLabel: t('cancel'),
              options: sortsFor(v.mode).map((sort) => ({
                label: t(sort),
                selected: sort === v.query.sort,
                onPress: () => v.updateQuery({ sort }),
              })),
            })
          }
          hitSlop={8}
        >
          <Text style={styles.toolbarButton}>
            {t('sortBy', { sort: t(v.query.sort) })} ⌄
          </Text>
        </Pressable>
        <Text style={styles.count}>
          {t('resultCount', { matching: v.results.length, loaded: v.loaded })}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            v.setHolding(true)
            setFilters(true)
          }}
          hitSlop={8}
        >
          <Text style={styles.toolbarButton}>
            {t('filter')}
            {chips.length ? ` (${chips.length})` : ''} ⌄
          </Text>
        </Pressable>
      </View>
      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label}, ${t('reset')}`}
              onPress={chip.clear}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{chip.label} ✕</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={v.resetQuery}
            style={styles.chipClear}
          >
            <Text style={styles.toolbarButton}>{t('reset')}</Text>
          </Pressable>
        </View>
      )}
      {v.mode === 'traces' && v.uncorrelated > 0 && !chips.length && (
        <Text style={styles.hint}>
          {t('uncorrelatedHint', { count: v.uncorrelated })}
        </Text>
      )}
      <LegendList
        recycleItems
        contentInsetAdjustmentBehavior="automatic"
        key={v.mode}
        style={styles.list}
        data={v.results as (Trace | Event)[]}
        keyExtractor={keyOf}
        estimatedItemSize={64}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialScrollOffset={v.offsets.current[v.mode] ?? 0}
        onScroll={(event) => {
          v.offsets.current[v.mode] = event.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={100}
        onScrollBeginDrag={() => v.setHolding(true)}
        ListEmptyComponent={<Text style={styles.empty}>{t('noResults')}</Text>}
        renderItem={renderItem}
      />
      {menu.element}
      {filters && (
        <ExplorerFilters v={v} t={t} close={() => setFilters(false)} />
      )}
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
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  toolbarButton: { fontSize: 15, color: palette.accent, fontWeight: '500' },
  count: { flex: 1, textAlign: 'center', fontSize: 13, color: apple.secondary },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: palette.selected,
  },
  chipText: { fontSize: 13, color: palette.accent },
  chipClear: { paddingHorizontal: 4, paddingVertical: 4 },
  hint: {
    fontSize: 13,
    color: apple.secondary,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: { flex: 1, backgroundColor: apple.card },
  empty: {
    fontSize: 15,
    color: apple.secondary,
    textAlign: 'center',
    padding: 32,
  },
})
