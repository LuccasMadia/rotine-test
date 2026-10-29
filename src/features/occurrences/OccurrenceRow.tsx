import { describeRecurrence } from '../../lib/recurrenceLabels'
import type { Occurrence } from '../../lib/occurrences'
import Icon from '../../ui/Icon'

type OccurrenceRowProps = {
  occurrence: Occurrence
  onToggle: (occurrence: Occurrence) => void
  categoryName?: string
  categoryColor?: string
}

export default function OccurrenceRow({ occurrence, onToggle, categoryName, categoryColor }: OccurrenceRowProps) {
  const { item, ownCompletion, partnerCompletion } = occurrence

  return (
    <li className="occurrence">
      <label className="occurrence__label">
        <input
          type="checkbox"
          className="check"
          checked={ownCompletion}
          onChange={() => onToggle(occurrence)}
        />
        <span className="occurrence__text">
          <span className="occurrence__title">{item.titulo}</span>
          <span className="occurrence__meta">
            {categoryColor && <span className="dot" style={{ background: categoryColor }} />}
            <span>{`${item.horario.slice(0, 5)} · ${categoryName ?? describeRecurrence(item)}`}</span>
          </span>
        </span>
        {item.is_shared && (
          <span className={partnerCompletion ? 'chip chip--done' : 'chip chip--neutral'}>
            <Icon name="couple" size={14} />
            <span className="sr-only">Par: </span>
            {partnerCompletion ? 'feito' : 'falta'}
          </span>
        )}
      </label>
    </li>
  )
}
