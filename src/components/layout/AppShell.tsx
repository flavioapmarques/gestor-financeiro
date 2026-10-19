import { useState } from 'react'
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom'
import {
  Home, Landmark, CreditCard, ArrowLeftRight, User,
  BarChart2, Wallet, TrendingUp, TrendingDown, ArrowRightLeft, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { FormLancamentoModal } from '../lancamentos/FormLancamentoModal'

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

type TipoModal = 'receita' | 'despesa' | 'cartao' | 'transferencia' | null

function FABMenu({ onSelect }: { onSelect: (tipo: TipoModal) => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => onSelect(null)} aria-hidden />
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center animate-slide-up
                      lg:bottom-auto lg:top-auto lg:left-auto lg:translate-x-0 lg:static lg:flex-col">
        {[
          { tipo: 'receita'      as TipoModal, label: 'Receita',           color: 'var(--success)', glow: '#00E09644' },
          { tipo: 'despesa'      as TipoModal, label: 'Despesa',           color: 'var(--danger)',  glow: '#FF6B7A44' },
          { tipo: 'cartao'       as TipoModal, label: 'Cartão de Crédito', color: '#9D4EDD',         glow: '#9D4EDD44' },
          { tipo: 'transferencia'as TipoModal, label: 'Transferência',     color: 'var(--accent)',  glow: '#6C8EF544' },
        ].map(({ tipo, label, color, glow }) => (
          <button key={tipo} onClick={() => onSelect(tipo)}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg w-48 justify-center"
            style={{ background: color, boxShadow: `0 4px 20px ${glow}` }}>
            {tipo==='receita' && <TrendingUp size={16}/>}
            {tipo==='despesa' && <TrendingDown size={16}/>}
            {tipo==='cartao' && <CreditCard size={16}/>}
            {tipo==='transferencia' && <ArrowRightLeft size={16}/>}
            {label}
          </button>
        ))}
      </div>
    </>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const [fabOpen, setFabOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<TipoModal>(null)
  const [modalAberto, setModalAberto] = useState(false)
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

  function handleSelect(tipo: TipoModal) {
    setFabOpen(false)
    if (tipo) { setModalTipo(tipo); setModalAberto(true) }
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

        {/* Botão novo lançamento sidebar */}
        <div className="px-3 pb-6 relative">
          {fabOpen && (
            <div className="mb-2 flex flex-col gap-2">
              {([
                { tipo: 'receita'      as TipoModal, label: 'Receita',           color: 'var(--success)' },
                { tipo: 'despesa'      as TipoModal, label: 'Despesa',           color: 'var(--danger)' },
                { tipo: 'cartao'       as TipoModal, label: 'Cartão de Crédito', color: '#9D4EDD' },
                { tipo: 'transferencia'as TipoModal, label: 'Transferência',     color: 'var(--accent)' },
              ]).map(({ tipo, label, color }) => (
                <button key={tipo} onClick={() => handleSelect(tipo)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-white"
                  style={{ background: color }}>
                  {tipo==='receita' && <TrendingUp size={14}/>}
                  {tipo==='despesa' && <TrendingDown size={14}/>}
                  {tipo==='cartao' && <CreditCard size={14}/>}
                  {tipo==='transferencia' && <ArrowRightLeft size={14}/>}
                  {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setFabOpen(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ background: 'var(--primary)', boxShadow: 'var(--shadow-fab)' }}
            aria-label="Novo lançamento">
            {fabOpen ? <X size={17}/> : <span className="text-lg font-light leading-none">+</span>}
            Novo lançamento
          </button>
        </div>
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

      {/* ── BOTTOM NAV mobile ─────────────────────────────── */}
      {!hideNav && (
        <>
          {fabOpen && <FABMenu onSelect={handleSelect} />}
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

              {/* FAB central */}
              <div className="flex flex-col items-center">
                <button type="button" onClick={() => setFabOpen(v => !v)} aria-label="Novo lançamento"
                  className="w-14 h-14 rounded-2xl text-white flex items-center justify-center transition-all duration-200 active:scale-95 mb-1"
                  style={{
                    background: fabOpen ? 'var(--text-muted)' : 'var(--primary)',
                    boxShadow: 'var(--shadow-fab)',
                    transform: fabOpen ? 'rotate(45deg)' : 'none',
                  }}>
                  <span className="text-2xl font-light leading-none">+</span>
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
        </>
      )}

      <FormLancamentoModal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setModalTipo(null) }}
        defaultTipo={modalTipo === 'cartao' ? 'despesa' : modalTipo}
        abrirNoCartao={modalTipo === 'cartao'}
      />
    </div>
  )
}
