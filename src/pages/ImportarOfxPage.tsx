import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  CheckCircle2,
  Landmark,
  CreditCard,
  Eye,
  EyeOff,
  Clock,
  Layers,
} from 'lucide-react'
import {
  useBancos,
  useCartoes,
  useCategorias,
  useHistoricoDescricoes,
  useHistoricoImportacoesOfx,
  useImportarOfx,
  useLancamentosParaConciliacao,
  useVincularLancamentoOfx,
} from '../hooks/useData'
import { parseOfx, type ExtratoOfx } from '../lib/ofx'
import {
  conciliarExtratoOfx,
  type ResultadoConciliacao,
  type StatusConciliacao,
  filtrarConciliacoesVisiveis,
  calcularResumoConciliacao,
  isStatusImportadoOuDuplicado,
} from '../lib/conciliacaoOfx'
import {
  extrairDadosParcelamentoDescricao,
  calcularDatasCartao,
} from '../lib/parcelamentoOfx'
import { agruparHistoricoPorEstabelecimento, sugerirCategoriaPorDescricao } from '../lib/autocompleteEstabelecimentos'
import { formatBRL } from '../lib/utils'
import { Screen } from '../ui/Screen'
import { Card, Button, Badge } from '../ui/primitives'
import { TxIcon } from '../ui/finance'
import { HistoricoParcelamentoModal } from '../components/cartoes/HistoricoParcelamentoModal'

type Etapa = 'destino' | 'preview' | 'concluido'

