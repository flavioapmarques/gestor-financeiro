import { useState } from 'react'
import { Screen } from '../ui/Screen'
import { Chip } from '../ui/primitives'
import { StateScreen, SkeletonList, EmptyState } from '../ui/feedback'
import { Button } from '../ui/primitives'

type Estado = 'loading' | 'skeleton' | 'empty' | 'success' | 'error' | 'offline'

export function EstadosDemoPage() {
  const [estado, setEstado] = useState<Estado>('loading')

  return (
    <Screen title="Estados do sistema" subtitle="Design system" onBack>
      <div className="flex flex-wrap gap-2 mb-6">
        {(['loading', 'skeleton', 'empty', 'success', 'error', 'offline'] as Estado[]).map(e => (
          <Chip key={e} active={estado === e} onClick={() => setEstado(e)}>{e}</Chip>
        ))}
      </div>

      {estado === 'loading' && <StateScreen type="loading" title="Carregando..." message="Buscando suas movimentações" />}
      {estado === 'skeleton' && <SkeletonList rows={6} />}
      {estado === 'empty' && <EmptyState variant="transacoes" title="Sem movimentações" description="Quando você registrar despesas, elas aparecerão aqui." action={<Button>Adicionar</Button>} />}
      {estado === 'success' && <StateScreen type="success" title="Salvo com sucesso!" message="Lançamento registrado." />}
      {estado === 'error' && <StateScreen type="error" title="Algo deu errado" message="Não foi possível conectar ao servidor." onRetry={() => setEstado('loading')} />}
      {estado === 'offline' && <StateScreen type="offline" title="Sem internet" message="Verifique sua conexão e tente novamente." onRetry={() => setEstado('loading')} />}
    </Screen>
  )
}
