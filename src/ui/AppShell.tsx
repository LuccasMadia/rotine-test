import { NavLink, Outlet } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Hoje', icon: 'today', end: true },
  { to: '/agenda', label: 'Agenda', icon: 'calendar' },
  { to: '/estatisticas', label: 'Estatísticas', icon: 'chart' },
  { to: '/items', label: 'Itens', icon: 'list' },
]

export default function AppShell() {
  return (
    <>
      <div className="page page--with-nav">
        <Outlet />
      </div>
      <nav className="bottom-nav" aria-label="Principal">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="bottom-nav__link">
            <span className="bottom-nav__pill">
              <Icon name={t.icon} size={22} />
            </span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
