import React, { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import type { Viewer } from './useTraceViewer'
import type { InspectorTranslator } from './labels'
import { sourceOf, defaultQuery, type Sort, type Query } from './explorerModel'
import { Button, Field, ui } from './InspectorControls'
import { InspectorSheet } from './InspectorSheet'
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
export function ExplorerFilters({
  v: viewer,
  t,
  close,
}: {
  v: Viewer
  t: InspectorTranslator
  close: () => void
}) {
  const [draft, setDraft] = useState(viewer.query)
  const v = {
    ...viewer,
    query: draft,
    updateQuery: (patch: Partial<Query>) =>
      setDraft((previous) => ({ ...previous, ...patch })),
  }
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
  return (
    <InspectorSheet
      visible
      title={t('filters')}
      close={close}
      closeLabel={t('cancel')}
    >
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
        <Button label={t('reset')} onPress={() => setDraft(defaultQuery())} />
        <Button
          label={t('applyFilters')}
          disabled={invalid}
          onPress={() => {
            viewer.updateQuery(draft)
            close()
          }}
        />
      </ScrollView>{' '}
    </InspectorSheet>
  )
}
