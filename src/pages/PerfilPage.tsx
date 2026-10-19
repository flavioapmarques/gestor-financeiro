import { useNavigate } from 'react-router-dom'
import { Shield, Fingerprint, Palette, Download, Cloud, ChevronRight, Crown } from 'lucide-react'
import { usePerfil } from '../hooks/useData'
import { signOut } from '../lib/auth'
import { useStore } from '../lib/store'
import { Screen } from '../ui/Screen'
import { Card, Button } from '../ui/primitives'

const menu = [
  { icon: Shield, label: 'Segurança', to: '/configuracoes' },
  { icon: Fingerprint, label: 'Biometria', to: '/configuracoes' },
  { icon: Palette, label: 'Tema', to: '/configuracoes' },
  { icon: Download, label: 'Exportar dados', to: '/ajuda' },
  { icon: Cloud, label: 'Backup e sincronização', to: '/ajuda' },
]

export function PerfilPage() {
  const navigate = useNavigate()
  const setUserId = useStore(s => s.setUserId)
  const { data: perfil, isLoading } = usePerfil()
  const nome = perfil?.nome ?? 'Usuário'
  const inicial = nome.charAt(0).toUpperCase()

  async function handleSair() {
    await signOut()
    setUserId(null)
    navigate('/auth', { replace: true })
  }

  return (
    <Screen title="Perfil">
      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : (
        <Card className="mb-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-2xl font-bold text-white">
            {inicial}
          </div>
          <div>
            <p className="font-semibold text-lg">{nome}</p>
            {perfil?.cpf && <p className="text-xs text-[var(--text-subtle)]">CPF {perfil.cpf}</p>}
          </div>
        </Card>
      )}

      <button type="button" onClick={() => navigate('/premium')} className="w-full mb-4">
        <div className="rounded-2xl flex items-center gap-3 p-4 border border-[var(--primary)]/40 bg-[var(--bg-elevated)]" style={{ background: 'linear-gradient(135deg, var(--primary-soft), transparent)' }}>
          <Crown className="text-[var(--primary)]" size={24} />
          <div className="text-left flex-1">
            <p className="font-semibold text-sm">Assinatura Premium</p>
            <p className="text-xs text-[var(--text-muted)]">Desbloqueie insights com IA</p>
          </div>
          <ChevronRight size={18} className="text-[var(--text-muted)]" />
        </div>
      </button>

      <Card padding="none" className="mb-4">
        {menu.map((m, i) => (
          <button key={i} type="button" onClick={() => navigate(m.to)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-muted)] transition-colors">
            <m.icon size={18} className="text-[var(--text-muted)]" />
            <span className="flex-1 text-left text-sm">{m.label}</span>
            <ChevronRight size={16} className="text-[var(--text-subtle)]" />
          </button>
        ))}
      </Card>

      <Button variant="danger" className="w-full" onClick={handleSair}>Sair da conta</Button>
    </Screen>
  )
}
