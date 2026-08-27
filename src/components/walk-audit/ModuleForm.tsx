'use client'

import type { AuditModule, Question } from './moduleModel'
import { RadioGroup, Scale5, NumberField, FreeTextField } from '@/components/volunteer-route/inputs'

export type Answers = Record<string, unknown>

function QuestionField({ q, value, onChange }: {
  q: Question
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (q.kind) {
    case 'radio':
      return (
        <RadioGroup
          label={q.label}
          value={(value as string) ?? null}
          options={q.options}
          onChange={onChange}
        />
      )
    case 'scale5':
      return (
        <Scale5
          label={q.label}
          low={q.low}
          high={q.high}
          value={(value as number) ?? null}
          onChange={onChange}
        />
      )
    case 'number':
      return (
        <NumberField
          label={q.label}
          value={(value as string) ?? ''}
          onChange={onChange}
          unit={q.unit}
        />
      )
    case 'textarea':
      return (
        <FreeTextField
          label={q.label}
          value={(value as string) ?? ''}
          onChange={onChange}
          placeholder={q.placeholder}
        />
      )
    case 'checkbox': {
      const selected = (value as string[]) ?? []
      return (
        <div className="mb-4">
          <p className="text-sm font-medium text-[#191A2E] mb-2">{q.label}</p>
          {q.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, opt] : selected.filter((x) => x !== opt),
                  )
                }
                className="rounded border-gray-300 text-[#2966E5]"
              />
              <span className="text-sm text-[#374151]">{opt}</span>
            </label>
          ))}
        </div>
      )
    }
  }
}

// Renders every block of a walk-audit module from its data definition.
export default function ModuleForm({ module, answers, onChange }: {
  module: AuditModule
  answers: Answers
  onChange: (key: string, value: unknown) => void
}) {
  return (
    <>
      {module.blocks.map((block, i) => (
        <div key={i}>
          {block.title && (
            <div className="bg-[#191A2E] rounded-lg px-4 py-2.5 mb-4 mt-6">
              <h3 className="text-sm font-bold text-white">{block.title}</h3>
            </div>
          )}
          {block.questions.map((q) => (
            <QuestionField
              key={q.key}
              q={q}
              value={answers[q.key]}
              onChange={(v) => onChange(q.key, v)}
            />
          ))}
        </div>
      ))}
    </>
  )
}
