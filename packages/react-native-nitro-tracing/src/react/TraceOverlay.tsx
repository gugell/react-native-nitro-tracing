import React, {
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import {
  initialWindowMetrics,
  SafeAreaInsetsContext,
} from 'react-native-safe-area-context'
import type { TraceClient } from '../client/createTraceClient'
import { palette } from './InspectorControls'
import {
  createTranslator,
  type InspectorLabels,
  type InspectorTranslator,
} from './labels'
import {
  buildTimeline,
  currentVisit,
  defaultBudgets,
  latestMetric,
  summarizeTopics,
  topicGlyph,
  type Budgets,
  type VisitSummary,
} from './topics'
import { useLiveRecording } from './useLiveRecording'
import { Glass } from './native'

type Detent = 'closed' | 'peek' | 'half'
const BUBBLE = 56
const PEEK = 150
const noInsets = { top: 0, right: 0, bottom: 0, left: 0 }
/** The app's safe-area provider when present, else launch metrics; never adds a native view. */
const useInsets = () =>
  useContext(SafeAreaInsetsContext) ?? initialWindowMetrics?.insets ?? noInsets
const round = (value?: number) =>
  value === undefined ? '—' : Math.round(value)

/**
 * Floating entry point and live, non-modal sheet for the current screen. The app stays
 * usable above the sheet; mount it last at the app root. It sits below the app's own
 * native modals. Rendering it is the app's decision (e.g. internal or UAT builds only).
 */
export function TraceOverlay({
  client,
  labels,
  translate,
  budgets,
  bottomOffset = 0,
}: {
  client: TraceClient
  labels?: Partial<InspectorLabels>
  translate?: InspectorTranslator
  budgets?: Partial<Budgets>
  /** Dock the sheet this far above the bottom edge, e.g. the app's tab bar height, so it stays usable. */
  bottomOffset?: number
}) {
  return (
    // Plain Views only: a native provider here would swallow touches on Android.
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Overlay
        client={client}
        t={translate ?? createTranslator(labels)}
        budgets={{ ...defaultBudgets, ...budgets }}
        bottomOffset={bottomOffset}
      />
    </View>
  )
}

function Overlay({
  client,
  t,
  budgets,
  bottomOffset,
}: {
  client: TraceClient
  t: InspectorTranslator
  budgets: Budgets
  bottomOffset: number
}) {
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot
  )
  const [detent, setDetent] = useState<Detent>('closed')
  // The full inspector owns the screen while it is open; pause live polling meanwhile.
  // The closed bubble only needs fps and an issue count: poll half as often.
  const page = useLiveRecording(
    client,
    !snapshot.visible && snapshot.recording,
    detent === 'closed' ? 2000 : 1000
  )
  const { appReadyMs, screenMs, requestMs, stallMs } = budgets
  const visit = useMemo(() => {
    if (!page) return undefined
    const { issues } = summarizeTopics(page, snapshot.collectors ?? [], {
      appReadyMs,
      screenMs,
      requestMs,
      stallMs,
    })
    return currentVisit(buildTimeline(page, issues, 300))
  }, [page, snapshot.collectors, appReadyMs, screenMs, requestMs, stallMs])
  const vitals = useMemo(
    () => ({
      uiFps: page && latestMetric(page, 'ui.fps'),
      jsFps: page && latestMetric(page, 'js.frame_callback.rate'),
      cpu: page && latestMetric(page, 'process.cpu'),
      memory: page && latestMetric(page, 'process.memory'),
    }),
    [page]
  )
  if (snapshot.visible || snapshot.disposed) return null
  return detent === 'closed' ? (
    <Bubble
      fps={vitals.uiFps ?? vitals.jsFps}
      native={vitals.uiFps !== undefined}
      issues={visit?.issues ?? 0}
      onPress={() => setDetent('half')}
      onLongPress={client.open}
    />
  ) : (
    <Sheet
      bottomOffset={bottomOffset}
      detent={detent}
      setDetent={setDetent}
      openInspector={() => {
        setDetent('closed')
        client.open()
      }}
      nowMs={client.getRecording()?.getStats().nowMs}
      visit={visit}
      vitals={vitals}
      recording={snapshot.recording}
      flag={() => client.trace.mark('flag', { source: 'flag' })}
      share={client.canShare ? () => client.shareTrace('perfetto') : undefined}
      t={t}
    />
  )
}