export function ImportarOfxPage() {
  const navigate = useNavigate()
  const { data: bancos = [] } = useBancos()
  const { data: cartoes = [] } = useCartoes()
  const { data: categorias = [] } = useCategorias()
  const { data: historico = [] } = useHistoricoDescricoes()
  const { data: historicoImportacoes = [] } = useHistoricoImportacoesOfx()
  const importar = useImportarOfx()
  const vincular = useVincularLancamentoOfx()

  const [etapa, setEtapa] = useState<Etapa>('destino')
  const [destinoTipo, setDestinoTipo] = useState<'banco' | 'cartao'>('banco')
  const [destinoId, setDestinoId] = useState('')
  const [carregandoArquivo, setCarregandoArquivo] = useState(false)
  const [erro, setErro] = useState('')
  const [arquivoNome, setArquivoNome] = useState('')

  const [extrato, setExtrato] = useState<ExtratoOfx | null>(null)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [selecaoInicializada, setSelecaoInicializada] = useState(false)
  const [ocultarJaImportados, setOcultarJaImportados] = useState(false)

  // Mapeamentos por transação (FITID)
  const [categoriaPorFitid, setCategoriaPorFitid] = useState<Record<string, string>>({})
  const [observacaoPorFitid, setObservacaoPorFitid] = useState<Record<string, string>>({})
  const [descricaoPorFitid, setDescricaoPorFitid] = useState<Record<string, string>>({})

  // Datas diferenciadas (Data da compra x Data de cobrança na fatura)
  const [dataCompraPorFitid, setDataCompraPorFitid] = useState<Record<string, string>>({})
  const [dataVencimentoPorFitid, setDataVencimentoPorFitid] = useState<Record<string, string>>({})

  // Parcelamento
  const [parceladoPorFitid, setParceladoPorFitid] = useState<Record<string, boolean>>({})
  const [parcelaAtualPorFitid, setParcelaAtualPorFitid] = useState<Record<string, number>>({})
  const [totalParcelasPorFitid, setTotalParcelasPorFitid] = useState<Record<string, number>>({})
  const [gerarFuturasPorFitid, setGerarFuturasPorFitid] = useState<Record<string, boolean>>({})

  // Modal para ver histórico de parcelamento existente
  const [grupoModalId, setGrupoModalId] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ inseridos: number } | null>(null)

  const destino = destinoId ? { tipo: destinoTipo, id: destinoId } : null
  const { data: lancamentosConciliacao = [], isLoading: carregandoConciliacao } = useLancamentosParaConciliacao(destino)
  const conciliacoes = useMemo(
    () => extrato ? conciliarExtratoOfx(extrato.transacoes, lancamentosConciliacao) : [],
    [extrato, lancamentosConciliacao],
  )

  const resumo = useMemo(() => calcularResumoConciliacao(conciliacoes), [conciliacoes])

  const conciliacoesVisiveis = useMemo(
    () => filtrarConciliacoesVisiveis(conciliacoes, ocultarJaImportados),
    [conciliacoes, ocultarJaImportados],
  )

  const indiceDespesas = useMemo(() => agruparHistoricoPorEstabelecimento(historico, 'despesa'), [historico])
  const indiceReceitas = useMemo(() => agruparHistoricoPorEstabelecimento(historico, 'receita'), [historico])

  const cartaoSelecionado = cartoes.find(c => c.id === destinoId)

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro('')
    setCarregandoArquivo(true)
    try {
      // OFX brasileiro normalmente vem em ISO-8859-1/Windows-1252, não UTF-8 — sem isso,
      // acentos (ç, ã, á...) viram caracteres quebrados.
      const buffer = await file.arrayBuffer()
      const texto = new TextDecoder('iso-8859-1').decode(buffer)
      const resultadoParse = parseOfx(texto)

      if (resultadoParse.transacoes.length === 0) {
        setErro('Não encontrei nenhuma transação nesse arquivo. Confira se é mesmo um extrato OFX.')
        setCarregandoArquivo(false)
        return
      }

      // Sugere categoria automaticamente com base no histórico de lançamentos do usuário
      const sugestoes: Record<string, string> = {}
      const descricoesIniciais: Record<string, string> = {}
      const datasCompraIniciais: Record<string, string> = {}
      const datasVencimentoIniciais: Record<string, string> = {}
      const parceladosIniciais: Record<string, boolean> = {}
      const parcelaAtualIniciais: Record<string, number> = {}
      const totalParcelasIniciais: Record<string, number> = {}
      const gerarFuturasIniciais: Record<string, boolean> = {}

      for (const t of resultadoParse.transacoes) {
        const indice = t.tipo === 'despesa' ? indiceDespesas : indiceReceitas
        const cat = sugerirCategoriaPorDescricao(indice, t.descricao)
        if (cat) sugestoes[t.fitid] = cat.id

        // Identifica parcelamento e data da compra a partir da descrição e metadados
        const dadosParcela = extrairDadosParcelamentoDescricao(t.descricao)

        descricoesIniciais[t.fitid] = dadosParcela.descricaoBase || t.descricao

        // 1. Data original da compra:
        // Prefere DTUSER do OFX, ou data identificada na descrição (ex: 28/10), ou a data da transação
        const dataCompraOriginal = t.dataCompra || dadosParcela.dataCompraDetectada || t.data
        datasCompraIniciais[t.fitid] = dataCompraOriginal

        // 2. Data de cobrança / vencimento da fatura:
        if (destinoTipo === 'cartao' && cartaoSelecionado && cartaoSelecionado.dia_fechamento && cartaoSelecionado.dia_vencimento) {
          const datasCalculadas = calcularDatasCartao(
            dataCompraOriginal,
            cartaoSelecionado.dia_fechamento,
            cartaoSelecionado.dia_vencimento,
          )
          datasVencimentoIniciais[t.fitid] = datasCalculadas.dataVencimentoParcela
        } else {
          datasVencimentoIniciais[t.fitid] = t.data
        }

        // 3. Parcelamento
        if (dadosParcela.parcelado && dadosParcela.parcelaAtual && dadosParcela.totalParcelas) {
          parceladosIniciais[t.fitid] = true
          parcelaAtualIniciais[t.fitid] = dadosParcela.parcelaAtual
          totalParcelasIniciais[t.fitid] = dadosParcela.totalParcelas
        } else {
          parceladosIniciais[t.fitid] = false
          parcelaAtualIniciais[t.fitid] = 1
          totalParcelasIniciais[t.fitid] = 1
        }

        // Importante: gerar parcelas futuras vem DESMARCADO por padrão (requer confirmação explícita do usuário)
        gerarFuturasIniciais[t.fitid] = false
      }

      setExtrato(resultadoParse)
      setArquivoNome(file.name)
      setSelecionadas(new Set())
      setSelecaoInicializada(false)
      setOcultarJaImportados(false)
      setCategoriaPorFitid(sugestoes)
      setObservacaoPorFitid({})
      setDescricaoPorFitid(descricoesIniciais)
      setDataCompraPorFitid(datasCompraIniciais)
      setDataVencimentoPorFitid(datasVencimentoIniciais)
      setParceladoPorFitid(parceladosIniciais)
      setParcelaAtualPorFitid(parcelaAtualIniciais)
      setTotalParcelasPorFitid(totalParcelasIniciais)
      setGerarFuturasPorFitid(gerarFuturasIniciais)
      setEtapa('preview')
    } catch {
      setErro('Não consegui ler esse arquivo. Confira se ele não está corrompido.')
    } finally {
      setCarregandoArquivo(false)
      e.target.value = ''
    }
  }

  useEffect(() => {
    if (!extrato || carregandoConciliacao || conciliacoes.length === 0 || selecaoInicializada) return
    setSelecionadas(new Set(conciliacoes
      .filter(item => item.status === 'nao_lancado' || (item.candidato?.isParcelaCorrespondente && !item.candidato.lancamento.efetivado))
      .map(item => item.transacao.fitid)))
    setSelecaoInicializada(true)
  }, [conciliacoes, carregandoConciliacao, extrato, selecaoInicializada])

  function alternarSelecao(fitid: string) {
    const item = conciliacoes.find(c => c.transacao.fitid === fitid)
    if (item && isStatusImportadoOuDuplicado(item.status)) return

    setSelecionadas(prev => {
      const novo = new Set(prev)
      if (novo.has(fitid)) novo.delete(fitid)
      else novo.add(fitid)
      return novo
    })
  }

  function selecionarTodasNovas() {
    const permitidas = conciliacoes
      .filter(item => !isStatusImportadoOuDuplicado(item.status))
      .map(item => item.transacao.fitid)
    setSelecionadas(new Set(permitidas))
  }

  function desmarcarTodas() {
    setSelecionadas(new Set())
  }

  function handleDataCompraChange(fitid: string, novaDataCompra: string) {
    setDataCompraPorFitid(prev => ({ ...prev, [fitid]: novaDataCompra }))

    // Se for cartão, recalcula automaticamente a sugestão da data de vencimento da fatura
    if (destinoTipo === 'cartao' && cartaoSelecionado && cartaoSelecionado.dia_fechamento && cartaoSelecionado.dia_vencimento) {
      const datas = calcularDatasCartao(novaDataCompra, cartaoSelecionado.dia_fechamento, cartaoSelecionado.dia_vencimento)
      setDataVencimentoPorFitid(prev => ({ ...prev, [fitid]: datas.dataVencimentoParcela }))
    }
  }

  async function confirmarImportacao() {
    if (!extrato) return
    setErro('')

    // Mapeia transações selecionadas com dados refinados pelo usuário
    const transacoes = extrato.transacoes
      .filter(t => selecionadas.has(t.fitid))
      .map(t => {
        const itemConciliacao = conciliacoes.find(c => c.transacao.fitid === t.fitid)
        const isParcelaCorrespondente = itemConciliacao?.candidato?.isParcelaCorrespondente && !itemConciliacao.candidato.lancamento.efetivado

        const isParcelado = parceladoPorFitid[t.fitid] ?? false
        const parcelaAtual = parcelaAtualPorFitid[t.fitid] ?? 1
        const totalParcelas = totalParcelasPorFitid[t.fitid] ?? 1

        return {
          ...t,
          data: dataCompraPorFitid[t.fitid] || t.data, // Data da compra
          dataVencimentoParcela: dataVencimentoPorFitid[t.fitid], // Data de cobrança
          descricao: (descricaoPorFitid[t.fitid] ?? t.descricao).trim() || t.descricao,
          categoria_id: categoriaPorFitid[t.fitid],
          observacao: observacaoPorFitid[t.fitid]?.trim() || undefined,
          parcelado: isParcelado,
          parcelaAtual: isParcelado ? parcelaAtual : undefined,
          totalParcelas: isParcelado ? totalParcelas : undefined,
          gerarParcelasFuturas: isParcelado ? (gerarFuturasPorFitid[t.fitid] ?? false) : false,
          // Se encontrou uma parcela futura preexistente prevista, vincula o ID para atualizar em vez de duplicar
          atualizarLancamentoId: isParcelaCorrespondente ? itemConciliacao?.candidato?.lancamento.id : undefined,
          grupoParcelaId: isParcelaCorrespondente ? itemConciliacao?.candidato?.lancamento.grupo_parcela_id : undefined,
        }
      })

    try {
      const res = await importar.mutateAsync({
        transacoes,
        arquivoNome,
        origem: extrato.origem,
        conciliacoes: conciliacoes.map(item => ({
          fitid: item.transacao.fitid,
          data: item.transacao.data,
          valor: item.transacao.valor,
          tipo: item.transacao.tipo,
          descricao: (descricaoPorFitid[item.transacao.fitid] ?? item.transacao.descricao).trim() || item.transacao.descricao,
          score: item.score,
          status: item.status,
          lancamento_id: item.candidato?.lancamento.id,
        })),
        destino: {
          tipo: destinoTipo,
          id: destinoId,
          diaFechamento: cartaoSelecionado?.dia_fechamento,
          diaVencimento: cartaoSelecionado?.dia_vencimento,
        },
      })
      setResultado(res)
      setEtapa('concluido')
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : 'Erro ao importar os lançamentos. Verifique o banco de dados.')
      setErro(msg)
    }
  }

  async function vincularExistente(item: ResultadoConciliacao) {
    if (!item.candidato) return
    setErro('')
    try {
      await vincular.mutateAsync({ lancamentoId: item.candidato.lancamento.id, fitid: item.transacao.fitid })
      setErro('')
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não consegui vincular o lançamento')
    }
  }

  const categoriasDespesa = categorias.filter(c => c.tipo === 'despesa' || c.tipo === 'ambos')
  const categoriasReceita = categorias.filter(c => c.tipo === 'receita' || c.tipo === 'ambos')
  const totalSelecionado = extrato?.transacoes.filter(t => selecionadas.has(t.fitid)).reduce((a, t) => a + (t.tipo === 'despesa' ? -t.valor : t.valor), 0) ?? 0

  return (
    <Screen title="Importar extrato" subtitle="Arquivo OFX do seu banco ou cartão" onBack>
      {etapa === 'destino' && (
        <div className="space-y-4">
          <Card>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">1. Pra onde importar?</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button type="button" onClick={() => { setDestinoTipo('banco'); setDestinoId('') }}
                className={`py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  destinoTipo === 'banco' ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}>
                <Landmark size={15} /> Conta/Banco
              </button>
              <button type="button" onClick={() => { setDestinoTipo('cartao'); setDestinoId('') }}
                className={`py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  destinoTipo === 'cartao' ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}>
                <CreditCard size={15} /> Cartão de crédito
              </button>
            </div>

            {destinoTipo === 'banco' ? (
              bancos.length === 0 ? (
                <p className="text-xs text-[var(--danger)]">Cadastre um banco antes de importar.</p>
              ) : (
                <select value={destinoId} onChange={e => setDestinoId(e.target.value)}
                  className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]">
                  <option value="">Selecione o banco</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.instituicao} — {b.nome}</option>)}
                </select>
              )
            ) : (
              cartoes.length === 0 ? (
                <p className="text-xs text-[var(--danger)]">Cadastre um cartão antes de importar.</p>
              ) : (
                <select value={destinoId} onChange={e => setDestinoId(e.target.value)}
                  className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]">
                  <option value="">Selecione o cartão</option>
                  {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              )
            )}
          </Card>

          {destinoId && (
            <Card>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">2. Escolha o arquivo</p>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-10 cursor-pointer transition-colors ${
                carregandoArquivo ? 'border-[var(--border)] opacity-50 pointer-events-none' : 'border-[var(--border)] hover:border-[var(--primary)]'
              }`}>
                <Upload size={24} className="text-[var(--text-muted)]" />
                <span className="text-sm font-semibold text-[var(--text-muted)]">
                  {carregandoArquivo ? 'Lendo arquivo...' : 'Toque para escolher o arquivo .ofx'}
                </span>
                <input type="file" accept=".ofx,.qfx" className="hidden" onChange={handleArquivo} disabled={carregandoArquivo} />
              </label>
            </Card>
          )}

          {historicoImportacoes.length > 0 && (
            <Card>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Importações recentes</p>
              <div className="space-y-3">
                {historicoImportacoes.map(importacao => (
                  <div key={importacao.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold truncate">{importacao.arquivo_nome}</p>
                      <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                        {new Date(importacao.importado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      {importacao.banco?.instituicao ?? importacao.cartao?.nome ?? 'Destino não informado'} · {importacao.total_transacoes} transações · {importacao.total_nao_lancadas} novas
                    </p>
                    <p className="text-[10px] text-[var(--text-subtle)] mt-0.5">
                      {importacao.total_ja_lancadas} já lançadas · {importacao.total_possiveis} possíveis · {importacao.total_duplicidades} duplicidades · {importacao.total_ignoradas} ignoradas
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {erro && <p className="text-sm text-[var(--danger)] px-1">{erro}</p>}
        </div>
      )}

      {etapa === 'preview' && extrato && (
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <FileText className="text-[var(--primary)]" size={24} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{arquivoNome || 'Extrato OFX'}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {resumo.total} transações no arquivo · {selecionadas.size} selecionada{selecionadas.size !== 1 ? 's' : ''} para importar
                </p>
              </div>
            </div>

            {/* Badges de resumo e status */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)]">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-muted)] text-[var(--text)] font-semibold text-[11px]">
                Total: <span>{resumo.total}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold text-[11px]">
                Novas: <span>{resumo.naoLancados}</span>
              </span>
              {resumo.jaLancados > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 font-semibold text-[11px]">
                  Já lançadas: <span>{resumo.jaLancados}</span>
                </span>
              )}
              {resumo.duplicidades > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 font-semibold text-[11px]">
                  Duplicidades: <span>{resumo.duplicidades}</span>
                </span>
              )}
              {resumo.possiveis > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 font-semibold text-[11px]">
                  Possíveis: <span>{resumo.possiveis}</span>
                </span>
              )}
            </div>
          </Card>

          {/* Barra de controle de visualização e seleção rápida */}
          <Card padding="sm" className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-medium text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={ocultarJaImportados}
                  onChange={e => setOcultarJaImportados(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] accent-[var(--primary)] cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  {ocultarJaImportados ? (
                    <EyeOff size={15} className="text-[var(--primary)]" />
                  ) : (
                    <Eye size={15} className="text-[var(--text-muted)]" />
                  )}
                  Ocultar lançamentos já importados
                </span>
                {resumo.totalImportadosOuDuplicados > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)] font-mono font-semibold">
                    {resumo.totalImportadosOuDuplicados}
                  </span>
                )}
              </label>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={selecionarTodasNovas}
                  className="text-[11px] font-semibold text-[var(--primary)] hover:underline px-2 py-1 rounded transition-colors"
                >
                  Selecionar novas ({resumo.naoLancados})
                </button>
                <span className="text-[var(--border)]">|</span>
                <button
                  type="button"
                  onClick={desmarcarTodas}
                  className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] px-2 py-1 rounded transition-colors"
                >
                  Desmarcar todas
                </button>
              </div>
            </div>

            {ocultarJaImportados && resumo.totalImportadosOuDuplicados > 0 && (
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 pt-1 border-t border-[var(--border)]/50">
                <EyeOff size={12} className="text-[var(--primary)] flex-shrink-0" />
                Ocultando {resumo.totalImportadosOuDuplicados} lançamento{resumo.totalImportadosOuDuplicados > 1 ? 's' : ''} já processado{resumo.totalImportadosOuDuplicados > 1 ? 's' : ''} ou em duplicidade.
              </p>
            )}
          </Card>

          {carregandoConciliacao && (
            <p className="text-sm text-[var(--text-muted)] text-center py-2">
              Comparando com seus lançamentos...
            </p>
          )}

          {conciliacoesVisiveis.length === 0 ? (
            <Card className="text-center py-8 px-4 space-y-3">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
                <EyeOff size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text)]">Nenhum lançamento visível</p>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                  Todos os {resumo.total} lançamentos deste arquivo já foram identificados como já lançados ou duplicidades e estão ocultos pelo filtro ativo.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOcultarJaImportados(false)}>
                Exibir todos os lançamentos
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {conciliacoesVisiveis.map(item => (
                <LinhaTransacao
                  key={item.transacao.fitid}
                  conciliacao={item}
                  isCartao={destinoTipo === 'cartao'}
                  diaFechamento={cartaoSelecionado?.dia_fechamento}
                  diaVencimento={cartaoSelecionado?.dia_vencimento}
                  selecionada={selecionadas.has(item.transacao.fitid)}
                  descricao={descricaoPorFitid[item.transacao.fitid] ?? item.transacao.descricao}
                  categoriaId={categoriaPorFitid[item.transacao.fitid] ?? ''}
                  observacao={observacaoPorFitid[item.transacao.fitid] ?? ''}
                  dataCompra={dataCompraPorFitid[item.transacao.fitid] || item.transacao.data}
                  dataVencimento={dataVencimentoPorFitid[item.transacao.fitid] || item.transacao.data}
                  parcelado={parceladoPorFitid[item.transacao.fitid] ?? false}
                  parcelaAtual={parcelaAtualPorFitid[item.transacao.fitid] ?? 1}
                  totalParcelas={totalParcelasPorFitid[item.transacao.fitid] ?? 1}
                  gerarFuturas={gerarFuturasPorFitid[item.transacao.fitid] ?? false}
                  categorias={item.transacao.tipo === 'despesa' ? categoriasDespesa : categoriasReceita}
                  onToggle={() => alternarSelecao(item.transacao.fitid)}
                  onDescricaoChange={desc => setDescricaoPorFitid(prev => ({ ...prev, [item.transacao.fitid]: desc }))}
                  onCategoriaChange={catId => setCategoriaPorFitid(prev => ({ ...prev, [item.transacao.fitid]: catId }))}
                  onObservacaoChange={obs => setObservacaoPorFitid(prev => ({ ...prev, [item.transacao.fitid]: obs }))}
                  onDataCompraChange={dc => handleDataCompraChange(item.transacao.fitid, dc)}
                  onDataVencimentoChange={dv => setDataVencimentoPorFitid(prev => ({ ...prev, [item.transacao.fitid]: dv }))}
                  onParceladoChange={p => setParceladoPorFitid(prev => ({ ...prev, [item.transacao.fitid]: p }))}
                  onParcelaAtualChange={pa => setParcelaAtualPorFitid(prev => ({ ...prev, [item.transacao.fitid]: pa }))}
                  onTotalParcelasChange={tp => setTotalParcelasPorFitid(prev => ({ ...prev, [item.transacao.fitid]: tp }))}
                  onGerarFuturasChange={gf => setGerarFuturasPorFitid(prev => ({ ...prev, [item.transacao.fitid]: gf }))}
                  onAbrirHistoricoParcelamento={gid => setGrupoModalId(gid)}
                  onVincular={() => void vincularExistente(item)}
                />
              ))}
            </div>
          )}

          {erro && <p className="text-sm text-[var(--danger)] px-1">{erro}</p>}

          <div className="sticky bottom-4 pt-2">
            <Card className="flex items-center justify-between gap-3 shadow-lg">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Impacto líquido</p>
                <p className={`font-mono font-bold ${totalSelecionado >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {totalSelecionado >= 0 ? '+' : ''}{formatBRL(totalSelecionado)}
                </p>
              </div>
              <Button onClick={confirmarImportacao} loading={importar.isPending} disabled={selecionadas.size === 0}>
                Importar {selecionadas.size > 0 ? `(${selecionadas.size})` : ''}
              </Button>
            </Card>
          </div>
        </div>
      )}

      {etapa === 'concluido' && resultado && (
        <Card className="flex flex-col items-center text-center py-10 gap-3">
          <CheckCircle2 size={40} className="text-[var(--success)]" />
          <p className="font-bold text-lg">Importação concluída!</p>
          <p className="text-sm text-[var(--text-muted)]">{resultado.inseridos} lançamento{resultado.inseridos !== 1 ? 's' : ''} processado{resultado.inseridos !== 1 ? 's' : ''} com sucesso.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => { setEtapa('destino'); setExtrato(null); setArquivoNome(''); setDestinoId('') }}>Importar outro arquivo</Button>
            <Button onClick={() => navigate(destinoTipo === 'banco' ? '/bancos' : '/cartoes')}>Concluir</Button>
          </div>
        </Card>
      )}

      <HistoricoParcelamentoModal
        open={!!grupoModalId}
        onClose={() => setGrupoModalId(null)}
        grupoParcelaId={grupoModalId}
      />
    </Screen>
  )
}

