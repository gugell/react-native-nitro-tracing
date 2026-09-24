import { LegendList } from '@legendapp/list/react-native'
import React, { useCallback } from 'react'
import { StyleSheet, Text } from 'react-native'
import type { InspectorTranslator } from './labels'
import type { Viewer } from './useTraceViewer'
import { topicGlyph, type TimelineItem } from './topics'
import { openEvent } from './SummaryView'
import { formatMetric } from './viewerModel'
import { apple, palette, Row } from './InspectorControls'

const valueOf = (item: Extract<TimelineItem, { kind: 'event' }>) =>
  'durationMs' in item.event
    ? formatMetric(item.event.durationMs, 'ms')
    : 'value' in item.event
      ? formatMetric(item.event.value, item.event.unit)
      : undefined
const messageOf = (item: Extract<TimelineItem, { kind: 'event' }>) =>
  item.event.attributes.find((a) => a.key === 'message')?.value

/** Newest screen visit first; section headers are the screens the events happened on. */
export function TimelineView({ v, t }: { v: Viewer; t: InspectorTranslator }) {
  const renderItem = useCallback(
    ({ item }: { item: TimelineItem }) => {
      if (item.kind === 'screen')
        return (
          <Text style={styles.header}>
            {item.name || t('beforeNavigation')} ·{' '}
            {(item.timestampMs / 1000).toFixed(1)} s
          </Text>
        )
      const message = messageOf(item)
      return (
        <Row
          icon={topicGlyph[item.topic].icon}
          iconColor={topicGlyph[item.topic].color}
          title={item.event.name}
          subtitle={`${(item.event.timestampMs / 1000).toFixed(2)} s${message ? ` · ${message}` : ''}`}
          value={valueOf(item)}
          tint={item.issue ? palette.error : undefined}
          onPress={() => openEvent(v, item.event)}
        />
      )
    },
    // openEvent reads v.metrics at press time; rows only need new props when data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, v.metrics]
  )
  return (
    <LegendList<TimelineItem>
      recycleItems
      contentInsetAdjustmentBehavior="automatic"
      style={styles.list}
      data={v.timeline}
      keyExtractor={(item) => item.key}
      getItemType={(item) => item.kind}
      estimatedItemSize={60}
      initialScrollOffset={v.offsets.current.timeline ?? 0}
      onScroll={(event) => {
        v.offsets.current.timeline = event.nativeEvent.contentOffset.y
      }}
      scrollEventThrottle={100}
      onScrollBeginDrag={() => v.setHolding(true)}
      ListEmptyComponent={<Text style={styles.empty}>{t('empty')}</Text>}
      renderItem={renderItem}
    />
  )
}

const styles = StyleSheet.create({
  list: { flex: 1 },
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
