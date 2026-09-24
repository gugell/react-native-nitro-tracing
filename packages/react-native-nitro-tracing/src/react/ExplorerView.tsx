import React, { useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import type { InspectorTranslator } from './labels'
import type { Viewer } from './useTraceViewer'
import { sourceOf, type Event, type Trace, type Sort } from './explorerModel'
import { Button, Field, ui } from './InspectorControls'
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
const isTrace = (item: Trace | Event): item is Trace => 'spans' in item
export function ExplorerView({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const [filters, setFilters] = useState(false)
  const sources = [
    ...new Set([...v.page.spans, ...v.page.marks].map(sourceOf)),
  ].sort()
  const sorts: Sort[] =
    v.mode === 'traces'
      ? ['newest', 'oldest', 'longest', 'errors', 'count', 'name']
      : v.mode === 'spans'
        ? ['newest', 'oldest', 'longest', 'shortest', 'name']
        : ['newest', 'oldest', 'name']
  const invalid =
    [v.query.from, v.query.to, v.query.minDuration].some(
      (value) =>
        value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)
    ) ||
    Boolean(
      v.query.from && v.query.to && Number(v.query.from) > Number(v.query.to)
    )
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
  return (
    <View style={{ flex: 1 }}>
      <View style={ui.header}>
        <View style={ui.row}>
          {(['traces', 'spans', 'marks'] as const).map((mode) => (
            <Button
              key={mode}
              label={t(mode)}
              selected={v.mode === mode}
              onPress={() => v.setMode(mode)}
            />
          ))}
        </View>
        <Field
          label={t('exploreSearch')}
          value={v.query.search}
          onChange={(search) => v.updateQuery({ search })}
        />
        <View style={ui.row}>
          {chips.map((chip) => (
            <Button
              key={chip.key}
              label={`${chip.label} ×`}
              onPress={chip.clear}
            />
          ))}
          {(chips.length > 0 || v.query.search) && (
            <Button label={t('reset')} onPress={v.resetQuery} />
          )}
        </View>
        <View style={ui.spread}>
          <Text style={ui.muted}>
            {t('resultCount', { matching: v.results.length, loaded: v.loaded })}
          </Text>
          <Button
            label={`${t(v.query.sort)} · ${t('filters')}`}
            onPress={() => {
              v.setHolding(true)
              setFilters(true)
            }}
          />
        </View>
        {invalid && <Text style={ui.error}>{t('invalidRange')}</Text>}
        {v.mode === 'traces' && v.uncorrelated > 0 && (
          <Text style={ui.muted}>
            {t('uncorrelatedHint', { count: v.uncorrelated })}
          </Text>
        )}
      </View>
      <FlatList
        key={v.mode}
        data={invalid ? [] : (v.results as (Trace | Event)[])}
        keyExtractor={(item) =>
          isTrace(item)
            ? item.id
            : 'spanId' in item
              ? item.spanId
              : String(item.sequence)
        }
        keyboardShouldPersistTaps="handled"
        contentOffset={{ x: 0, y: v.offsets.current[v.mode] ?? 0 }}
        onScroll={(event) => {
          v.offsets.current[v.mode] = event.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={100}
        onScrollBeginDrag={() => v.setHolding(true)}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={7}
        ListEmptyComponent={
          <View style={ui.content}>
            <Text style={ui.muted}>{t('noResults')}</Text>
            <Button label={t('reset')} onPress={v.resetQuery} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={ui.item}
            onPress={() =>
              v.open(
                isTrace(item)
                  ? { kind: 'trace', value: item }
                  : 'spanId' in item
                    ? { kind: 'span', value: item }
                    : { kind: 'mark', value: item }
              )
            }
          >
            <View style={ui.spread}>
              <Text numberOfLines={2} style={[ui.heading, { flex: 1 }]}>
                {item.name}
              </Text>
              <Text style={ui.text}>
                {isTrace(item)
                  ? `${item.duration.toFixed(1)} ms`
                  : 'durationMs' in item
                    ? `${item.durationMs.toFixed(1)} ms`
                    : ''}
              </Text>
            </View>
            <Text style={ui.muted}>
              {isTrace(item)
                ? t('traceRow', {
                    spans: item.spans.length,
                    errors: item.errors,
                    source: item.sources.join(', '),
                  })
                : `${'outcome' in item ? t(item.outcome) : t('marks')} · ${sourceOf(item)} · ${item.timestampMs.toFixed(1)} ms`}
            </Text>
            <Text numberOfLines={1} style={ui.muted}>
              {isTrace(item)
                ? item.id
                : item.correlationId || t('uncorrelated')}
            </Text>
          </Pressable>
        )}
      />
      <Modal
        visible={filters}
        animationType="slide"
        onRequestClose={() => setFilters(false)}
      >
        <SafeAreaProvider>
          <SafeAreaView style={ui.root}>
            <View style={ui.header}>
              <View style={ui.spread}>
                <Text style={ui.title}>{t('filters')}</Text>
                <Button
                  label={t('done')}
                  onPress={() => setFilters(false)}
                  disabled={invalid}
                />
              </View>
            </View>
            <ScrollView
              contentContainerStyle={ui.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={ui.heading}>{t('sort')}</Text>
              <View style={ui.row}>
                {sorts.map((sort) => (
                  <Button
                    key={sort}
                    label={t(sort)}
                    selected={sort === v.query.sort}
                    onPress={() => v.updateQuery({ sort })}
                  />
                ))}
              </View>
              {v.mode !== 'marks' && (
                <>
                  <Text style={ui.heading}>{t('outcome')}</Text>
                  <View style={ui.row}>
                    {(v.mode === 'traces'
                      ? ['error', 'success']
                      : ['success', 'error', 'cancelled', 'interrupted']
                    ).map((outcome) => (
                      <Button
                        key={outcome}
                        label={t(
                          outcome === 'success' && v.mode === 'traces'
                            ? 'noErrors'
                            : (outcome as 'success')
                        )}
                        selected={v.query.outcomes.includes(outcome)}
                        onPress={() =>
                          v.updateQuery({
                            outcomes: toggle(v.query.outcomes, outcome),
                          })
                        }
                      />
                    ))}
                  </View>
                  <Field
                    label={t('minDuration')}
                    numeric
                    value={v.query.minDuration}
                    onChange={(minDuration) => v.updateQuery({ minDuration })}
                  />
                </>
              )}
              <Text style={ui.heading}>{t('source')}</Text>
              <View style={ui.row}>
                {sources.map((source) => (
                  <Button
                    key={source}
                    label={source}
                    selected={v.query.sources.includes(source)}
                    onPress={() =>
                      v.updateQuery({
                        sources: toggle(v.query.sources, source),
                      })
                    }
                  />
                ))}
              </View>
              <Field
                label={t('from')}
                numeric
                value={v.query.from}
                onChange={(from) => v.updateQuery({ from })}
              />
              <Field
                label={t('to')}
                numeric
                value={v.query.to}
                onChange={(to) => v.updateQuery({ to })}
              />
              <Field
                label={t('correlation')}
                value={v.query.correlation}
                onChange={(correlation) => v.updateQuery({ correlation })}
              />
              {invalid && <Text style={ui.error}>{t('invalidRange')}</Text>}
              <Button label={t('reset')} onPress={v.resetQuery} />
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  )
}
