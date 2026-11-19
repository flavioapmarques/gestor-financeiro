import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Banco, Categoria, Cartao, Lancamento, Meta } from '../lib/supabase'

interface AppState {
  userId: string | null
  setUserId: (id: string | null) => void
  darkMode: boolean
  toggleDarkMode: () => void
  bancos: Banco[]
  categorias: Categoria[]
  cartoes: Cartao[]
  lancamentos: Lancamento[]
  metas: Meta[]
  setBancos: (b: Banco[]) => void
  setCategorias: (c: Categoria[]) => void
  setCartoes: (c: Cartao[]) => void
  setLancamentos: (l: Lancamento[]) => void
  setMetas: (m: Meta[]) => void
  filtroMes: number
  filtroAno: number
  setFiltroMes: (mes: number) => void
  setFiltroAno: (ano: number) => void
  tabAtiva: string
  setTabAtiva: (tab: string) => void
  valoresOcultos: boolean
  toggleValoresOcultos: () => void
  sidebarColapsada: boolean
  setSidebarColapsada: (colapsada: boolean) => void
  toggleSidebarColapsada: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      userId: null,
      setUserId: (id) => set({ userId: id }),
      darkMode: true,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      bancos: [],
      categorias: [],
      cartoes: [],
      lancamentos: [],
      metas: [],
      setBancos: (bancos) => set({ bancos }),
      setCategorias: (categorias) => set({ categorias }),
      setCartoes: (cartoes) => set({ cartoes }),
      setLancamentos: (lancamentos) => set({ lancamentos }),
      setMetas: (metas) => set({ metas }),
      filtroMes: new Date().getMonth() + 1,
      filtroAno: new Date().getFullYear(),
      setFiltroMes: (filtroMes) => set({ filtroMes }),
      setFiltroAno: (filtroAno) => set({ filtroAno }),
      tabAtiva: 'dashboard',
      setTabAtiva: (tabAtiva) => set({ tabAtiva }),
      valoresOcultos: false,
      toggleValoresOcultos: () => set((s) => ({ valoresOcultos: !s.valoresOcultos })),
      sidebarColapsada: typeof window !== 'undefined' && localStorage.getItem('sidebar-colapsada') === '1',
      setSidebarColapsada: (sidebarColapsada) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sidebar-colapsada', sidebarColapsada ? '1' : '0')
        }
        set({ sidebarColapsada })
      },
      toggleSidebarColapsada: () => set((s) => {
        const next = !s.sidebarColapsada
        if (typeof window !== 'undefined') {
          localStorage.setItem('sidebar-colapsada', next ? '1' : '0')
        }
        return { sidebarColapsada: next }
      }),
    }),
    {
      name: 'gestor-financeiro',
      partialize: (state) => ({
        darkMode: state.darkMode,
        valoresOcultos: state.valoresOcultos,
        sidebarColapsada: state.sidebarColapsada,
      }),
    }
  )
)
