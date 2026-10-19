import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'

const SPLASH_KEY = 'gf_splash_seen'

export function SplashPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(SPLASH_KEY, '1')
      const onboarding = localStorage.getItem('gf_onboarding_done')
      navigate(onboarding ? '/auth' : '/onboarding', { replace: true })
    }, 2200)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1A1F36 0%, #820AD1 45%, #3D5AFE 100%)' }}
      role="img"
      aria-label="Carregando Gestor Financeiro"
    >
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,white,transparent_40%)]" />
      <div className="relative animate-splash flex flex-col items-center">
        <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center mb-6 border border-white/20">
          <Wallet size={40} className="text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Gestor Financeiro</h1>
        <p className="text-white/70 text-sm mt-2">Seu dinheiro, sob controle</p>
        <div className="mt-12 flex gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-white/50 animate-pulse-soft"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
