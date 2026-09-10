import { describeRecurrence } from '../../lib/recurrenceLabels'
import type { Occurrence } from '../../lib/occurrences'

type OccurrenceRowProps = {
  occurrence: Occurrence
  onToggle: (occurrence: Occurrence) => void
  categoryName?: string
}

export default function OccurrenceRow({ occurrence, onToggle, categoryName }: OccurrenceRowProps) {
  const { item, ownCompletion, partnerCompletion } = occurrence

  return (
    <li>
      <label>
        <input type="checkbox" checked={ownCompletion} onChange={() => onToggle(occurrence)} />
        {categoryName ? `${categoryName} — ` : ''}
        {item.titulo} — {item.horario} — {describeRecurrence(item)}
      </label>
      {item.is_shared && <span> Parceiro: {partnerCompletion ? '✓' : '–'}</span>}
    </li>
  )
}
