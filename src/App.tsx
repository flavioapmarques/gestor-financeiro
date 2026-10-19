import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase'
import { ensureCategoriasPadrao, ensurePerfilExistente } from './lib/seedCategorias'
import { estenderRecorrencias } from './lib/estenderRecorrencias'
import { queryClient } from './lib/queryClient'
import { useStore } from './lib/store'
import { AppShell } from './components/layout/AppShell'

// Fluxo principal carregado de imediato (primeira tela após login)
import { SplashPage } from './pages/SplashPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { CadastroPage } from './pages/auth/CadastroPage'
import { HomePage } from './pages/HomePage'
import { Lancamentos } from './pages/Lancamentos'

// Páginas secundárias — carregadas sob demanda para reduzir o bundle inicial
const BancosPage = lazy(() => import('./pages/BancosPage').then(m => ({ default: m.BancosPage })))
const AdicionarBancoPage = lazy(() => import('./pages/AdicionarBancoPage').then(m => ({ default: m.AdicionarBancoPage })))
const CartoesPage = lazy(() => import('./pages/CartoesPage').then(m => ({ default: m.CartoesPage })))
const AdicionarCartaoPage = lazy(() => import('./pages/AdicionarCartaoPage').then(m => ({ default: m.AdicionarCartaoPage })))
const DetalheCartaoPage = lazy(() => import('./pages/DetalheCartaoPage').then(m => ({ default: m.DetalheCartaoPage })))
const FaturaPage = lazy(() => import('./pages/FaturaPage').then(m => ({ default: m.FaturaPage })))
const AdicionarDespesaPage = lazy(() => import('./pages/AdicionarDespesaPage').then(m => ({ default: m.AdicionarDespesaPage })))
const ParcelamentoPage = lazy(() => import('./pages/ParcelamentoPage').then(m => ({ default: m.ParcelamentoPage })))
const ReceitasPage = lazy(() => import('./pages/ReceitasPage').then(m => ({ default: m.ReceitasPage })))
const CategoriasPage = lazy(() => import('./pages/CategoriasPage').then(m => ({ default: m.CategoriasPage })))
const ImportarOfxPage = lazy(() => import('./pages/ImportarOfxPage').then(m => ({ default: m.ImportarOfxPage })))
const RelatoriosPage = lazy(() => import('./pages/RelatoriosPage').then(m => ({ default: m.RelatoriosPage })))
const MetasPage = lazy(() => import('./pages/MetasPage').then(m => ({ default: m.MetasPage })))
const NovaMetaPage = lazy(() => import('./pages/NovaMetaPage').then(m => ({ default: m.NovaMetaPage })))
const OrcamentosPage = lazy(() => import('./pages/OrcamentosPage').then(m => ({ default: m.OrcamentosPage })))
const NovoOrcamentoPage = lazy(() => import('./pages/NovoOrcamentoPage').then(m => ({ default: m.NovoOrcamentoPage })))
const CalendarioPage = lazy(() => import('./pages/CalendarioPage').then(m => ({ default: m.CalendarioPage })))
const NotificacoesPage = lazy(() => import('./pages/NotificacoesPage').then(m => ({ default: m.NotificacoesPage })))
const PerfilPage = lazy(() => import('./pages/PerfilPage').then(m => ({ default: m.PerfilPage })))
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage').then(m => ({ default: m.ConfiguracoesPage })))
const PremiumPage = lazy(() => import('./pages/PremiumPage').then(m => ({ default: m.PremiumPage })))
const InsightsPage = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })))
const BuscaPage = lazy(() => import('./pages/BuscaPage').then(m => ({ default: m.BuscaPage })))
const AjudaPage = lazy(() => import('./pages/AjudaPage').then(m => ({ default: m.AjudaPage })))
const EstadosDemoPage = lazy(() => import('./pages/EstadosDemoPage').then(m => ({ default: m.EstadosDemoPage })))

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
    </div>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const userId = useStore(s => s.userId)
  if (!userId) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { userId, setUserId, setBancos, setCategorias, setCartoes, setLancamentos, setMetas, darkMode } = useStore()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', darkMode)
    root.classList.toggle('light', !darkMode)
  }, [darkMode])

  useEffect(() => {
    function onSession(id: string | null, email?: string) {
      setUserId(id)
      queryClient.clear()
      setBancos([])
      setCategorias([])
      setCartoes([])
      setLancamentos([])
      setMetas([])
      if (id) {
        void ensurePerfilExistente(id, email)
        void ensureCategoriasPadrao(id)
        void estenderRecorrencias(id).then(qtd => {
          if (qtd > 0) queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
        })
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      onSession(session?.user?.id ?? null, session?.user?.email)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      onSession(session?.user?.id ?? null, session?.user?.email)
    })

    return () => subscription.unsubscribe()
  }, [setUserId, setBancos, setCategorias, setCartoes, setLancamentos, setMetas])

  return (
    <Routes>
      <Route path="/splash" element={<SplashPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/auth" element={userId ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/auth/cadastro" element={userId ? <Navigate to="/" replace /> : <CadastroPage />} />

      <Route element={<AuthGuard><AppShell /></AuthGuard>}>
        <Route index element={<HomePage />} />
        <Route path="lancamentos" element={<Lancamentos />} />
        <Route path="bancos" element={<Suspense fallback={<RouteFallback />}><BancosPage /></Suspense>} />
        <Route path="bancos/novo" element={<Suspense fallback={<RouteFallback />}><AdicionarBancoPage /></Suspense>} />
        <Route path="bancos/:id/editar" element={<Suspense fallback={<RouteFallback />}><AdicionarBancoPage /></Suspense>} />
        <Route path="cartoes" element={<Suspense fallback={<RouteFallback />}><CartoesPage /></Suspense>} />
        <Route path="cartoes/novo" element={<Suspense fallback={<RouteFallback />}><AdicionarCartaoPage /></Suspense>} />
        <Route path="cartoes/:id/editar" element={<Suspense fallback={<RouteFallback />}><AdicionarCartaoPage /></Suspense>} />
        <Route path="cartoes/:id" element={<Suspense fallback={<RouteFallback />}><DetalheCartaoPage /></Suspense>} />
        <Route path="cartoes/:id/fatura" element={<Suspense fallback={<RouteFallback />}><FaturaPage /></Suspense>} />
        <Route path="despesa/nova" element={<Suspense fallback={<RouteFallback />}><AdicionarDespesaPage /></Suspense>} />
        <Route path="parcelamento" element={<Suspense fallback={<RouteFallback />}><ParcelamentoPage /></Suspense>} />
        <Route path="receitas" element={<Suspense fallback={<RouteFallback />}><ReceitasPage /></Suspense>} />
        <Route path="categorias" element={<Suspense fallback={<RouteFallback />}><CategoriasPage /></Suspense>} />
        <Route path="importar-ofx" element={<Suspense fallback={<RouteFallback />}><ImportarOfxPage /></Suspense>} />
        <Route path="relatorios" element={<Suspense fallback={<RouteFallback />}><RelatoriosPage /></Suspense>} />
        <Route path="metas" element={<Suspense fallback={<RouteFallback />}><MetasPage /></Suspense>} />
        <Route path="metas/nova" element={<Suspense fallback={<RouteFallback />}><NovaMetaPage /></Suspense>} />
        <Route path="orcamentos" element={<Suspense fallback={<RouteFallback />}><OrcamentosPage /></Suspense>} />
        <Route path="orcamentos/novo" element={<Suspense fallback={<RouteFallback />}><NovoOrcamentoPage /></Suspense>} />
        <Route path="calendario" element={<Suspense fallback={<RouteFallback />}><CalendarioPage /></Suspense>} />
        <Route path="notificacoes" element={<Suspense fallback={<RouteFallback />}><NotificacoesPage /></Suspense>} />
        <Route path="perfil" element={<Suspense fallback={<RouteFallback />}><PerfilPage /></Suspense>} />
        <Route path="configuracoes" element={<Suspense fallback={<RouteFallback />}><ConfiguracoesPage /></Suspense>} />
        <Route path="premium" element={<Suspense fallback={<RouteFallback />}><PremiumPage /></Suspense>} />
        <Route path="insights" element={<Suspense fallback={<RouteFallback />}><InsightsPage /></Suspense>} />
        <Route path="busca" element={<Suspense fallback={<RouteFallback />}><BuscaPage /></Suspense>} />
        <Route path="ajuda" element={<Suspense fallback={<RouteFallback />}><AjudaPage /></Suspense>} />
        <Route path="estados" element={<Suspense fallback={<RouteFallback />}><EstadosDemoPage /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to={userId ? '/' : '/splash'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
