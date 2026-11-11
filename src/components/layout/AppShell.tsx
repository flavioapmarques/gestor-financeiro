import { useState } from 'react'
import { Outlet, useLocation, NavLink } from 'react-router-dom'
import {
  Home,
  Landmark,
  CreditCard,
  ArrowLeftRight,
  User,
  BarChart2,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { FormLancamentoModal } from '../lancamentos/FormLancamentoModal'
import { ModalLancamentoVoz } from '../voz/ModalLancamentoVoz'
import { NovoLancamentoPopover, type TipoLancamentoOpcao } from './NovoLancamentoPopover'

const NAV_ITEMS = [
  { to: '/',            icon: Home,           label: 'Início' },
  { to: '/bancos',      icon: Landmark,       label: 'Bancos' },
  { to: '/lancamentos', icon: ArrowLeftRight, label: 'Lançamentos' },
  { to: '/cartoes',     icon: CreditCard,     label: 'Cartões' },
  { to: '/relatorios',  icon: BarChart2,      label: 'Relatórios' },
  { to: '/perfil',      icon: User,           label: 'Perfil' },
]

const HIDE_NAV = [
  '/cartoes/novo', '/despesa', '/parcelamento', '/fatura',
  '/busca', '/configuracoes', '/premium', '/insights',
  '/ajuda', '/notificacoes', '/calendario', '/categorias',
  '/receitas', '/estados', '/metas/nova', '/orcamentos/novo', '/bancos/novo', '/importar-ofx',
]

export function AppShell() {
  const { pathname } = useLocation()
  const [fabOpen, setFabOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<TipoLancamentoOpcao | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalVozAberto, setModalVozAberto] = useState(false)
  const [sidebarColapsada, setSidebarColapsada] = useState(() => localStorage.getItem('sidebar-colapsada') === '1')

  function alternarSidebar() {
    setSidebarColapsada(v => {
      localStorage.setItem('sidebar-colapsada', v ? '0' : '1')
      return !v
    })
  }

  const hideNav =
    HIDE_NAV.some(p => pathname.startsWith(p)) ||
    pathname.match(/\/cartoes\/[^/]+/) !== null ||
    pathname.match(/\/bancos\/[^/]+/) !== null

  function handleSelect(tipo: TipoLancamentoOpcao) {
    setFabOpen(false)
    if (tipo === 'voz') {
      setModalVozAberto(true)
    } else if (tipo) {
      setModalTipo(tipo)
      setModalAberto(true)
    }
  }

  return (
    <div className={`flex min-h-screen bg-[var(--bg)] ${sidebarColapsada ? 'sidebar-collapsed' : ''}`}>

      {/* ── SIDEBAR desktop ───────────────────────────────── */}
      <aside className="app-sidebar hidden lg:flex">
        <div className="px-5 pt-6 pb-4 flex items-center gap-3 border-b border-[var(--border)]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--primary)' }}>
            <Wallet size={18} />
          </div>
          <span className="font-bold text-base tracking-tight gradient-text">Gestor</span>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5" aria-label="Menu principal">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                }`
              }>
              <Icon size={18} strokeWidth={2} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <button
        type="button"
        onClick={alternarSidebar}
        aria-label={sidebarColapsada ? 'Mostrar menu' : 'Ocultar menu'}
        className={`hidden lg:flex fixed top-6 z-[60] w-6 h-10 items-center justify-center rounded-r-lg
                    bg-[var(--bg-elevated)] border border-l-0 border-[var(--border)] text-[var(--text-muted)]
                    hover:text-[var(--primary)] transition-all duration-300 ${sidebarColapsada ? 'left-0' : 'left-[var(--sidebar-w)]'}`}
      >
        {sidebarColapsada ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* ── CONTEÚDO ──────────────────────────────────────── */}
      <main className="app-main flex-1 min-w-0">
        <Outlet />
      </main>

      {/* ── BOTÃO FLUTUANTE (+) DESKTOP ───────────────────── */}
      <button
        type="button"
        onClick={() => setFabOpen(v => !v)}
        aria-label={fabOpen ? 'Fechar opções de lançamento' : 'Novo lançamento'}
        title="Novo lançamento (+)"
        className="hidden lg:flex fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full text-white items-center justify-center shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-400/30"
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, #7928CA 100%)',
          boxShadow: '0 8px 24px rgba(157, 78, 221, 0.45)',
        }}
      >
        <Plus
          size={26}
          strokeWidth={2.4}
          className={`transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
        />
      </button>

      {/* ── BOTTOM NAV mobile ─────────────────────────────── */}
      {!hideNav && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
          style={{
            background: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          aria-label="Menu principal">
          <div className="flex items-end justify-around px-2 pt-2 pb-3 relative max-w-lg mx-auto">
            {NAV_ITEMS.slice(0, 2).map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 min-w-[52px] py-1 transition-all ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-subtle)]'}`
                }>
                {({ isActive }) => (
                  <>
                    <span className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-[var(--primary-soft)]' : ''}`}>
                      <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
                    </span>
                    <span className="text-[9px] font-semibold">{label}</span>
                  </>
                )}
              </NavLink>
            ))}

            {/* FAB central circular (+) */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setFabOpen(v => !v)}
                aria-label={fabOpen ? 'Fechar opções de lançamento' : 'Novo lançamento'}
                className="w-14 h-14 rounded-full text-white flex items-center justify-center transition-all duration-200 active:scale-95 mb-1 shadow-lg focus:outline-none"
                style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, #7928CA 100%)',
                  boxShadow: '0 8px 24px rgba(157, 78, 221, 0.45)',
                }}
              >
                <Plus
                  size={26}
                  strokeWidth={2.4}
                  className={`transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
                />
              </button>
              <span className="text-[9px] font-semibold text-[var(--text-subtle)]">Novo</span>
            </div>

            {NAV_ITEMS.slice(2, 4).map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 min-w-[52px] py-1 transition-all ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-subtle)]'}`
                }>
                {({ isActive }) => (
                  <>
                    <span className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-[var(--primary-soft)]' : ''}`}>
                      <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
                    </span>
                    <span className="text-[9px] font-semibold">{label}</span>
                  </>
                )}
              </NavLink>
            ))}

            <NavLink to="/perfil"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 min-w-[52px] py-1 transition-all ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-subtle)]'}`
              }>
              {({ isActive }) => (
                <>
                  <span className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-[var(--primary-soft)]' : ''}`}>
                    <User size={20} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
                  </span>
                  <span className="text-[9px] font-semibold">Perfil</span>
                </>
              )}
            </NavLink>
          </div>
        </nav>
      )}

      {/* ── POPOVER ÚNICO E RESPONSIVO DE LANÇAMENTO ──────── */}
      <NovoLancamentoPopover
        open={fabOpen}
        onClose={() => setFabOpen(false)}
        onSelect={handleSelect}
      />

      <FormLancamentoModal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setModalTipo(null) }}
        defaultTipo={modalTipo === 'cartao' ? 'despesa' : modalTipo === 'voz' ? null : modalTipo}
        abrirNoCartao={modalTipo === 'cartao'}
      />

      <ModalLancamentoVoz
        open={modalVozAberto}
        onClose={() => setModalVozAberto(false)}
      />
    </div>
  )
}
