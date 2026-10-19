import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBancos, useAdicionarBanco, useAtualizarBanco } from '../hooks/useData'
import type { TipoConta } from '../lib/supabase'
import { Screen } from '../ui/Screen'
import { Button, Input, Chip } from '../ui/primitives'
import { ICONES_BANCO } from '../components/BankIcon'

const CORES = [
  '#820AD1', // Nubank Roxo
  '#FF7A00', // Inter / Itaú Laranja
  '#CC092F', // Bradesco Vermelho
  '#EC0000', // Santander Vermelho
  '#0038A8', // Banco do Brasil Azul
  '#0066B3', // Caixa Azul
  '#1A1A1A', // C6 Bank Dark
  '#001E62', // BTG / XP Azul Escuro
  '#00E5FF', // Neon Cyan
  '#00A868', // Stone Verde
  '#00C48C', // Esmeralda
  '#3D5AFE', // Azul Royal
  '#6C8EF5', // Índigo
  '#E91E63', // Rosa Magenta
  '#FFB020', // Amarelo Ouro
]

const TIPOS: { id: TipoConta; label: string }[] = [
  { id: 'corrente', label: 'Corrente' },
  { id: 'poupanca', label: 'Poupança' },
  { id: 'carteira', label: 'Carteira' },
  { id: 'investimento', label: 'Investimento' },
  { id: 'outro', label: 'Outro' },
]

export function AdicionarBancoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)
  const { data: bancos = [] } = useBancos()
  const adicionar = useAdicionarBanco()
  const atualizar = useAtualizarBanco()

  const [instituicao, setInstituicao] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoConta>('corrente')
  const [saldoInicial, setSaldoInicial] = useState('')
  const [dataSaldo, setDataSaldo] = useState(() => new Date().toISOString().split('T')[0])
  const [agencia, setAgencia] = useState('')
  const [numeroConta, setNumeroConta] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [icone, setIcone] = useState('landmark')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!id) return
    const b = bancos.find(x => x.id === id)
    if (!b) return
    setInstituicao(b.instituicao)
    setNome(b.nome)
    setTipo(b.tipo)
    setSaldoInicial(String(b.saldo_inicial))
    setDataSaldo(b.data_saldo_inicial)
    setAgencia(b.agencia ?? '')
    setNumeroConta(b.numero_conta ?? '')
    setCor(b.cor)
    setIcone(b.icone ?? 'landmark')
    setObservacao(b.observacao ?? '')
  }, [id, bancos])

  function parseValor(s: string) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!instituicao.trim() || !nome.trim()) {
      setErro('Preencha instituição e nome da conta')
      return
    }
    const payload = {
      instituicao: instituicao.trim(),
      nome: nome.trim(),
      tipo,
      saldo_inicial: parseValor(saldoInicial),
      data_saldo_inicial: dataSaldo,
      agencia: agencia.trim() || undefined,
      numero_conta: numeroConta.trim() || undefined,
      cor,
      icone,
      observacao: observacao.trim() || undefined,
    }
    try {
      if (editando && id) {
        await atualizar.mutateAsync({ id, ...payload })
      } else {
        await adicionar.mutateAsync(payload)
      }
      navigate('/bancos')
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  return (
    <Screen title={editando ? 'Editar banco' : 'Novo banco'} subtitle="Saldo e data de referência" onBack>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Instituição / Banco"
          placeholder="Ex: Nubank, Bradesco, Inter, Caixa"
          value={instituicao}
          onChange={e => setInstituicao(e.target.value)}
          required
        />
        <Input
          label="Nome da conta"
          placeholder="Ex: Conta corrente principal, Reserva de emergência"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
        />

        <div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-semibold">Tipo de conta</span>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(t => (
              <Chip key={t.id} active={tipo === t.id} onClick={() => setTipo(t.id)}>{t.label}</Chip>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-semibold">Ícone da conta</span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {ICONES_BANCO.map(item => {
              const IconComp = item.icon
              const selected = icone === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIcone(item.id)}
                  title={item.label}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    selected
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm'
                      : 'border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-muted)] hover:border-[var(--primary)]/40 hover:text-[var(--text)]'
                  }`}
                >
                  <IconComp size={20} />
                  <span className="text-[9px] font-semibold text-center leading-tight truncate w-full">{item.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Saldo inicial (R$)"
            inputMode="decimal"
            placeholder="0,00"
            value={saldoInicial}
            onChange={e => setSaldoInicial(e.target.value)}
            required
          />
          <Input
            label="Data do saldo inicial"
            type="date"
            value={dataSaldo}
            onChange={e => setDataSaldo(e.target.value)}
            required
          />
        </div>
        <p className="text-[11px] text-[var(--text-muted)] -mt-2">
          Movimentações a partir dessa data entram no cálculo do saldo atual.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Agência (opcional)" value={agencia} onChange={e => setAgencia(e.target.value)} />
          <Input label="Nº conta (opcional)" value={numeroConta} onChange={e => setNumeroConta(e.target.value)} />
        </div>
        <Input label="Observação" value={observacao} onChange={e => setObservacao(e.target.value)} />

        <div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-semibold">Cor da marca</span>
          <div className="flex flex-wrap gap-2.5">
            {CORES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                className={`w-9 h-9 rounded-full border-2 transition-transform ${cor === c ? 'border-[var(--text)] scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        {erro && <p className="text-xs text-[var(--danger)]" role="alert">{erro}</p>}
        <Button type="submit" className="w-full" size="lg" loading={adicionar.isPending || atualizar.isPending}>
          {editando ? 'Salvar alterações' : 'Cadastrar banco'}
        </Button>
      </form>
    </Screen>
  )
}

