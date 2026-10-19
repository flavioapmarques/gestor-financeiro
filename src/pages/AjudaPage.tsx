import { useState } from 'react'
import { MessageCircle, HelpCircle, BookOpen, ChevronDown } from 'lucide-react'
import { Screen } from '../ui/Screen'
import { Card, Button } from '../ui/primitives'

const faq = [
  { q: 'Como adicionar um cartão?', a: 'Vá em Cartões e toque no botão + para cadastrar limite, fechamento e vencimento.' },
  { q: 'Como parcelar uma compra?', a: 'Ao adicionar despesa, ative Parcelado e informe o número de parcelas.' },
  { q: 'Meus dados são seguros?', a: 'Sim. Usamos criptografia e isolamento por usuário (RLS) no banco de dados.' },
]

export function AjudaPage() {
  const [aberto, setAberto] = useState<number | null>(0)

  return (
    <Screen title="Ajuda e suporte" onBack>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card interactive className="text-center !p-4">
          <MessageCircle size={24} className="mx-auto text-[var(--primary)] mb-2" />
          <p className="text-sm font-medium">Chat</p>
        </Card>
        <Card interactive className="text-center !p-4">
          <HelpCircle size={24} className="mx-auto text-[var(--primary)] mb-2" />
          <p className="text-sm font-medium">Abrir chamado</p>
        </Card>
      </div>

      <Card className="mb-4 flex items-center gap-3">
        <BookOpen size={20} className="text-[var(--primary)]" />
        <div>
          <p className="font-medium text-sm">Tutoriais</p>
          <p className="text-xs text-[var(--text-muted)]">Aprenda a usar o app</p>
        </div>
      </Card>

      <h3 className="text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">FAQ</h3>
      <div className="space-y-2">
        {faq.map((f, i) => (
          <Card key={i} padding="none">
            <button type="button" className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setAberto(aberto === i ? null : i)}>
              <span className="text-sm font-medium pr-2">{f.q}</span>
              <ChevronDown size={16} className={`shrink-0 transition-transform ${aberto === i ? 'rotate-180' : ''}`} />
            </button>
            {aberto === i && <p className="px-4 pb-3 text-sm text-[var(--text-muted)]">{f.a}</p>}
          </Card>
        ))}
      </div>
      <Button variant="outline" className="w-full mt-6">Falar com suporte</Button>
    </Screen>
  )
}
