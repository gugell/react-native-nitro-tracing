import React from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useStore } from './store'
import { useMenu } from './native'
import type { Viewer } from './useTraceViewer'
import type { InspectorTranslator } from './labels'
import { apple, Banner, NavBar, palette, TextButton } from './InspectorControls'

const titleKey = {
  trace: 'traces',
  span: 'spans',
  metric: 'metrics',
  mark: 'marks',
} as const
const tabKey = {
  overview: 'overview',
  timeline: 'timeline',
  explore: 'explore',
  metrics: 'metrics',
  tools: 'tools',
} as const

/** Navigation bar, status line and live-update banner. Only this subscribes to the 1 s telemetry tick. */
export function InspectorHeader({
  v: viewer,
  t,
}: {
  v: Viewer
  t: InspectorTranslator
}) {
  const live = useStore(viewer.telemetry, (s) => s)
  const v = { ...viewer, ...live }
  const client = v.client
  const menu = useMenu()
  const canShare = client.canShare && !!v.stats && !v.busy
  const startNew = () =>
    Alert.alert(t('replaceTitle'), t('replaceDescription'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('start'), style: 'destructive', onPress: v.start },
    ])
  const seconds = Math.round((v.stats?.nowMs ?? 0) / 1000)
  const newEvents = v.pending
    ? Math.max(0, v.pending.nextSequence - v.page.nextSequence)
    : 0
  return (
    <View style={styles.root}>
      <NavBar
        left={
          v.detail ? (
            <TextButton label={`‹ ${t('back')}`} onPress={v.back} />
          ) : (
            <TextButton label={t('done')} onPress={client.close} bold />
          )
        }
        title={t(v.detail ? titleKey[v.detail.kind] : tabKey[v.tab])}
        right={
          <>
            <TextButton
              icon="⇪"
              accessibilityLabel={t('share')}
              onPress={() =>
                menu.open({
                  title: t('shareTitle'),
                  cancelLabel: t('cancel'),
                  options: [
                    {
                      label: t('sharePerfetto'),
                      onPress: v.sharePerfetto,
                      disabled: !canShare,
                    },
                    {
                      label: t('exportAll'),
                      onPress: v.export,
                      disabled: !canShare,
                    },
                    ...(v.profilePath && client.canShareProfile
                      ? [{ label: t('shareProfile'), onPress: v.shareProfile }]
                      : []),
                  ],
                })
              }
              disabled={!canShare && !v.profilePath}
            />
            <TextButton
              icon="⋯"
              accessibilityLabel={t('more')}
              onPress={() =>
                menu.open({
                  cancelLabel: t('cancel'),
                  options: [
                    v.recording
                      ? { label: t('stop'), onPress: v.stop, destructive: true }
                      : { label: t('start'), onPress: v.start },
                    ...(v.recording
                      ? [{ label: t('startNew'), onPress: startNew }]
                      : []),
                    {
                      label: t(v.paused ? 'resumeUpdates' : 'pauseUpdates'),
                      onPress: v.togglePause,
                    },
                    { label: t('tools'), onPress: () => v.setTab('tools') },
                  ],
                })
              }
            />
          </>
        }
      />
      <Text style={styles.status} numberOfLines={1}>
        <Text style={{ color: v.recording ? palette.error : apple.secondary }}>
          {v.recording ? '●' : '○'}
        </Text>{' '}
        {t(v.recording ? 'recording' : 'stopped')} · {Math.floor(seconds / 60)}:
        {String(seconds % 60).padStart(2, '0')} · {v.stats?.eventCount ?? 0}{' '}
        {t('events')}
        {v.screen ? ` · ${v.screen}` : ''}
        {v.paused ? ` · ${t('frozen')}` : ''}
      </Text>
      {(v.stats?.droppedEvents ?? 0) > 0 && (
        <Text style={styles.warning}>
          {t('lostHistory', { count: v.stats!.droppedEvents })}
        </Text>
      )}
      {v.error && (
        <Text selectable style={styles.warning} numberOfLines={3}>
          {v.error}
        </Text>
      )}
      {!v.detail && newEvents > 0 && !v.paused && (
        <Banner
          label={t('newEvents', { count: newEvents })}
          onPress={v.apply}
        />
      )}
      {menu.element}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: apple.grouped,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: apple.separator,
    paddingBottom: 8,
  },
  status: {
    fontSize: 13,
    color: apple.secondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontVariant: ['tabular-nums'],
  },
  warning: {
    fontSize: 13,
    color: palette.error,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
})
