import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle2, Landmark, CreditCard } from 'lucide-react'
import { useBancos, useCartoes, useCategorias, useHistoricoDescricoes, useHistoricoImportacoesOfx, useImportarOfx, useLancamentosParaConciliacao, useVincularLancamentoOfx } from '../hooks/useData'
import { parseOfx, type ExtratoOfx } from '../lib/ofx'
import { conciliarExtratoOfx, type ResultadoConciliacao, type StatusConciliacao } from '../lib/conciliacaoOfx'
import { agruparHistoricoPorEstabelecimento, sugerirCategoriaPorDescricao } from '../lib/autocompleteEstabelecimentos'
import { formatBRL } from '../lib/utils'
import { Screen } from '../ui/Screen'
import { Card, Button, Badge } from '../ui/primitives'
import { TxIcon } from '../ui/finance'

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
  const [categoriaPorFitid, setCategoriaPorFitid] = useState<Record<string, string>>({})
  const [observacaoPorFitid, setObservacaoPorFitid] = useState<Record<string, string>>({})
  const [descricaoPorFitid, setDescricaoPorFitid] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<{ inseridos: number } | null>(null)

  const destino = destinoId ? { tipo: destinoTipo, id: destinoId } : null
  const { data: lancamentosConciliacao = [], isLoading: carregandoConciliacao } = useLancamentosParaConciliacao(destino)
  const conciliacoes = useMemo(
    () => extrato ? conciliarExtratoOfx(extrato.transacoes, lancamentosConciliacao) : [],
    [extrato, lancamentosConciliacao],
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
      for (const t of resultadoParse.transacoes) {
        const indice = t.tipo === 'despesa' ? indiceDespesas : indiceReceitas
        const cat = sugerirCategoriaPorDescricao(indice, t.descricao)
        if (cat) sugestoes[t.fitid] = cat.id
        descricoesIniciais[t.fitid] = t.descricao
      }

      setExtrato(resultadoParse)
      setArquivoNome(file.name)
      setSelecionadas(new Set())
      setSelecaoInicializada(false)
      setCategoriaPorFitid(sugestoes)
      setObservacaoPorFitid({})
      setDescricaoPorFitid(descricoesIniciais)
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
      .filter(item => item.status === 'nao_lancado')
      .map(item => item.transacao.fitid)))
    setSelecaoInicializada(true)
  }, [conciliacoes, carregandoConciliacao, extrato, selecaoInicializada])

  function alternarSelecao(fitid: string) {
    setSelecionadas(prev => {
      const novo = new Set(prev)
      if (novo.has(fitid)) novo.delete(fitid)
      else novo.add(fitid)
      return novo
    })
  }

  async function confirmarImportacao() {
    if (!extrato) return
    setErro('')
    const transacoes = extrato.transacoes
      .filter(t => selecionadas.has(t.fitid))
      .map(t => ({
        ...t,
        descricao: (descricaoPorFitid[t.fitid] ?? t.descricao).trim() || t.descricao,
        categoria_id: categoriaPorFitid[t.fitid],
        observacao: observacaoPorFitid[t.fitid]?.trim() || undefined,
      }))
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
          <Card className="flex items-center gap-3">
            <FileText className="text-[var(--primary)]" size={22} />
            <div>
              <p className="text-sm font-semibold">{extrato.transacoes.length} transações encontradas</p>
              <p className="text-xs text-[var(--text-muted)]">
                {selecionadas.size} selecionadas
                {conciliacoes.filter(item => item.status === 'ja_lancado').length > 0 && ` · ${conciliacoes.filter(item => item.status === 'ja_lancado').length} já lançadas`}
              </p>
            </div>
          </Card>

          {carregandoConciliacao && <p className="text-sm text-[var(--text-muted)] text-center">Comparando com seus lançamentos...</p>}

          <div className="space-y-2">
            {conciliacoes.map(item => (
              <LinhaTransacao
                key={item.transacao.fitid}
                conciliacao={item}
                selecionada={selecionadas.has(item.transacao.fitid)}
                descricao={descricaoPorFitid[item.transacao.fitid] ?? item.transacao.descricao}
                categoriaId={categoriaPorFitid[item.transacao.fitid] ?? ''}
                observacao={observacaoPorFitid[item.transacao.fitid] ?? ''}
                categorias={item.transacao.tipo === 'despesa' ? categoriasDespesa : categoriasReceita}
                onToggle={() => alternarSelecao(item.transacao.fitid)}
                onDescricaoChange={desc => setDescricaoPorFitid(prev => ({ ...prev, [item.transacao.fitid]: desc }))}
                onCategoriaChange={catId => setCategoriaPorFitid(prev => ({ ...prev, [item.transacao.fitid]: catId }))}
                onObservacaoChange={obs => setObservacaoPorFitid(prev => ({ ...prev, [item.transacao.fitid]: obs }))}
                onVincular={() => void vincularExistente(item)}
              />
            ))}
          </div>

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
          <p className="text-sm text-[var(--text-muted)]">{resultado.inseridos} lançamento{resultado.inseridos !== 1 ? 's' : ''} adicionado{resultado.inseridos !== 1 ? 's' : ''} com sucesso.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => { setEtapa('destino'); setExtrato(null); setArquivoNome(''); setDestinoId('') }}>Importar outro arquivo</Button>
            <Button onClick={() => navigate(destinoTipo === 'banco' ? '/bancos' : '/cartoes')}>Concluir</Button>
          </div>
        </Card>
      )}
    </Screen>
  )
}