function Bubble({
  fps,
  native,
  issues,
  onPress,
  onLongPress,
}: {
  fps?: number
  native: boolean
  issues: number
  onPress: () => void
  onLongPress: () => void
}) {
  const { width, height } = useWindowDimensions()
  const insets = useInsets()
  const base = useRef({ x: width - BUBBLE - 12, y: height * 0.55 })
  const position = useRef(new Animated.ValueXY(base.current)).current
  const handlers = useRef({ onPress, onLongPress })
  handlers.current = { onPress, onLongPress }
  const responder = useMemo(() => {
    let moved = false
    let longPressed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        moved = false
        longPressed = false
        timer = setTimeout(() => {
          longPressed = true
          handlers.current.onLongPress()
        }, 500)
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) > 6) {
          moved = true
          clearTimeout(timer)
        }
        position.setValue({
          x: base.current.x + g.dx,
          y: base.current.y + g.dy,
        })
      },
      onPanResponderRelease: (_, g) => {
        clearTimeout(timer)
        if (!moved) {
          if (!longPressed) handlers.current.onPress()
          return
        }
        // Snap to the nearest side edge, clamped inside the safe area.
        const x = base.current.x + g.dx
        const y = base.current.y + g.dy
        base.current = {
          x: x + BUBBLE / 2 < width / 2 ? 12 : width - BUBBLE - 12,
          y: Math.min(
            Math.max(y, insets.top + 8),
            height - BUBBLE - insets.bottom - 8
          ),
        }
        Animated.spring(position, {
          toValue: base.current,
          useNativeDriver: false,
        }).start()
      },
      onPanResponderTerminate: () => {
        clearTimeout(timer)
        position.setValue(base.current)
      },
    })
  }, [position, width, height, insets.top, insets.bottom])
  const alert = issues > 0
  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Performance overlay"
      accessibilityHint="Tap for live activity, long press for the full inspector"
      style={[
        styles.bubble,
        alert && styles.bubbleAlert,
        { transform: position.getTranslateTransform() },
      ]}
    >
      <Glass
        style={[StyleSheet.absoluteFill, styles.bubbleGlass]}
        fallbackColor={palette.bg}
        interactive
      />
      <Text style={[styles.bubbleValue, alert && { color: palette.error }]}>
        {fps === undefined ? '—' : Math.round(fps)}
      </Text>
      <Text style={styles.bubbleUnit}>
        {alert ? `${issues} ⚠` : native ? 'UI fps' : 'JS fps'}
      </Text>
    </Animated.View>
  )
}

