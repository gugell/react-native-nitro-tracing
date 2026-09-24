import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Viewer } from './useTraceViewer'
import type { InspectorTranslator } from './labels'
import { sourceOf, defaultQuery, type Query } from './explorerModel'
import { apple, palette, Row, Section } from './InspectorControls'
import { InspectorSheet } from './InspectorSheet'
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]

/** Draft filters: Apply commits them, Cancel discards them. Sorting lives in its own menu. */
export function ExplorerFilters({
  v,
  t,
  close,
}: {
  v: Viewer
  t: InspectorTranslator
  close: () => void
}) {
  const [draft, setDraft] = useState(v.query)
  const update = (patch: Partial<Query>) =>
    setDraft((previous) => ({ ...previous, ...patch }))
  const sources = [
    ...new Set([...v.page.spans, ...v.page.marks].map(sourceOf)),
  ].sort()
  const outcomes =
    v.mode === 'traces'
      ? ['error', 'success']
      : ['success', 'error', 'cancelled', 'interrupted']
  const invalid =
    [draft.from, draft.to, draft.minDuration].some(
      (value) =>
        value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)
    ) ||
    Boolean(draft.from && draft.to && Number(draft.from) > Number(draft.to))
  const field = (
    key: 'minDuration' | 'from' | 'to' | 'correlation',
    numeric = true
  ) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{t(key)}</Text>
      <TextInput
        accessibilityLabel={t(key)}
        value={draft[key]}
        onChangeText={(value) => update({ [key]: value })}
        placeholder="—"
        placeholderTextColor={apple.secondary}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.fieldInput}
      />
    </View>
  )
  return (
    <InspectorSheet
      title={t('filters')}
      close={close}
      closeLabel={t('cancel')}
      primary={{
        label: t('applyFilters'),
        disabled: invalid,
        onPress: () => {
          v.updateQuery(draft)
          close()
        },
      }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {v.mode !== 'marks' && (
          <Section header={t('outcome')}>
            {outcomes.map((outcome, index) => (
              <Row
                key={outcome}
                title={t(
                  outcome === 'success' && v.mode === 'traces'
                    ? 'noErrors'
                    : (outcome as 'success')
                )}
                checked={draft.outcomes.includes(outcome)}
                onPress={() =>
                  update({ outcomes: toggle(draft.outcomes, outcome) })
                }
                last={index === outcomes.length - 1}
              />
            ))}
          </Section>
        )}
        {sources.length > 0 && (
          <Section header={t('source')}>
            {sources.map((source, index) => (
              <Row
                key={source}
                title={source}
                checked={draft.sources.includes(source)}
                onPress={() =>
                  update({ sources: toggle(draft.sources, source) })
                }
                last={index === sources.length - 1}
              />
            ))}
          </Section>
        )}
        <Section
          header={t('range')}
          footer={invalid ? t('invalidRange') : undefined}
        >
          {v.mode !== 'marks' && field('minDuration')}
          {field('from')}
          {field('to')}
          {field('correlation', false)}
        </Section>
        <Section>
          <Row
            title={t('reset')}
            tint={palette.error}
            onPress={() => setDraft(defaultQuery())}
            last
          />
        </Section>
      </ScrollView>
    </InspectorSheet>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: apple.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: apple.separator,
    gap: 12,
  },
  fieldLabel: { flex: 1, fontSize: 17, color: palette.text },
  fieldInput: {
    minWidth: 110,
    fontSize: 17,
    color: palette.text,
    textAlign: 'right',
    paddingVertical: 8,
  },
})