function LinhaTransacao({
  conciliacao, selecionada, descricao, categoriaId, observacao, categorias, onToggle, onDescricaoChange, onCategoriaChange, onObservacaoChange, onVincular,
}: {
  conciliacao: ResultadoConciliacao
  selecionada: boolean
  descricao: string
  categoriaId: string
  observacao: string
  categorias: { id: string; nome: string; parent_id?: string }[]
  onToggle: () => void
  onDescricaoChange: (desc: string) => void
  onCategoriaChange: (id: string) => void
  onObservacaoChange: (obs: string) => void
  onVincular: () => void
}) {
  const { transacao, candidato, status, score } = conciliacao
  const bloqueada = status === 'ja_lancado' || status === 'duplicidade'
  const statusConfig: Record<StatusConciliacao, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
    ja_lancado: { label: 'Já lançado', variant: 'success' },
    possivel: { label: 'Possível correspondência', variant: 'warning' },
    nao_lancado: { label: 'Não lançado', variant: 'default' },
    duplicidade: { label: 'Possível duplicidade', variant: 'danger' },
  }
  const config = statusConfig[status]

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
    <Card padding="md" className={bloqueada ? 'border-[var(--border)]' : undefined}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={bloqueada ? undefined : onToggle} disabled={bloqueada}
          aria-label={selecionada ? 'Remover da importação' : 'Incluir na importação'}
          className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
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
          <p className="text-[11px] text-[var(--text-muted)] mb-1.5">
            {new Date(`${transacao.data}T12:00:00`).toLocaleDateString('pt-BR')}
            <Badge variant={config.variant}>{config.label} · {score} pts</Badge>
          </p>

          {candidato && (
            <div className="mb-2 rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
              Lançamento encontrado: <strong className="text-[var(--text)]">{candidato.lancamento.descricao}</strong>
              {candidato.diferencaDias > 0 && ` · ${candidato.diferencaDias} dia${candidato.diferencaDias > 1 ? 's' : ''} de diferença`}
              {(status === 'possivel' || status === 'duplicidade') && (
                <button type="button" onClick={onVincular} className="ml-2 text-[var(--primary)] font-semibold">Vincular</button>
              )}
            </div>
          )}

          {!bloqueada && (
            <div className="mt-2.5 space-y-2">
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


