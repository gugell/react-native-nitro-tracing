import React, { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useSelector } from '@legendapp/state/react'
import type { Viewer } from './useTraceViewer'
import type { InspectorTranslator } from './labels'
import { Button, ui } from './InspectorControls'
import { InspectorSheet } from './InspectorSheet'
/** Only the status area subscribes to the one-second telemetry clock. */
export function InspectorHeader({
  v: viewer,
  t,
}: {
  v: Viewer
  t: InspectorTranslator
}) {
  const live = useSelector(viewer.telemetry)
  const v = { ...viewer, ...live }
  const client = v.client
  const [actions, setActions] = useState(false)
  const newRecording = () =>
    Alert.alert(t('replaceTitle'), t('replaceDescription'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('start'), style: 'destructive', onPress: v.start },
    ])
  return (
    <View style={ui.header}>
      <View style={ui.spread}>
        {v.detail && <Button label={t('back')} onPress={v.back} />}
        <Text style={ui.title}>
          {v.detail
            ? t(
                v.detail.kind === 'trace'
                  ? 'traces'
                  : v.detail.kind === 'span'
                    ? 'spans'
                    : v.detail.kind === 'metric'
                      ? 'metrics'
                      : 'marks'
              )
            : t('title')}
        </Text>
        <Button label={t('close')} onPress={client.close} />
      </View>
      <View style={ui.spread}>
        <Text style={ui.muted}>
          {v.recording ? '●' : '○'} {t(v.recording ? 'recording' : 'stopped')} ·{' '}
          {((v.stats?.nowMs ?? 0) / 1000).toFixed(0)}s ·{' '}
          {v.stats?.eventCount ?? 0} {t('events')}
        </Text>
        <Button
          label={t('actions')}
          onPress={() => setActions(!actions)}
          selected={actions}
        />
      </View>
      <InspectorSheet
        visible={actions}
        title={t('actions')}
        close={() => setActions(false)}
        closeLabel={t('close')}
      >
        <View style={ui.content}>
          <Button
            label={t('stop')}
            onPress={v.stop}
            disabled={v.busy || !v.recording}
          />
          <Button
            label={t('exportAll')}
            onPress={v.export}
            disabled={v.busy || !client.canShare || !v.stats}
          />
          <Button label={t('start')} onPress={newRecording} disabled={v.busy} />
          <Button
            label={t('tools')}
            onPress={() => {
              v.setTab('playground')
              setActions(false)
            }}
          />
        </View>
      </InspectorSheet>
      {(v.stats?.droppedEvents ?? 0) > 0 && (
        <Text style={ui.error}>
          {t('lostHistory', { count: v.stats!.droppedEvents })}
        </Text>
      )}
      {v.error && (
        <Text selectable style={ui.error}>
          {v.error}
        </Text>
      )}
      {!v.detail && (
        <>
          <View style={ui.row}>
            <Button
              label={t(v.paused ? 'resumeUpdates' : 'pauseUpdates')}
              selected={v.paused}
              onPress={v.togglePause}
            />
            {v.pending && (
              <Button
                label={t('newEvents', {
                  count: Math.max(
                    0,
                    v.pending.nextSequence - v.page.nextSequence
                  ),
                })}
                onPress={v.apply}
                disabled={v.paused}
              />
            )}
          </View>
        </>
      )}
    </View>
  )
}
