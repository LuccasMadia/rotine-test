import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getPartnerId } from '../couple/coupleApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { createItem, deleteItem, getItem, updateItem, type Priority } from './itemsApi'
import Icon from '../../ui/Icon'
import PageHeader from '../../ui/PageHeader'
import type { RecurrenceEnd, RecurrenceRule } from '../../lib/recurrence'

type RecurrenceType = RecurrenceRule['type']
type EndType = RecurrenceEnd['type']

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const RECURRENCE_OPTIONS: [RecurrenceType, string][] = [
  ['once', 'Única'],
  ['daily', 'Diária'],
  ['weekly', 'Semanal'],
  ['monthly', 'Mensal'],
]
const PRIORITY_OPTIONS: [Priority, string][] = [
  ['alta', 'Alta'],
  ['media', 'Média'],
  ['baixa', 'Baixa'],
]

export default function ItemFormPage() {
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [categories, setCategories] = useState<Category[]>([])
  const [hasPartner, setHasPartner] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [notas, setNotas] = useState('')
  const [prioridade, setPrioridade] = useState<Priority>('media')
  const [dataInicio, setDataInicio] = useState('')
  const [horario, setHorario] = useState('')
  const [isShared, setIsShared] = useState(false)

  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('once')
  const [weeklyInterval, setWeeklyInterval] = useState(1)
  const [weeklyDays, setWeeklyDays] = useState<number[]>([])
  const [monthlyDay, setMonthlyDay] = useState(1)

  const [endType, setEndType] = useState<EndType>('never')
  const [endDate, setEndDate] = useState('')
  const [endCount, setEndCount] = useState(1)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    listCategories()
      .then((result) => {
        setCategories(result)
        if (!isEditing && result.length > 0) setCategoryId(result[0].id)
      })
      .catch((e) => setError((e as Error).message))
    getPartnerId(user.id)
      .then((partnerId) => setHasPartner(partnerId !== null))
      .catch((e) => setError((e as Error).message))
  }, [user, isEditing])

  useEffect(() => {
    if (!id) return
    getItem(id)
      .then((item) => {
        setTitulo(item.titulo)
        setCategoryId(item.category_id)
        setNotas(item.notas ?? '')
        setPrioridade(item.prioridade)
        setDataInicio(item.data_inicio)
        setHorario(item.horario)
        setIsShared(item.is_shared)

        setRecurrenceType(item.recurrence_rule.type)
        if (item.recurrence_rule.type === 'weekly') {
          setWeeklyInterval(item.recurrence_rule.interval)
          setWeeklyDays(item.recurrence_rule.daysOfWeek)
        }
        if (item.recurrence_rule.type === 'monthly') {
          setMonthlyDay(item.recurrence_rule.dayOfMonth)
        }

        setEndType(item.recurrence_end.type)
        if (item.recurrence_end.type === 'date') setEndDate(item.recurrence_end.value)
        if (item.recurrence_end.type === 'count') setEndCount(item.recurrence_end.value)
      })
      .catch((e) => setError((e as Error).message))
  }, [id])

  function toggleWeeklyDay(day: number) {
    setWeeklyDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()))
  }

  function buildRecurrenceRule(): RecurrenceRule {
    switch (recurrenceType) {
      case 'once':
        return { type: 'once' }
      case 'daily':
        return { type: 'daily' }
      case 'weekly':
        return { type: 'weekly', interval: weeklyInterval, daysOfWeek: weeklyDays }
      case 'monthly':
        return { type: 'monthly', dayOfMonth: monthlyDay }
      default:
        throw new Error(`Tipo de recorrência desconhecido: ${recurrenceType}`)
    }
  }

  function buildRecurrenceEnd(): RecurrenceEnd {
    switch (endType) {
      case 'never':
        return { type: 'never' }
      case 'date':
        return { type: 'date', value: endDate }
      case 'count':
        return { type: 'count', value: endCount }
      default:
        throw new Error(`Tipo de término desconhecido: ${endType}`)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    if (recurrenceType === 'weekly' && weeklyDays.length === 0) {
      setError('Escolha ao menos um dia da semana.')
      return
    }
    if (endType === 'date' && !endDate) {
      setError('Escolha a data final da recorrência.')
      return
    }

    const input = {
      category_id: categoryId,
      titulo,
      notas: notas || null,
      prioridade,
      data_inicio: dataInicio,
      horario,
      is_shared: isShared,
      recurrence_rule: buildRecurrenceRule(),
      recurrence_end: buildRecurrenceEnd(),
    }

    try {
      if (id) {
        await updateItem(id, input)
      } else {
        await createItem(user.id, input)
      }
      navigate('/items')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!window.confirm('Excluir este item de rotina?')) return
    setError(null)
    try {
      await deleteItem(id)
      navigate('/items')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="page">
      <PageHeader title={isEditing ? 'Editar item' : 'Novo item'} backTo="/items" />
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Título</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label className="field">
            <span>Começa em</span>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
          </label>
          <label className="field">
            <span>Horário</span>
            <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} required />
          </label>
        </div>

        <fieldset className="segmented">
          <legend className="field-label">Repete</legend>
          {RECURRENCE_OPTIONS.map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="recurrence"
                value={value}
                checked={recurrenceType === value}
                onChange={() => setRecurrenceType(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        {recurrenceType === 'weekly' && (
          <>
            <fieldset className="day-chips">
              <legend className="sr-only">Dias da semana</legend>
              {WEEKDAY_LABELS.map((label, day) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    aria-label={WEEKDAY_NAMES[day]}
                    checked={weeklyDays.includes(day)}
                    onChange={() => toggleWeeklyDay(day)}
                  />
                  <span aria-hidden="true">{label}</span>
                </label>
              ))}
            </fieldset>
            <label className="field-inline">
              A cada
              <input
                type="number"
                min={1}
                aria-label="Intervalo em semanas"
                value={weeklyInterval}
                onChange={(e) => setWeeklyInterval(Number(e.target.value))}
              />
              {weeklyInterval === 1 ? 'semana' : 'semanas'}
            </label>
          </>
        )}

        {recurrenceType === 'monthly' && (
          <label className="field">
            <span>Dia do mês</span>
            <input
              type="number"
              min={1}
              max={31}
              value={monthlyDay}
              onChange={(e) => setMonthlyDay(Number(e.target.value))}
            />
          </label>
        )}

        <label className="field">
          <span>Termina</span>
          <select value={endType} onChange={(e) => setEndType(e.target.value as EndType)}>
            <option value="never">Nunca termina</option>
            <option value="date">Até uma data</option>
            <option value="count">Número de repetições</option>
          </select>
        </label>
        {endType === 'date' && (
          <label className="field">
            <span>Data final</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        )}
        {endType === 'count' && (
          <label className="field">
            <span>Repetições</span>
            <input type="number" min={1} value={endCount} onChange={(e) => setEndCount(Number(e.target.value))} />
          </label>
        )}

        <fieldset className="segmented">
          <legend className="field-label">Prioridade</legend>
          {PRIORITY_OPTIONS.map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="prioridade"
                value={value}
                checked={prioridade === value}
                onChange={() => setPrioridade(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          <span>Notas (opcional)</span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>

        {hasPartner && (
          <label className="card share-card">
            <Icon name="couple" size={24} />
            <span className="share-card__text">
              <strong>Compartilhar com seu par</strong>
              <span className="muted">Aparece para os dois e cada um marca o seu.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
            />
          </label>
        )}

        <button type="submit" className="btn btn--primary">
          {isEditing ? 'Salvar' : 'Criar item'}
        </button>
        {isEditing && (
          <button type="button" className="btn btn--danger" onClick={handleDelete}>
            Excluir item
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  )
}