function LinhaTransacao({
  conciliacao,
  isCartao,
  diaFechamento,
  diaVencimento,
  selecionada,
  descricao,
  categoriaId,
  observacao,
  dataCompra,
  dataVencimento,
  parcelado,
  parcelaAtual,
  totalParcelas,
  gerarFuturas,
  categorias,
  onToggle,
  onDescricaoChange,
  onCategoriaChange,
  onObservacaoChange,
  onDataCompraChange,
  onDataVencimentoChange,
  onParceladoChange,
  onParcelaAtualChange,
  onTotalParcelasChange,
  onGerarFuturasChange,
  onAbrirHistoricoParcelamento,
  onVincular,
}: {
  conciliacao: ResultadoConciliacao
  isCartao: boolean
  diaFechamento?: number
  diaVencimento?: number
  selecionada: boolean
  descricao: string
  categoriaId: string
  observacao: string
  dataCompra: string
  dataVencimento: string
  parcelado: boolean
  parcelaAtual: number
  totalParcelas: number
  gerarFuturas: boolean
  categorias: { id: string; nome: string; parent_id?: string }[]
  onToggle: () => void
  onDescricaoChange: (desc: string) => void
  onCategoriaChange: (id: string) => void
  onObservacaoChange: (obs: string) => void
  onDataCompraChange: (data: string) => void
  onDataVencimentoChange: (data: string) => void
  onParceladoChange: (parcelado: boolean) => void
  onParcelaAtualChange: (pa: number) => void
  onTotalParcelasChange: (tp: number) => void
  onGerarFuturasChange: (gf: boolean) => void
  onAbrirHistoricoParcelamento: (gid: string) => void
  onVincular: () => void
}) {
  const { transacao, candidato, status, score } = conciliacao
  const bloqueada = isStatusImportadoOuDuplicado(status)
  const isParcelaCorrespondente = candidato?.isParcelaCorrespondente && !candidato.lancamento.efetivado

  const statusConfig: Record<StatusConciliacao, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
    ja_lancado: { label: 'Já lançado', variant: 'success' },
    possivel: { label: isParcelaCorrespondente ? 'Parcela prevista identificada' : 'Possível correspondência', variant: isParcelaCorrespondente ? 'default' : 'warning' },
    nao_lancado: { label: 'Não lançado', variant: 'default' },
    duplicidade: { label: 'Possível duplicidade', variant: 'danger' },
  }
  const config = statusConfig[status]

  // Calcula o mês e ano de referência da cobrança (fatura)
  const mesAnoReferencia = useMemo(() => {
    if (!dataVencimento) return ''
    const [anoStr, mesStr] = dataVencimento.split('-')
    const mes = parseInt(mesStr, 10)
    const ano = parseInt(anoStr, 10)
    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `Fatura ${mesesAbrev[mes - 1] ?? mes}/${ano}`
  }, [dataVencimento])

  // Agrupa categorias em Pais e Filhas (Subcategorias)
  const categoriasAgrupadas = useMemo(() => {
    const pais = categorias.filter(c => !c.parent_id)
    const filhas = categorias.filter(c => !!c.parent_id)
    const res: { pai: (typeof categorias)[0]; subcategorias: typeof categorias }[] = []
    const agrupadas = new Set<string>()

    for (const p of pais) {
      const subs = filhas.filter(f => f.parent_id === p.id)
      subs.forEach(s => agrupadas.add(s.id))
      res.push({ pai: p, subcategorias: subs })
    }

    const orfas = filhas.filter(f => !agrupadas.has(f.id))
    return { comPai: res, orfas }
  }, [categorias])

  return (
    <Card padding="md" className={bloqueada ? 'border-[var(--border)] opacity-85' : undefined}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={bloqueada ? undefined : onToggle} disabled={bloqueada}
          aria-label={selecionada ? 'Remover da importação' : 'Incluir na importação'}
          className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            bloqueada ? 'border-[var(--border)] bg-[var(--bg-muted)] opacity-50 cursor-not-allowed' :
            selecionada ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'
          }`}>
          {selecionada && <CheckCircle2 size={14} className="text-white" />}
        </button>
        <TxIcon tipo={transacao.tipo} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold truncate text-[var(--text)]">{descricao || transacao.descricao}</p>
            <p className={`text-sm font-mono font-bold flex-shrink-0 ${transacao.tipo === 'receita' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {transacao.tipo === 'receita' ? '+' : '-'}{formatBRL(transacao.valor)}
            </p>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5 flex-wrap">
            <span>{new Date(`${dataCompra || transacao.data}T12:00:00`).toLocaleDateString('pt-BR')}</span>
            <Badge variant={config.variant}>{config.label} · {score} pts</Badge>
            {isCartao && mesAnoReferencia && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-muted)] font-semibold text-[var(--primary)]">
                {mesAnoReferencia}
              </span>
            )}
          </div>

          {/* Banner de Parcela Prévia Encontrada */}
          {isParcelaCorrespondente && candidato?.lancamento && (
            <div className="mb-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-400" />
                  Parcela prevista encontrada ({candidato.lancamento.parcela_atual}/{candidato.lancamento.total_parcelas})
                </span>
                {candidato.lancamento.grupo_parcela_id && (
                  <button
                    type="button"
                    onClick={() => onAbrirHistoricoParcelamento(candidato.lancamento.grupo_parcela_id!)}
                    className="text-[11px] underline font-semibold text-blue-300 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <Layers size={12} /> Ver histórico do parcelamento
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Essa parcela já havia sido planejada nas faturas. Ao importar, o sistema confirmará este registro existente sem criar duplicidade.
              </p>
            </div>
          )}

          {/* Candidato normal sem ser parcela correspondente */}
          {candidato && !isParcelaCorrespondente && (
            <div className="mb-2 rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
              Lançamento encontrado: <strong className="text-[var(--text)]">{candidato.lancamento.descricao}</strong>
              {candidato.diferencaDias > 0 && ` · ${candidato.diferencaDias} dia${candidato.diferencaDias > 1 ? 's' : ''} de diferença`}
              {(status === 'possivel' || status === 'duplicidade') && (
                <button type="button" onClick={onVincular} className="ml-2 text-[var(--primary)] font-semibold">Vincular</button>
              )}
            </div>
          )}

          {!bloqueada && (
            <div className="mt-2.5 space-y-2.5">
              {/* Diferenciação de Datas: Data da Compra e Data de Cobrança na Fatura */}
              {isCartao && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border)]">
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block mb-1">
                      Data da compra (original)
                    </label>
                    <input
                      type="date"
                      value={dataCompra}
                      onChange={e => onDataCompraChange(e.target.value)}
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block">
                        Data de cobrança (fatura)
                      </label>
                      {mesAnoReferencia && (
                        <span className="text-[9px] font-bold text-[var(--primary)] px-1.5 py-0.5 rounded bg-[var(--primary-soft)]">
                          {mesAnoReferencia}
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={dataVencimento}
                      onChange={e => onDataVencimentoChange(e.target.value)}
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
              )}

              {/* Seção de Compra Parcelada e Geração de Parcelas Futuras */}
              {isCartao && transacao.tipo === 'despesa' && (
                <div className="p-2.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={parcelado}
                        onChange={e => onParceladoChange(e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] accent-[var(--primary)] cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <CreditCard size={13} className="text-[var(--primary)]" />
                        Compra parcelada
                      </span>
                    </label>

                    {parcelado && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-[11px] text-[var(--text-muted)]">Parcela</span>
                        <input
                          type="number"
                          min={1}
                          max={totalParcelas}
                          value={parcelaAtual}
                          onChange={e => onParcelaAtualChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-12 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-0.5 text-xs text-center font-bold text-[var(--text)]"
                        />
                        <span className="text-[11px] text-[var(--text-muted)]">de</span>
                        <input
                          type="number"
                          min={2}
                          max={48}
                          value={totalParcelas}
                          onChange={e => onTotalParcelasChange(Math.max(2, parseInt(e.target.value, 10) || 2))}
                          className="w-12 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-0.5 text-xs text-center font-bold text-[var(--text)]"
                        />
                      </div>
                    )}
                  </div>

                  {parcelado && (
                    <div className="pt-2 border-t border-[var(--border)] space-y-2">
                      {parcelaAtual < totalParcelas ? (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-[var(--text)]">
                            <input
                              type="checkbox"
                              checked={gerarFuturas}
                              onChange={e => onGerarFuturasChange(e.target.checked)}
                              className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] accent-[var(--primary)] cursor-pointer"
                            />
                            <span>Gerar parcelas futuras automaticamente?</span>
                          </label>

                          {gerarFuturas ? (
                            <div className="p-2 rounded-lg bg-[var(--primary-soft)] text-[11px] text-[var(--primary)] space-y-1">
                              <p className="font-semibold flex items-center gap-1">
                                <Clock size={12} />
                                {totalParcelas - parcelaAtual} parcelas futuras restantes serão geradas
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                Parcelas {parcelaAtual + 1}/{totalParcelas} até {totalParcelas}/{totalParcelas} nos meses subsequentes com valor de {formatBRL(transacao.valor)} cada, respeitando os vencimentos de fatura.
                              </p>
                            </div>
                          ) : (
                            <p className="text-[10px] text-[var(--text-muted)]">
                              Marque para programar automaticamente as parcelas {parcelaAtual + 1}/{totalParcelas} a {totalParcelas}/{totalParcelas} nas próximas faturas.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-[var(--success)]" />
                          Última parcela ({totalParcelas}/{totalParcelas}) — não há parcelas futuras a gerar.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Descrição e Estabelecimento */}
              <div>
                <label className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block mb-1">
                  Estabelecimento / Descrição
                </label>
                <input
                  type="text"
                  value={descricao}
                  onChange={e => onDescricaoChange(e.target.value)}
                  placeholder="Nome fantasia do estabelecimento..."
                  className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
                />
              </div>

              {/* Categoria e Observação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoriaId}
                    onChange={e => onCategoriaChange(e.target.value)}
                    className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
                  >
                    <option value="">Sem categoria</option>
                    {categoriasAgrupadas.comPai.map(({ pai, subcategorias }) => (
                      <optgroup key={pai.id} label={pai.nome}>
                        <option value={pai.id}>{pai.nome} (Principal)</option>
                        {subcategorias.map(sub => (
                          <option key={sub.id} value={sub.id}>
                            &nbsp;&nbsp;↳ {sub.nome}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {categoriasAgrupadas.orfas.length > 0 && (
                      <optgroup label="Outras subcategorias">
                        {categoriasAgrupadas.orfas.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block mb-1">
                    Observação (opcional)
                  </label>
                  <input
                    type="text"
                    value={observacao}
                    onChange={e => onObservacaoChange(e.target.value)}
                    placeholder="Nota ou detalhe..."
                    className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] text-[var(--text)] placeholder:text-[var(--text-subtle)]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
