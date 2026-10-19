import { useState } from 'react'
import { Moon, Sun, Globe, DollarSign, Lock, Bell, Eye, Trash2, AlertTriangle } from 'lucide-react'
import { useStore } from '../lib/store'
import { Screen } from '../ui/Screen'
import { Card, Button } from '../ui/primitives'
import { useLimparTodosLancamentos } from '../hooks/useData'

export function ConfiguracoesPage() {
  const { darkMode, toggleDarkMode } = useStore()
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [sucessoMsg, setSucessoMsg] = useState(false)
  const { mutate: limparLancamentos, isPending } = useLimparTodosLancamentos()

  const rows = [
    { icon: darkMode ? Moon : Sun, label: 'Tema escuro', toggle: true, value: darkMode, onChange: toggleDarkMode },
    { icon: Globe, label: 'Idioma', value: 'Português (BR)' },
    { icon: DollarSign, label: 'Moeda', value: 'BRL (R$)' },
    { icon: Lock, label: 'PIN de acesso', value: 'Configurar' },
    { icon: Bell, label: 'Notificações', value: 'Ativas' },
    { icon: Eye, label: 'Privacidade', value: 'Gerenciar' },
  ]

  function handleConfirmarLimpeza() {
    limparLancamentos(undefined, {
      onSuccess: () => {
        setConfirmModalOpen(false)
        setSucessoMsg(true)
        setTimeout(() => setSucessoMsg(false), 4000)
      },
    })
  }

  return (
    <Screen title="Configurações" onBack>
      <div className="space-y-4">
        {sucessoMsg && (
          <div className="p-3 bg-[var(--success)]/15 border border-[var(--success)]/30 rounded-xl text-sm text-[var(--success)] flex items-center justify-between animate-fade-in">
            <span>Todos os lançamentos foram apagados com sucesso!</span>
          </div>
        )}

        <Card padding="none">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] last:border-0">
              <r.icon size={18} className="text-[var(--text-muted)]" />
              <span className="flex-1 text-sm">{r.label}</span>
              {'toggle' in r && r.toggle ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.value}
                  onClick={r.onChange}
                  className={`w-11 h-6 rounded-full transition-colors relative ${r.value ? 'bg-[var(--primary)]' : 'bg-[var(--bg-muted)]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${r.value ? 'left-6' : 'left-1'}`} />
                </button>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">{r.value}</span>
              )}
            </div>
          ))}
        </Card>

        <div className="pt-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2 px-1">
            Gerenciamento de Dados
          </h2>
          <Card padding="none">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors rounded-2xl"
            >
              <Trash2 size={18} />
              <div className="flex-1">
                <p className="font-medium">Apagar todos os lançamentos</p>
                <p className="text-xs text-[var(--text-muted)] font-normal">
                  Exclui receitas, despesas, transferências e movimentações de cartões
                </p>
              </div>
            </button>
          </Card>
        </div>
      </div>

      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-[var(--danger)]/15 text-[var(--danger)] flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold">Apagar todos os lançamentos?</h3>
              <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
                Esta ação é irreversível. Todas as suas receitas, despesas, parcelamentos e pagamentos de fatura serão removidos permanentemente.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={isPending}
                onClick={handleConfirmarLimpeza}
              >
                Sim, apagar tudo
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-[var(--text-subtle)] mt-8">Gestor Financeiro v1.0.0</p>
    </Screen>
  )
}

