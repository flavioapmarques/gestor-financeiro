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
import { useStore } from '../../lib/store'
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
  const { sidebarColapsada, toggleSidebarColapsada } = useStore()
  const [fabOpen, setFabOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<TipoLancamentoOpcao | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalVozAberto, setModalVozAberto] = useState(false)

  function alternarSidebar() {
    toggleSidebarColapsada()
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
        {/* Cabeçalho da Sidebar (Logo & Marca) */}
        <div
          className={`pt-6 pb-4 flex items-center border-b border-[var(--border)] transition-all duration-300 ${
            sidebarColapsada ? 'px-0 justify-center' : 'px-5 gap-3'
          }`}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm transition-transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #7928CA 100%)' }}
            title="FMIT - Gestor Financeiro"
          >
            <Wallet size={20} />
          </div>
          {!sidebarColapsada && (
            <div className="flex flex-col min-w-0 animate-fade-in">
              <span className="font-bold text-base tracking-tight gradient-text whitespace-nowrap">Gestor</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium -mt-1 tracking-wider uppercase whitespace-nowrap">
                FMIT Finance
              </span>
            </div>
          )}
        </div>

        {/* Links de navegação */}
        <nav
          className={`flex-1 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none transition-all duration-300 ${
            sidebarColapsada ? 'px-2' : 'px-3'
          }`}
          aria-label="Menu principal"
        >
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={sidebarColapsada ? label : undefined}
              className={({ isActive }) =>
                `group relative flex items-center rounded-xl transition-all duration-150 ${
                  sidebarColapsada
                    ? 'justify-center w-11 h-11 mx-auto'
                    : 'gap-3 px-3.5 py-2.5 text-sm font-medium w-full'
                } ${
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    className="flex-shrink-0 transition-transform group-hover:scale-110"
                    aria-hidden
                  />
                  {!sidebarColapsada && (
                    <span className="truncate whitespace-nowrap animate-fade-in">{label}</span>
                  )}

                  {/* Tooltip flutuante elegante no modo compacto */}
                  {sidebarColapsada && (
                    <div
                      role="tooltip"
                      className="hidden lg:group-hover:flex items-center absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--text)] whitespace-nowrap shadow-xl z-[70] pointer-events-none animate-fade-in"
                      style={{
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border)',
                      }}
                    >
                      {label}
                      {/* Seta discreta apontando para o ícone */}
                      <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-elevated)] border-l border-b border-[var(--border)]" />
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé da sidebar com botão de alternância adicional */}
        <div
          className={`p-3 border-t border-[var(--border)] mt-auto flex items-center transition-all duration-300 ${
            sidebarColapsada ? 'justify-center' : 'justify-between'
          }`}
        >
          <button
            type="button"
            onClick={alternarSidebar}
            aria-label={sidebarColapsada ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={sidebarColapsada ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className="w-10 h-10 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--primary-soft)] text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center justify-center transition-all duration-150 group active:scale-95"
          >
            {sidebarColapsada ? (
              <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            ) : (
              <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            )}
          </button>
          {!sidebarColapsada && (
            <button
              type="button"
              onClick={alternarSidebar}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] font-medium transition-colors pr-2"
            >
              Recolher menu
            </button>
          )}
        </div>
      </aside>

      {/* Botão flutuante na borda da barra lateral */}
      <button
        type="button"
        onClick={alternarSidebar}
        aria-label={sidebarColapsada ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        title={sidebarColapsada ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        className={`hidden lg:flex fixed top-6 z-[60] w-6 h-10 items-center justify-center rounded-r-lg
                    bg-[var(--bg-elevated)] border border-l-0 border-[var(--border)] text-[var(--text-muted)]
                    hover:text-[var(--primary)] hover:bg-[var(--bg-muted)] transition-all duration-300 shadow-sm ${
                      sidebarColapsada ? 'left-[var(--sidebar-collapsed-w)]' : 'left-[var(--sidebar-w)]'
                    }`}
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
