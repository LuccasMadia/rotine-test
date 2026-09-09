import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getPartnerId } from '../couple/coupleApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { createItem, getItem, updateItem, type Priority } from './itemsApi'
import type { RecurrenceEnd, RecurrenceRule } from '../../lib/recurrence'

type RecurrenceType = RecurrenceRule['type']
type EndType = RecurrenceEnd['type']

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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

  return (
    <div>
      <h1>{isEditing ? 'Editar item' : 'Novo item'}</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.nome}
            </option>
          ))}
        </select>
        <textarea placeholder="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
        <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Priority)}>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
        <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} required />

        <fieldset>
          <legend>Recorrência</legend>
          <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}>
            <option value="once">Única</option>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>

          {recurrenceType === 'weekly' && (
            <div>
              <label>
                A cada
                <input
                  type="number"
                  min={1}
                  value={weeklyInterval}
                  onChange={(e) => setWeeklyInterval(Number(e.target.value))}
                />
                semana(s)
              </label>
              <div>
                {WEEKDAY_LABELS.map((label, day) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={weeklyDays.includes(day)}
                      onChange={() => toggleWeeklyDay(day)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {recurrenceType === 'monthly' && (
            <label>
              Dia do mês
              <input
                type="number"
                min={1}
                max={31}
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(Number(e.target.value))}
              />
            </label>
          )}

          <select value={endType} onChange={(e) => setEndType(e.target.value as EndType)}>
            <option value="never">Nunca termina</option>
            <option value="date">Até uma data</option>
            <option value="count">Número de repetições</option>
          </select>

          {endType === 'date' && (
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          )}
          {endType === 'count' && (
            <input type="number" min={1} value={endCount} onChange={(e) => setEndCount(Number(e.target.value))} />
          )}
        </fieldset>

        {hasPartner && (
          <label>
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
            Compartilhar com o parceiro
          </label>
        )}

        <button type="submit">{isEditing ? 'Salvar' : 'Criar'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
