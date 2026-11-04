import { useState, useEffect, useMemo } from 'react'
import {
  Mic, MicOff, Sparkles, X, Check, AlertCircle, RefreshCw,
  CreditCard, Landmark, Calendar, Tags, ArrowRight, Loader2, ChevronDown
} from 'lucide-react'
import { useBancos, useCartoes, useCategorias, useAdicionarLancamento, useHistoricoDescricoes } from '../../hooks/useData'
import { agruparCategorias } from '../../lib/categorias'
import { agruparHistoricoPorEstabelecimento, buscarSugestoes } from '../../lib/autocompleteEstabelecimentos'
import { formatBRL } from '../../lib/utils'
import { useReconhecimentoVoz } from '../../lib/useReconhecimentoVoz'
import { interpretarComandoVoz, type DadosLancamentoVoz } from '../../lib/vozLancamento'

interface Props {
  open: boolean
  onClose: () => void
}

type Etapa = 'gravando' | 'interpretando' | 'confirmando' | 'sucesso'

export function ModalLancamentoVoz({ open, onClose }: Props) {
  const { data: bancos = [] } = useBancos()
  const { data: cartoes = [] } = useCartoes()
  const { data: categorias = [] } = useCategorias()
  const { data: historico = [] } = useHistoricoDescricoes()
  const adicionar = useAdicionarLancamento()

  const {
    suportado,
    ouvindo,
    transcricao,
    transcricaoFinal,
    volumeAudio,
    erro: erroVoz,
    iniciarOuvir,
    pararOuvir,
    limparTranscricao,
  } = useReconhecimentoVoz()

  const [etapa, setEtapa] = useState<Etapa>('gravando')
  const [comandoManual, setComandoManual] = useState('')
  const [dadosInterpretados, setDadosInterpretados] = useState<DadosLancamentoVoz | null>(null)

  // Campos editáveis na tela de confirmação
  const [descricao, setDescricao] = useState('')
  const [valorStr, setValorStr] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<'cartao' | 'banco'>('cartao')
  const [cartaoId, setCartaoId] = useState('')
  const [bancoId, setBancoId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [chipData, setChipData] = useState<'hoje' | 'ontem' | 'outros'>('hoje')
  const [parcelado, setParcelado] = useState(false)
  const [totalParcelas, setTotalParcelas] = useState(2)
  const [observacao, setObservacao] = useState('')
  const [erroSalvar, setErroSalvar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)

  const categoriasArvore = useMemo(() => agruparCategorias(categorias), [categorias])
  const indiceEstabelecimentos = useMemo(
    () => agruparHistoricoPorEstabelecimento(historico, 'despesa'),
    [historico]
  )
  const sugestoesEstabelecimento = useMemo(() => {
    return buscarSugestoes(indiceEstabelecimentos, descricao).slice(0, 4)
  }, [indiceEstabelecimentos, descricao])

  // Iniciar reconhecimento automaticamente ao abrir o modal
  useEffect(() => {
    if (open) {
      setEtapa('gravando')
      setComandoManual('')
      setDadosInterpretados(null)
      setErroSalvar('')
      limparTranscricao()
      iniciarOuvir()
    } else {
      pararOuvir()
    }
  }, [open, iniciarOuvir, pararOuvir, limparTranscricao])

  // Processa a transcrição e popula a tela de confirmação
  function processarComando(texto: string) {
    if (!texto.trim()) return
    pararOuvir()
    setEtapa('interpretando')

    // Breve pausa para transição fluida de IA
    setTimeout(() => {
      const interpretado = interpretarComandoVoz(texto, bancos, cartoes, categorias)
      setDadosInterpretados(interpretado)

      // Popula campos da tela de confirmação
      setDescricao(interpretado.descricao)
      setValorStr(
        interpretado.valor > 0
          ? interpretado.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : ''
      )
      setData(interpretado.data)
      const hojeStr = new Date().toISOString().split('T')[0]
      const ontem = new Date()
      ontem.setDate(ontem.getDate() - 1)
      const ontemStr = ontem.toISOString().split('T')[0]
      if (interpretado.data === hojeStr) setChipData('hoje')
      else if (interpretado.data === ontemStr) setChipData('ontem')
      else setChipData('outros')

      const querCartao = interpretado.formaPagamento === 'cartao' || (cartoes.length > 0 && !interpretado.bancoId)
      setFormaPagamento(querCartao ? 'cartao' : 'banco')
      setCartaoId(interpretado.cartaoId || cartoes[0]?.id || '')
      setBancoId(interpretado.bancoId || bancos[0]?.id || '')
      setCategoriaId(interpretado.categoriaId || '')
      setParcelado(interpretado.parcelado)
      setTotalParcelas(interpretado.totalParcelas || 2)
      setObservacao(interpretado.observacao || '')

      setEtapa('confirmando')
    }, 450)
  }

  function handlePararEInterpretar() {
    const texto = transcricao.trim() || comandoManual.trim()
    if (texto) {
      processarComando(texto)
    }
  }

  function reiniciarGravacao() {
    setEtapa('gravando')
    setComandoManual('')
    setDadosInterpretados(null)
    setErroSalvar('')
    limparTranscricao()
    iniciarOuvir()
  }

  function formatarValorDigitacao(valor: string): string {
    const apenasDigitos = valor.replace(/[^\d]/g, '')
    if (!apenasDigitos) return ''
    const numero = Number(apenasDigitos) / 100
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function parseValor(s: string): number {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
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

  // REGRA FUNDAMENTAL: O lançamento só é gravado aqui com clique explícito!
  async function confirmarESalvar() {
    setErroSalvar('')
    const valor = parseValor(valorStr)

    if (!descricao.trim()) {
      setErroSalvar('Por favor informe o estabelecimento ou descrição.')
      return
    }
    if (valor <= 0) {
      setErroSalvar('Por favor informe um valor válido para a despesa.')
      return
    }
    if (formaPagamento === 'cartao' && !cartaoId) {
      setErroSalvar('Selecione um cartão de crédito.')
      return
    }
    if (formaPagamento === 'banco' && !bancoId) {
      setErroSalvar('Selecione uma conta bancária.')
      return
    }
    if (parcelado && totalParcelas < 2) {
      setErroSalvar('Parcelamento deve ter pelo menos 2 parcelas.')
      return
    }

    try {
      setSalvando(true)
      await adicionar.mutateAsync({
        tipo: 'despesa',
        descricao: descricao.trim(),
        valor,
        data,
        categoria_id: categoriaId || undefined,
        banco_id: formaPagamento === 'banco' ? (bancoId || undefined) : undefined,
        cartao_id: formaPagamento === 'cartao' ? (cartaoId || undefined) : undefined,
        parcelado: formaPagamento === 'cartao' ? parcelado : false,
        total_parcelas: formaPagamento === 'cartao' && parcelado ? totalParcelas : undefined,
        parcela_atual: formaPagamento === 'cartao' && parcelado ? 1 : undefined,
        recorrente: false,
        observacao: observacao.trim() || undefined,
        efetivado: formaPagamento === 'banco',
      })

      setEtapa('sucesso')
      setTimeout(() => {
        onClose()
      }, 1400)
    } catch (err: unknown) {
      setErroSalvar(err instanceof Error ? err.message : 'Erro ao gravar lançamento.')
    } finally {
      setSalvando(false)
    }
  }

  if (!open) return null

  const valorTotalNum = parseValor(valorStr)
  const valorParcelaPreview = parcelado && totalParcelas > 1 ? valorTotalNum / totalParcelas : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full sm:max-w-lg bg-[var(--bg-elevated)] border border-[var(--border)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-slide-up"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                Lançamento Inteligente por Voz
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] uppercase tracking-wide">
                  IA
                </span>
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Fale o que comprou, quanto gastou e onde gastou
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Modal de acordo com a etapa */}
        <div className="p-5 overflow-y-auto flex-1">

          {/* ── ETAPA 1: GRAVANDO ──────────────────────────────── */}
          {etapa === 'gravando' && (
            <div className="flex flex-col items-center text-center space-y-5 py-2">
              {/* Botão Microfone Animado */}
              <div className="relative flex items-center justify-center my-3">
                {/* Ondas pulsantes de áudio */}
                {ouvindo && (
                  <>
                    <div
                      className="absolute rounded-full pointer-events-none transition-all duration-100"
                      style={{
                        width: `${100 + volumeAudio * 1.2}px`,
                        height: `${100 + volumeAudio * 1.2}px`,
                        background: 'var(--primary)',
                        opacity: 0.15 + (volumeAudio / 100) * 0.25,
                      }}
                    />
                    <div
                      className="absolute rounded-full pointer-events-none transition-all duration-150 animate-ping"
                      style={{
                        width: '90px',
                        height: '90px',
                        background: 'var(--primary)',
                        opacity: 0.2,
                      }}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={ouvindo ? pararOuvir : iniciarOuvir}
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white relative z-10 transition-transform active:scale-95 shadow-xl"
                  style={{
                    background: ouvindo
                      ? 'linear-gradient(135deg, var(--danger), #ff4d6d)'
                      : 'linear-gradient(135deg, var(--primary), var(--accent))',
                    boxShadow: ouvindo ? '0 8px 32px rgba(255,107,122,0.45)' : 'var(--shadow-fab)',
                  }}
                  aria-label={ouvindo ? 'Parar microfone' : 'Ativar microfone'}
                >
                  {ouvindo ? <Mic size={38} className="animate-pulse" /> : <Mic size={38} />}
                </button>
              </div>

              {/* Status do Microfone */}
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {ouvindo ? 'Ouvindo... Pode falar!' : 'Clique no microfone para falar'}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                  Ex: "Gastei cinquenta e oito reais no supermercado no cartão Nubank"
                </p>
              </div>

              {/* Caixa de Transcrição ao Vivo */}
              <div
                className="w-full min-h-[90px] rounded-2xl p-4 text-left border border-[var(--border)] flex flex-col justify-between transition-all"
                style={{ background: 'var(--bg-muted)' }}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  <span>Fala reconhecida</span>
                  {ouvindo && (
                    <span className="flex items-center gap-1.5 text-[var(--success)] lowercase">
                      <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                      capturando
                    </span>
                  )}
                </div>

                <p className="text-sm text-[var(--text)] font-medium italic min-h-[40px]">
                  {transcricao || comandoManual ? (
                    `"${transcricao || comandoManual}"`
                  ) : (
                    <span className="text-[var(--text-subtle)] not-italic">
                      Sua fala aparecerá aqui em tempo real...
                    </span>
                  )}
                </p>

                {(transcricao || comandoManual) && (
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={limparTranscricao}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)]"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              {/* Aviso ou Erro de Permissão do Microfone */}
              {erroVoz && (
                <div className="w-full flex items-start gap-2.5 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-xs text-[var(--danger)] text-left">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{erroVoz}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Você pode usar a caixa de texto abaixo para digitar o comando normalmente.
                    </p>
                  </div>
                </div>
              )}

              {/* Fallback para digitação caso microfone indisponível */}
              <div className="w-full text-left pt-2">
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">
                  Ou digite o comando de despesa se preferir:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comandoManual}
                    onChange={e => setComandoManual(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handlePararEInterpretar()
                    }}
                    placeholder="Ex: 200 reais no cartão Inter parcelado em 2x na Decathlon"
                    className="flex-1 bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (comandoManual.trim()) processarComando(comandoManual)
                    }}
                    disabled={!comandoManual.trim()}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[var(--primary)] disabled:opacity-40 transition-all"
                  >
                    OK
                  </button>
                </div>
              </div>

              {/* Botão de Interpretar quando já há texto */}
              <button
                type="button"
                onClick={handlePararEInterpretar}
                disabled={!transcricao.trim() && !comandoManual.trim()}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  boxShadow: 'var(--shadow-fab)',
                }}
              >
                <Sparkles size={17} />
                Interpretar Despesa com IA
              </button>
            </div>
          )}

          {/* ── ETAPA 2: INTERPRETANDO COM IA ──────────────────── */}
          {etapa === 'interpretando' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center bg-[var(--primary-soft)] text-[var(--primary)] animate-pulse">
                <Sparkles size={32} className="animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Interpretando com Inteligência Artificial</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                  Identificando valor, estabelecimento, forma de pagamento, parcelamento e categoria adequada...
                </p>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: CONFIRMAÇÃO OBRIGATÓRIA ────────────────── */}
          {etapa === 'confirmando' && (
            <div className="space-y-4">
              {/* Regra Fundamental: Alerta de confirmação */}
              <div className="p-3.5 rounded-2xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-start gap-3">
                <Sparkles size={18} className="text-[var(--primary)] flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-[var(--primary)]">
                    Despesa identificada pela Inteligência Artificial
                  </p>
                  <p className="text-[var(--text-muted)] mt-0.5">
                    Revise os dados identificados abaixo. Nada será salvo sem a sua confirmação.
                  </p>
                </div>
              </div>

              {/* Comando Original Falado */}
              {dadosInterpretados?.textoOriginal && (
                <div className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border)] text-xs text-[var(--text-muted)] italic flex items-center justify-between">
                  <span className="truncate pr-2">"{dadosInterpretados.textoOriginal}"</span>
                  <button
                    type="button"
                    onClick={reiniciarGravacao}
                    className="text-[11px] font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 flex-shrink-0 not-italic"
                  >
                    <RefreshCw size={11} />
                    Falar de novo
                  </button>
                </div>
              )}

              {/* Avisos de informações que precisam de atenção */}
              {dadosInterpretados?.avisos && dadosInterpretados.avisos.length > 0 && (
                <div className="space-y-1.5">
                  {dadosInterpretados.avisos.map((aviso, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-xs text-[var(--warning)]"
                    >
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{aviso}</span>
                    </div>
                  ))}
                </div>
              )}

              {erroSalvar && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-xs text-[var(--danger)]">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{erroSalvar}</span>
                </div>
              )}

              {/* FORMULÁRIO DE EDIÇÃO DIRETA */}
              <div className="space-y-3.5 pt-1">
                {/* Valor Total */}
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">
                    Valor da Despesa (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-muted)]">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={valorStr}
                      onChange={e => setValorStr(formatarValorDigitacao(e.target.value))}
                      placeholder="0,00"
                      required
                      className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl pl-12 pr-4 py-3 text-lg font-bold font-mono text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                {/* Estabelecimento com Autocomplete */}
                <div className="relative">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">
                    Estabelecimento / Local *
                  </label>
                  <input
                    type="text"
                    value={descricao}
                    onChange={e => {
                      setDescricao(e.target.value)
                      setSugestoesAbertas(true)
                    }}
                    onFocus={() => setSugestoesAbertas(true)}
                    onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
                    placeholder="Ex: Sorveteria Firenze, Decathlon, Supermercado"
                    required
                    className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
                  />
                  {sugestoesAbertas && sugestoesEstabelecimento.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-[var(--border)]">
                      {sugestoesEstabelecimento.map(sug => (
                        <button
                          key={sug.chave}
                          type="button"
                          onMouseDown={() => {
                            setDescricao(sug.descricao)
                            if (sug.categorias[0]?.id) setCategoriaId(sug.categorias[0].id)
                            setSugestoesAbertas(false)
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs text-[var(--text)] hover:bg-[var(--bg-muted)] flex items-center justify-between"
                        >
                          <span className="font-medium">{sug.descricao}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Histórico</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Forma de Pagamento (Cartão vs Banco) */}
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormaPagamento('cartao')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                        formaPagamento === 'cartao'
                          ? 'bg-[#9D4EDD] text-white shadow-md'
                          : 'bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      <CreditCard size={15} />
                      Cartão de Crédito
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormaPagamento('banco')
                        setParcelado(false)
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                        formaPagamento === 'banco'
                          ? 'bg-[var(--primary)] text-white shadow-md'
                          : 'bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Landmark size={15} />
                      Conta Bancária / Pix
                    </button>
                  </div>
                </div>

                {/* Seleção do Cartão ou Banco */}
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">
                    {formaPagamento === 'cartao' ? 'Cartão Selecionado' : 'Conta Bancária Selecionada'}
                  </label>
                  {formaPagamento === 'cartao' ? (
                    <select
                      value={cartaoId}
                      onChange={e => setCartaoId(e.target.value)}
                      className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
                    >
                      {cartoes.length === 0 && <option value="">Nenhum cartão cadastrado</option>}
                      {cartoes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.banco ? `(${c.banco})` : ''} — Fecha dia {c.dia_fechamento}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={bancoId}
                      onChange={e => setBancoId(e.target.value)}
                      className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
                    >
                      {bancos.length === 0 && <option value="">Nenhuma conta cadastrada</option>}
                      {bancos.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.instituicao} — {b.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Categoria */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                      Categoria
                    </label>
                    {dadosInterpretados?.categoriaNome && (
                      <span className="text-[10px] text-[var(--primary)] font-medium">
                        Sugerida pela IA
                      </span>
                    )}
                  </div>
                  <select
                    value={categoriaId}
                    onChange={e => setCategoriaId(e.target.value)}
                    className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
                  >
                    <option value="">Selecione uma categoria...</option>
                    {categoriasArvore.map(pai => (
                      <optgroup key={pai.id} label={pai.nome}>
                        <option value={pai.id}>{pai.nome} (principal)</option>
                        {pai.subcategorias?.map(sub => (
                          <option key={sub.id} value={sub.id}>
                            ↳ {sub.nome}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1 block">
                    Data da Compra
                  </label>
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
                      Outra data
                    </button>
                  </div>
                  {chipData === 'outros' && (
                    <input
                      type="date"
                      value={data}
                      onChange={e => setData(e.target.value)}
                      className="w-full mt-2 bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                    />
                  )}
                </div>

                {/* Parcelamento (apenas se for cartão) */}
                {formaPagamento === 'cartao' && (
                  <div className="p-3.5 rounded-2xl bg-[var(--bg-muted)] border border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text)]">Compra Parcelada?</span>
                      <button
                        type="button"
                        onClick={() => setParcelado(v => !v)}
                        className={`w-11 h-6 rounded-full transition-colors relative ${
                          parcelado ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
                        }`}
                        aria-label="Alternar parcelamento"
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            parcelado ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {parcelado && (
                      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-1">
                            Número de Parcelas
                          </label>
                          <select
                            value={totalParcelas}
                            onChange={e => setTotalParcelas(Number(e.target.value))}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[var(--primary)]"
                          >
                            {Array.from({ length: 23 }, (_, i) => i + 2).map(n => (
                              <option key={n} value={n}>
                                {n}x
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block">
                            Valor por Parcela
                          </span>
                          <span className="text-sm font-bold font-mono text-[var(--text)]">
                            {formatBRL(valorParcelaPreview)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botões de Ação na Confirmação */}
              <div className="pt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={salvando}
                  className="py-3 px-4 rounded-2xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--bg-muted)] border border-[var(--border)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarESalvar}
                  disabled={salvando}
                  className="py-3 px-4 rounded-2xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-98"
                  style={{ background: 'var(--success)', boxShadow: '0 4px 16px rgba(0,224,150,0.35)' }}
                >
                  {salvando ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Confirmar e Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 4: SUCESSO ───────────────────────────────── */}
          {etapa === 'sucesso' && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl animate-bounce"
                style={{ background: 'var(--success)', boxShadow: '0 8px 32px rgba(0,224,150,0.45)' }}
              >
                <Check size={32} />
              </div>
              <h3 className="text-base font-bold text-[var(--text)]">Despesa Registrada com Sucesso!</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-xs font-medium">
                {descricao} • {formatBRL(parseValor(valorStr))}
                {parcelado ? ` (${totalParcelas}x)` : ''}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
