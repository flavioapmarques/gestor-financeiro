import { useEffect, useMemo, useState } from 'react'
import { X, Paperclip, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Lancamento, TipoLancamento, Frequencia } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { useCategorias, useBancos, useCartoes, useAdicionarLancamento, useAtualizarLancamento, useHistoricoDescricoes } from '../../hooks/useData'
import { agruparCategorias } from '../../lib/categorias'
import { agruparHistoricoPorEstabelecimento, buscarSugestoes } from '../../lib/autocompleteEstabelecimentos'
import { mesFaturaCartao, mesVencimentoFatura } from '../../lib/lancamentos'

interface Props {
  open: boolean
  onClose: () => void
  defaultTipo?: TipoLancamento | null
  defaultCartaoId?: string
  abrirNoCartao?: boolean
  lancamento?: Lancamento | null
}

type Aba = 'receita' | 'despesa' | 'cartao' | 'transferencia'
const ABAS: { id: Aba; label: string }[] = [
  { id: 'receita', label: 'Receita' },
  { id: 'despesa', label: 'Despesa' },
  { id: 'cartao', label: 'Cartão' },
  { id: 'transferencia', label: 'Transfer.' },
]

const FREQUENCIAS: { id: Frequencia; label: string }[] = [
  { id: 'mensal', label: 'Mensal' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'quinzenal', label: 'Quinzenal' },
  { id: 'anual', label: 'Anual' },
]