function Sheet({
  detent,
  setDetent,
  openInspector,
  nowMs,
  visit,
  vitals,
  recording,
  flag,
  share,
  t,
  bottomOffset,
}: {
  bottomOffset: number
  detent: Exclude<Detent, 'closed'>
  setDetent: (detent: Detent) => void
  openInspector: () => void
  nowMs?: number
  visit?: VisitSummary
  vitals: Record<'uiFps' | 'jsFps' | 'cpu' | 'memory', number | undefined>
  recording: boolean
  flag: () => void
  share?: () => Promise<void>
  t: InspectorTranslator
}) {
  const { height } = useWindowDimensions()
  const insets = useInsets()
  const [flagged, setFlagged] = useState(false)
  const inset = bottomOffset > 0 ? 0 : insets.bottom
  const half = Math.round(height * 0.45) + inset
  const peek = PEEK + inset
  // The sheet is always `half` tall; detents translate it down so only `peek` shows.
  const offsetFor = (value: Detent) =>
    value === 'half' ? 0 : value === 'peek' ? half - peek : half + bottomOffset
  const translate = useRef(new Animated.Value(half + bottomOffset)).current
  const settle = (value: Detent) =>
    Animated.spring(translate, {
      toValue: offsetFor(value),
      useNativeDriver: true,
      bounciness: 0,
    }).start(() => value === 'closed' && setDetent('closed'))
  const current = useRef(detent)
  current.current = detent
  React.useEffect(() => {
    settle(detent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detent, half])
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) =>
          translate.setValue(Math.max(-80, offsetFor(current.current) + g.dy)),
        onPanResponderRelease: (_, g) => {
          const at = offsetFor(current.current) + g.dy
          if (at < -60) {
            settle(current.current)
            openInspector()
          } else if (at > half - peek / 2 || g.vy > 1.5) settle('closed')
          else {
            const next = at < (half - peek) / 2 ? 'half' : 'peek'
            if (next === current.current) settle(next)
            else setDetent(next)
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [half, peek]
  )
  const elapsed =
    nowMs !== undefined && visit?.sinceMs !== undefined
      ? (nowMs - visit.sinceMs) / 1000
      : undefined
  const latest = visit?.events[0]
  return (
    <Animated.View
      style={[
        styles.sheet,
        { height: half, paddingBottom: inset, bottom: bottomOffset },
        { transform: [{ translateY: translate }] },
      ]}
    >
      <Glass
        style={[StyleSheet.absoluteFill, styles.sheetGlass]}
        fallbackColor={palette.bg}
      />
      <View {...responder.panHandlers} style={styles.grabArea}>
        <View style={styles.grabber} />
        <View style={styles.row}>
          <Text style={styles.screen} numberOfLines={1}>
            {recording ? '●' : '○'} {visit?.screen ?? t('liveAllActivity')}
            {elapsed !== undefined && (
              <Text style={styles.muted}> · {elapsed.toFixed(0)} s</Text>
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDetent(detent === 'half' ? 'peek' : 'half')}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{detent === 'half' ? '▾' : '▴'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={openInspector}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{t('liveInspector')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={() => settle('closed')}
            style={styles.chip}
          >
            <Text style={styles.chipText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.stats}>
          <Stat label="UI fps" value={round(vitals.uiFps)} />
          <Stat label="JS fps" value={round(vitals.jsFps)} />
          <Stat label="CPU %" value={round(vitals.cpu)} />
          <Stat label="MB" value={round(vitals.memory)} />
        </View>
        <View style={styles.stats}>
          <Stat label={t('liveRequests')} value={visit?.requests ?? 0} />
          <Stat label={t('liveStalls')} value={visit?.stalls ?? 0} alert />
          <Stat label={t('liveErrors')} value={visit?.errors ?? 0} alert />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              flag()
              setFlagged(true)
              setTimeout(() => setFlagged(false), 1200)
            }}
            style={styles.action}
          >
            <Text style={styles.actionText}>
              ⚑ {t(flagged ? 'liveFlagged' : 'liveFlag')}
            </Text>
          </Pressable>
          {share && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void share()}
              style={styles.action}
            >
              <Text style={styles.actionText}>⇪ {t('liveShare')}</Text>
            </Pressable>
          )}
        </View>
      </View>
      {detent === 'peek' ? (
        latest && (
          <Text style={styles.muted} numberOfLines={1}>
            {topicGlyph[latest.topic].icon} {latest.event.name}
          </Text>
        )
      ) : (
        <ScrollView style={styles.list}>
          {!visit?.events.length && (
            <Text style={[styles.muted, styles.empty]}>{t('liveEmpty')}</Text>
          )}
          {visit?.events.slice(0, 100).map((item) => (
            <View key={item.key} style={styles.event}>
              <Text
                style={[styles.glyph, { color: topicGlyph[item.topic].color }]}
              >
                {topicGlyph[item.topic].icon}
              </Text>
              <Text
                style={[styles.eventName, item.issue && styles.alertText]}
                numberOfLines={1}
              >
                {item.event.name}
              </Text>
              <Text style={[styles.value, item.issue && styles.alertText]}>
                {'durationMs' in item.event
                  ? `${item.event.durationMs.toFixed(0)} ms`
                  : 'value' in item.event
                    ? `${item.event.value.toFixed(0)} ${item.event.unit}`
                    : ''}
              </Text>
              <Text style={styles.time}>
                +
                {(
                  (item.event.timestampMs - (visit.sinceMs ?? 0)) /
                  1000
                ).toFixed(1)}
                s
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  )
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string
  value: number | string
  alert?: boolean
}) {
  const hot = alert && Number(value) > 0
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, hot && styles.alertText]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bubbleGlass: { borderRadius: BUBBLE / 2 },
  sheetGlass: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bubbleAlert: { borderColor: palette.error, borderWidth: 2 },
  bubbleValue: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  bubbleUnit: { color: palette.muted, fontSize: 10, marginTop: -2 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  grabArea: { paddingBottom: 8 },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.line,
    marginTop: 6,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  screen: { flex: 1, color: palette.text, fontSize: 15, fontWeight: '600' },
  muted: { color: palette.muted, fontSize: 13, fontWeight: '400' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: palette.panel,
  },
  chipText: { color: palette.accent, fontSize: 13, fontWeight: '500' },
  stats: {
    flexDirection: 'row',
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    paddingTop: 8,
  },
  stat: { flex: 1, alignItems: 'center' },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: palette.panel,
    marginLeft: 6,
    alignSelf: 'center',
  },
  actionText: { color: palette.accent, fontSize: 13, fontWeight: '500' },
  statValue: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: { color: palette.muted, fontSize: 11 },
  list: { flex: 1 },
  empty: { paddingVertical: 12 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  glyph: { width: 18, textAlign: 'center', color: palette.muted },
  eventName: { flex: 1, color: palette.text, fontSize: 13 },
  value: {
    color: palette.text,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  time: {
    width: 52,
    textAlign: 'right',
    color: palette.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  alertText: { color: palette.error },
})
