import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdicionarMeta } from '../hooks/useData'
import { Screen } from '../ui/Screen'
import { Button, Input } from '../ui/primitives'

export function NovaMetaPage() {
  const navigate = useNavigate()
  const adicionar = useAdicionarMeta()
  const [nome, setNome] = useState('')
  const [alvo, setAlvo] = useState('')
  const [prazo, setPrazo] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await adicionar.mutateAsync({
      nome,
      valor_alvo: parseFloat(alvo.replace(',', '.')),
      valor_atual: 0,
      prazo: prazo || undefined,
      cor: '#9D4EDD',
      icone: 'target',
      concluida: false,
    })
    navigate('/metas')
  }

  return (
    <Screen title="Nova meta" onBack>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome da meta" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Viagem" />
        <Input label="Valor alvo (R$)" inputMode="decimal" value={alvo} onChange={e => setAlvo(e.target.value)} required />
        <Input label="Prazo" type="month" value={prazo} onChange={e => setPrazo(e.target.value)} />
        <Button type="submit" className="w-full" loading={adicionar.isPending}>Criar meta</Button>
      </form>
    </Screen>
  )
}