export function FormLancamentoModal({ open, onClose, defaultTipo = null, defaultCartaoId, abrirNoCartao, lancamento }: Props) {
  const { data: categorias = [] } = useCategorias()
  const { data: bancos = [] } = useBancos()
  const { data: cartoes = [] } = useCartoes()
  const { data: historico = [] } = useHistoricoDescricoes()
  const adicionar = useAdicionarLancamento()
  const atualizar = useAtualizarLancamento()

  const [tipo, setTipo] = useState<TipoLancamento | null>(defaultTipo)
  const [descricao, setDescricao] = useState('')
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [valorStr, setValorStr] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [chipData, setChipData] = useState<'hoje' | 'ontem' | 'outros'>('hoje')
  const [dataVencimentoParcela, setDataVencimentoParcela] = useState('')
  const [pago, setPago] = useState(true)
  const [ignorarTransacao, setIgnorarTransacao] = useState(false)
  const [maisDetalhes, setMaisDetalhes] = useState(false)
  const [categoriaId, setCategoriaId] = useState('')
  const [bancoId, setBancoId] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [bancoDestinoId, setBancoDestinoId] = useState('')
  const [parcelado, setParcelado] = useState(false)
  const [totalParcelas, setTotalParcelas] = useState(2)
  const [recorrente, setRecorrente] = useState(false)
  const [frequencia, setFrequencia] = useState<Frequencia>('mensal')
  const [escopoEdicao, setEscopoEdicao] = useState<'apenas_esta' | 'esta_e_proximas' | 'todas'>('apenas_esta')
  const [erro, setErro] = useState('')
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null)
  const [comprovanteUrl, setComprovanteUrl] = useState<string | undefined>(undefined)
  const [enviandoComprovante, setEnviandoComprovante] = useState(false)
  const userId = useStore(s => s.userId)

  const cartaoSelecionado = cartoes.find(c => c.id === cartaoId)
  const abaAtiva: Aba | null = tipo === 'despesa' ? (cartaoId ? 'cartao' : 'despesa') : tipo

  function selecionarAba(aba: Aba) {
    if (aba === 'cartao') {
      setTipo('despesa')
      setBancoId('')
      if (!cartaoId && cartoes[0]) setCartaoId(cartoes[0].id)
    } else if (aba === 'despesa') {
      setTipo('despesa')
      setCartaoId('')
      if (!bancoId && bancos[0]) setBancoId(bancos[0].id)
    } else {
      setTipo(aba)
      setCartaoId('')
    }
  }

  function selecionarChipData(opcao: 'hoje' | 'ontem' | 'outros') {
    setChipData(opcao)
    const hojeStr = new Date().toISOString().split('T')[0]
    if (opcao === 'hoje') {
      setData(hojeStr)
    } else if (opcao === 'ontem') {
      const ontem = new Date()
      ontem.setDate(ontem.getDate() - 1)
      setData(ontem.toISOString().split('T')[0])
    }
  }

  function resetarFormulario(l: Lancamento | null = null, tipoPreservado: TipoLancamento | null = defaultTipo, manterContexto = false) {
    setErro('')
    setEscopoEdicao('apenas_esta')
    setMaisDetalhes(!!(l?.observacao || l?.parcelado || l?.recorrente || l?.comprovante_url))
    setDescricao(l?.descricao ?? '')
    setObservacao(l?.observacao ?? '')
    setComprovanteFile(null)
    setComprovanteUrl(l?.comprovante_url ?? undefined)
    setValorStr(l ? formatarValorParaInput(l.valor) : '')

    const dataInicial = l?.data ?? new Date().toISOString().split('T')[0]
    setData(dataInicial)
    const hojeStr = new Date().toISOString().split('T')[0]
    const ontemStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (dataInicial === hojeStr) setChipData('hoje')
    else if (dataInicial === ontemStr) setChipData('ontem')
    else setChipData('outros')

    setDataVencimentoParcela(l?.data_vencimento_parcela ?? l?.data ?? '')
    setPago(l ? l.efetivado : true)
    setIgnorarTransacao(l?.tags?.includes('ignorar') ?? false)
    setCategoriaId(l?.categoria_id ?? (manterContexto ? categoriaId : ''))
    setCartaoId(l?.cartao_id ?? (manterContexto ? cartaoId : ''))
    setParcelado(l?.parcelado ?? false)
    setTotalParcelas(l?.total_parcelas ?? 2)
    setRecorrente(l?.recorrente ?? false)
    setTipo(l?.tipo ?? tipoPreservado)
    if (bancos[0]) {
      const origemId = l?.banco_id ?? (manterContexto ? bancoId : bancos[0].id)
      setBancoId(origemId)
      const destinoPadrao = bancos.find(b => b.id !== origemId)?.id ?? ''
      setBancoDestinoId(l?.banco_destino_id ?? (manterContexto ? bancoDestinoId : destinoPadrao))
    } else {
      setBancoId(l?.banco_id ?? '')
      setBancoDestinoId(l?.banco_destino_id ?? '')
    }
  }

  useEffect(() => {
    if (!open) return
    if (lancamento) {
      resetarFormulario(lancamento)
    } else {
      resetarFormulario(null, defaultTipo)
      if (defaultCartaoId) {
        setTipo('despesa')
        setCartaoId(defaultCartaoId)
      } else if (abrirNoCartao) {
        setTipo('despesa')
        if (cartoes[0]) setCartaoId(cartoes[0].id)
      }
    }
  }, [open, bancos, cartoes, defaultTipo, defaultCartaoId, abrirNoCartao, lancamento])

  useEffect(() => {
    if (cartaoId) {
      setPago(false)
    } else if (tipo === 'despesa') {
      setPago(true)
    }
  }, [cartaoId, tipo])

  useEffect(() => {
    if (!open || !cartaoId || !cartaoSelecionado || lancamento) return
    const venc = mesVencimentoFatura(data, cartaoSelecionado.dia_fechamento, cartaoSelecionado.dia_vencimento)
    const ultimoDia = new Date(venc.ano, venc.mes, 0).getDate()
    const vencimentoDia = Math.min(cartaoSelecionado.dia_vencimento, ultimoDia)
    const defaultDueDate = `${venc.ano}-${String(venc.mes).padStart(2, '0')}-${String(vencimentoDia).padStart(2, '0')}`
    if (!dataVencimentoParcela || dataVencimentoParcela === data) {
      setDataVencimentoParcela(defaultDueDate)
    }
  }, [open, cartaoId, cartaoSelecionado, data, dataVencimentoParcela, lancamento])

  const filtradas = categorias.filter(c => {
    if (tipo === 'receita') return c.tipo === 'receita' || c.tipo === 'ambos'
    if (tipo === 'despesa') return c.tipo === 'despesa' || c.tipo === 'ambos'
    return true
  })
  const categoriasArvore = agruparCategorias(filtradas)

  const indiceEstabelecimentos = useMemo(
    () => (tipo ? agruparHistoricoPorEstabelecimento(historico, tipo) : new Map()),
    [historico, tipo]
  )
  const sugestoesEstabelecimento = useMemo(
    () => buscarSugestoes(indiceEstabelecimentos, descricao),
    [indiceEstabelecimentos, descricao]
  )

  function escolherSugestao(descricaoEscolhida: string, categoriaEscolhidaId?: string) {
    setDescricao(descricaoEscolhida)
    if (categoriaEscolhidaId) setCategoriaId(categoriaEscolhidaId)
    setSugestoesAbertas(false)
  }

  function formatarValorParaInput(valor: number): string {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function formatarValorParaDigitacao(valor: string): string {
    const apenasDigitos = valor.replace(/[^\d]/g, '')
    if (!apenasDigitos) return ''
    const numero = Number(apenasDigitos) / 100
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function parseValor(s: string): number {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }

  async function salvar(closeAfter: boolean) {
    setErro('')
    const valor = parseValor(valorStr)
    if (!tipo) {
      setErro('Escolha se é uma despesa ou uma entrada antes de salvar.')
      return
    }

    if (!descricao.trim()) {
      setErro('Informe uma descrição')
      return
    }
    if (valor <= 0) {
      setErro('Informe um valor válido')
      return
    }
    if (parcelado && totalParcelas < 2) {
      setErro('Parcelamento precisa de pelo menos 2 parcelas')
      return
    }
    if (tipo === 'transferencia' && (!bancoId || !bancoDestinoId)) {
      setErro('Selecione a conta de origem e a conta de destino.')
      return
    }
    if (tipo === 'transferencia' && bancoId === bancoDestinoId) {
      setErro('A conta de origem precisa ser diferente da conta de destino.')
      return
    }
    if (tipo === 'despesa' && !bancoId && !cartaoId) {
      setErro('Selecione um banco (débito/PIX) ou um cartão de crédito.')
      return
    }
    if (parcelado && recorrente) {
      setErro('Escolha parcelamento ou recorrência, não os dois ao mesmo tempo.')
      return
    }

    try {
      let urlComprovante = comprovanteUrl
      if (comprovanteFile && userId) {
        setEnviandoComprovante(true)
        const extensao = comprovanteFile.name.split('.').pop() ?? 'jpg'
        const caminho = `${userId}/${crypto.randomUUID()}.${extensao}`
        const { error: erroUpload } = await supabase.storage
          .from('comprovantes')
          .upload(caminho, comprovanteFile, { upsert: false })
        setEnviandoComprovante(false)
        if (erroUpload) {
          setErro(`Não foi possível anexar o comprovante: ${erroUpload.message}`)
          return
        }
        const { data: publicUrlData } = supabase.storage.from('comprovantes').getPublicUrl(caminho)
        urlComprovante = publicUrlData.publicUrl
      }

      const existingTags = lancamento?.tags ?? []
      let tagsFinal = existingTags.filter(t => t !== 'ignorar')
      if (ignorarTransacao) {
        tagsFinal.push('ignorar')
      }

      if (lancamento) {
        const isParcelaExistente = !!lancamento.grupo_parcela_id || (lancamento.parcelado && (lancamento.parcela_atual ?? 0) > 0)
        await atualizar.mutateAsync({
          id: lancamento.id,
          escopoParcela: isParcelaExistente ? escopoEdicao : undefined,
          grupoParcelaId: lancamento.grupo_parcela_id ?? undefined,
          parcelaAtual: lancamento.parcela_atual ?? undefined,
          updates: {
            tipo,
            descricao: descricao.trim(),
            valor,
            data,
            categoria_id: categoriaId || undefined,
            banco_id: tipo === 'transferencia' ? (bancoId || undefined) : cartaoId ? undefined : (bancoId || undefined),
            banco_destino_id: tipo === 'transferencia' ? (bancoDestinoId || undefined) : undefined,
            cartao_id: tipo === 'despesa' && cartaoId ? cartaoId : undefined,
            parcelado: lancamento.parcelado ? true : parcelado,
            total_parcelas: lancamento.parcelado ? (lancamento.total_parcelas ?? totalParcelas) : (parcelado ? totalParcelas : undefined),
            parcela_atual: lancamento.parcelado ? (lancamento.parcela_atual ?? 1) : (parcelado ? 1 : undefined),
            recorrente,
            frequencia: recorrente ? frequencia : undefined,
            observacao: observacao.trim() || undefined,
            comprovante_url: urlComprovante,
            efetivado: tipo === 'transferencia' ? true : cartaoId ? false : pago,
            data_vencimento_parcela: cartaoId ? dataVencimentoParcela || undefined : undefined,
            tags: tagsFinal.length > 0 ? tagsFinal : undefined,
          },
        })
      } else {
        await adicionar.mutateAsync({
          tipo,
          descricao: descricao.trim(),
          valor,
          data,
          categoria_id: categoriaId || undefined,
          banco_id: tipo === 'transferencia' ? (bancoId || undefined) : cartaoId ? undefined : (bancoId || undefined),
          banco_destino_id: tipo === 'transferencia' ? (bancoDestinoId || undefined) : undefined,
          cartao_id: tipo === 'despesa' && cartaoId ? cartaoId : undefined,
          parcelado,
          total_parcelas: parcelado ? totalParcelas : undefined,
          parcela_atual: parcelado ? 1 : undefined,
          recorrente,
          frequencia: recorrente ? frequencia : undefined,
          observacao: observacao.trim() || undefined,
          comprovante_url: urlComprovante,
          efetivado: tipo === 'transferencia' ? true : cartaoId ? false : pago,
          data_vencimento_parcela: cartaoId ? dataVencimentoParcela || undefined : undefined,
          tags: tagsFinal.length > 0 ? tagsFinal : undefined,
        })
      }

      if (closeAfter) {
        onClose()
      } else {
        resetarFormulario(null, tipo, true)
      }
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await salvar(true)
  }

  if (!open) return null

  const tituloModal = lancamento
    ? 'Editar lançamento'
    : abaAtiva === 'cartao'
    ? 'Nova despesa cartão de crédito'
    : abaAtiva === 'receita'
    ? 'Nova receita'
    : abaAtiva === 'transferencia'
    ? 'Nova transferência'
    : 'Nova despesa'

  const corValor = abaAtiva === 'receita'
    ? 'text-[var(--success)]'
    : abaAtiva === 'transferencia'
    ? 'text-[var(--primary)]'
    : 'text-[var(--danger)]'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 md:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-t-3xl md:rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl animate-slide-up">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-elevated)] z-10">
          <h2 className="text-base font-bold">{tituloModal}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 pb-8">
          {/* Selector Abas (Receita / Despesa / Cartao / Transferencia) */}
          <div className="flex bg-[var(--bg-muted)] rounded-xl p-1 gap-1 border border-[var(--border)]">
            {ABAS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => selecionarAba(a.id)}
                className={`flex-1 py-2 text-xs rounded-lg font-medium transition-all ${
                  abaAtiva === a.id ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Banner de Edicao de Parcela Existente */}
          {lancamento && (lancamento.grupo_parcela_id || (lancamento.parcelado && (lancamento.parcela_atual ?? 0) > 0)) && (
            <div className="bg-[var(--primary-soft)] border border-[var(--primary)]/30 rounded-2xl p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--primary)] flex items-center gap-1.5">
                  Editando Parcela {lancamento.parcela_atual}/{lancamento.total_parcelas}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-medium">Compra parcelada</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Altere o valor para acertar centavos ou altere o vencimento da parcela em <em>Mais detalhes</em> para jogá-la para outra fatura.
              </p>
              <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Aplicar edição em:</span>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="escopoEdicao"
                      checked={escopoEdicao === 'apenas_esta'}
                      onChange={() => setEscopoEdicao('apenas_esta')}
                      className="accent-[var(--primary)]"
                    />
                    Apenas esta parcela
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="escopoEdicao"
                      checked={escopoEdicao === 'esta_e_proximas'}
                      onChange={() => setEscopoEdicao('esta_e_proximas')}
                      className="accent-[var(--primary)]"
                    />
                    Esta e próximas
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="escopoEdicao"
                      checked={escopoEdicao === 'todas'}
                      onChange={() => setEscopoEdicao('todas')}
                      className="accent-[var(--primary)]"
                    />
                    Todas do grupo
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Campo de Valor em Destaque (Estilo Clean Mockup) */}
          <div className="bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Valor</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${corValor}`}>
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorStr}
                onChange={e => setValorStr(formatarValorParaDigitacao(e.target.value))}
                required
                className={`w-36 text-right bg-transparent text-2xl sm:text-3xl font-extrabold font-mono focus:outline-none tracking-tight ${corValor}`}
              />
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">BRL</span>
            </div>
          </div>

          {/* Status Toggle: Foi Paga / Foi Recebida */}
          {tipo !== 'transferencia' && (
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
                {abaAtiva === 'receita' ? 'Foi recebida' : 'Foi paga'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={pago}
                  onChange={e => setPago(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 bg-[var(--bg-muted)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                  abaAtiva === 'receita' ? 'peer-checked:bg-[var(--success)]' : 'peer-checked:bg-[var(--danger)]'
                }`} />
              </label>
            </div>
          )}

          {/* Seletor Rápido de Data (Chips) */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block">Data</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selecionarChipData('hoje')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  chipData === 'hoje'
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => selecionarChipData('ontem')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  chipData === 'ontem'
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => selecionarChipData('outros')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  chipData === 'outros'
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Outros...
              </button>
            </div>
            {chipData === 'outros' && (
              <input
                type="date"
                value={data}
                onChange={e => {
                  setData(e.target.value)
                  setDataVencimentoParcela('')
                }}
                required
                className="w-full mt-2 bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)]"
              />
            )}
          </div>

          {/* Descricao com Autocomplete */}
          <div className="relative">
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">Descrição</label>
            <input
              type="text"
              placeholder="Ex.: Mercado, Restaurante, Salário"
              value={descricao}
              onChange={e => { setDescricao(e.target.value); setSugestoesAbertas(true) }}
              onFocus={() => setSugestoesAbertas(true)}
              onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
              required
              autoComplete="off"
              className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--primary)]"
            />
            {sugestoesAbertas && sugestoesEstabelecimento.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                {sugestoesEstabelecimento.map(s => (
                  <div key={s.chave} className="border-b border-[var(--border)] last:border-0">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => escolherSugestao(s.descricao, s.categorias[0]?.id)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg-muted)] transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="font-medium">{s.descricao}</span>
                      {s.categorias[0] && (
                        <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.categorias[0].cor ?? 'var(--primary)' }} />
                          {s.categorias[0].nome}
                        </span>
                      )}
                    </button>
                    {s.categorias.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 px-4 pb-2 -mt-1">
                        {s.categorias.slice(1).map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => escolherSugestao(s.descricao, c.id)}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                          >
                            ou {c.nome}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Categoria */}
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">Categoria</label>
            <select
              value={categoriaId}
              onChange={e => setCategoriaId(e.target.value)}
              className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="">Sem categoria</option>
              {categoriasArvore.map(pai => (
                <optgroup key={pai.id} label={pai.nome}>
                  <option value={pai.id}>{pai.nome} (principal)</option>
                  {pai.subcategorias?.map(sub => (
                    <option key={sub.id} value={sub.id}>↳ {sub.nome}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Conta / Banco / Cartao / Destino */}
          {tipo === 'transferencia' ? (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">Conta de origem</label>
                <select
                  value={bancoId}
                  onChange={e => {
                    const novoId = e.target.value
                    setBancoId(novoId)
                    if (bancoDestinoId === novoId) {
                      const outro = bancos.find(b => b.id !== novoId)
                      setBancoDestinoId(outro?.id ?? '')
                    }
                  }}
                  className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
                >
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.instituicao} — {b.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">Conta de destino</label>
                {bancos.length < 2 ? (
                  <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2.5 rounded-xl">
                    Você precisa de pelo menos 2 contas cadastradas para fazer uma transferência.
                  </p>
                ) : (
                  <select
                    value={bancoDestinoId}
                    onChange={e => setBancoDestinoId(e.target.value)}
                    className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="">Selecione a conta de destino</option>
                    {bancos.filter(b => b.id !== bancoId).map(b => (
                      <option key={b.id} value={b.id}>{b.instituicao} — {b.nome}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ) : tipo === 'despesa' ? (
            <div className="space-y-3">
              {abaAtiva === 'cartao' ? (
                cartoes.length === 0 ? (
                  <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2.5 rounded-xl">
                    Você ainda não tem nenhum cartão cadastrado.
                  </p>
                ) : (
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">Cartão de crédito</label>
                    <select
                      value={cartaoId}
                      onChange={e => setCartaoId(e.target.value)}
                      className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">Selecione o cartão</option>
                      {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                )
              ) : (
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">Conta / Banco</label>
                  <select
                    value={bancoId}
                    onChange={e => setBancoId(e.target.value)}
                    className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="">Selecione o banco</option>
                    {bancos.map(b => <option key={b.id} value={b.id}>{b.instituicao} — {b.nome}</option>)}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">Conta / Banco</label>
              <select
                value={bancoId}
                onChange={e => setBancoId(e.target.value)}
                className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
              >
                {bancos.map(b => <option key={b.id} value={b.id}>{b.instituicao} — {b.nome}</option>)}
              </select>
            </div>
          )}

          {/* Anexar Arquivo & Ignorar Transacao */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 w-full bg-[var(--bg-muted)] border border-dashed border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-muted)] cursor-pointer hover:border-[var(--primary)] transition-colors">
              {enviandoComprovante ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
              <span className="truncate">
                {enviandoComprovante
                  ? 'Enviando comprovante...'
                  : comprovanteFile?.name ?? (comprovanteUrl ? 'Comprovante anexado' : 'Anexar Arquivo')}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) setComprovanteFile(f)
                }}
              />
            </label>
            {comprovanteUrl && !comprovanteFile && (
              <div className="flex items-center gap-3 px-1">
                <a href={comprovanteUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--primary)] underline">Ver comprovante atual</a>
                <button type="button" onClick={() => setComprovanteUrl(undefined)} className="text-xs text-[var(--danger)]">Remover</button>
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-[var(--text-muted)] font-medium">Ignorar transação</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignorarTransacao}
                  onChange={e => setIgnorarTransacao(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[var(--bg-muted)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]" />
              </label>
            </div>
          </div>

          {/* Toggle Retrátil: Mais Detalhes > / Menos Detalhes < */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setMaisDetalhes(!maisDetalhes)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mx-auto py-1"
            >
              {maisDetalhes ? (
                <>Menos detalhes <ChevronUp size={14} /></>
              ) : (
                <>Mais detalhes <ChevronDown size={14} /></>
              )}
            </button>

            {maisDetalhes && (
              <div className="mt-3 space-y-4 pt-3 border-t border-[var(--border)] animate-fade-in">
                <textarea
                  rows={2}
                  placeholder="Observação (detalhes importantes, itens comprados)"
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--primary)] resize-none"
                />

                {cartaoSelecionado && (
                  <div className="rounded-xl bg-[var(--bg-muted)] p-3 border border-[var(--border)] text-[11px] text-[var(--text-muted)] space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-wider font-semibold">
                        Data de vencimento da parcela (mês da fatura)
                      </span>
                      <input
                        type="date"
                        value={dataVencimentoParcela}
                        onChange={e => setDataVencimentoParcela(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                      />
                    </label>
                  </div>
                )}

                <div className="bg-[var(--bg-muted)] rounded-xl p-3 space-y-3 border border-[var(--border)]">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium">Parcelado</span>
                    <input
                      type="checkbox"
                      checked={parcelado}
                      onChange={e => { setParcelado(e.target.checked); if (e.target.checked) setRecorrente(false) }}
                      className="w-4 h-4 accent-[var(--primary)]"
                    />
                  </label>
                  {parcelado && (
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Total de parcelas</label>
                      <input
                        type="number"
                        min={2}
                        max={48}
                        value={totalParcelas}
                        onChange={e => setTotalParcelas(Number(e.target.value))}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  )}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium">Despesa fixa / Recorrente</span>
                    <input
                      type="checkbox"
                      checked={recorrente}
                      onChange={e => { setRecorrente(e.target.checked); if (e.target.checked) setParcelado(false) }}
                      className="w-4 h-4 accent-[var(--primary)]"
                    />
                  </label>
                  {recorrente && (
                    <select
                      value={frequencia}
                      onChange={e => setFrequencia(e.target.value as Frequencia)}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                    >
                      {FREQUENCIAS.map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>

          {erro && (
            <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 rounded-lg">{erro}</p>
          )}

          {/* Botões do Rodapé: SALVAR E CRIAR NOVA / SALVAR */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => void salvar(false)}
              disabled={adicionar.isPending || atualizar.isPending || enviandoComprovante}
              className="w-full bg-[var(--bg-muted)] border border-[var(--border)] hover:bg-[var(--border)] disabled:opacity-50 text-[var(--text)] font-semibold py-3 text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              {(adicionar.isPending || atualizar.isPending || enviandoComprovante) ? 'Salvando...' : 'Salvar e criar nova'}
            </button>
            <button
              type="submit"
              disabled={adicionar.isPending || atualizar.isPending || enviandoComprovante}
              className="w-full bg-[var(--primary)] hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
            >
              {(adicionar.isPending || atualizar.isPending || enviandoComprovante) ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
