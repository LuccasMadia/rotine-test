import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'

export default function PageHeader({
  title,
  eyebrow,
  backTo,
  action,
}: {
  title: string
  eyebrow?: string
  backTo?: string
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      {backTo && (
        <Link to={backTo} className="icon-btn" aria-label="Voltar">
          <Icon name="chevron-left" size={24} />
        </Link>
      )}
      <div className="page-header__text">
        {eyebrow && <p className="muted">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </header>
  )
}
