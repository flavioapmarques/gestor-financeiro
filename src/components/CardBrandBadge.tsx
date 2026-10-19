import type { Bandeira } from '../lib/supabase'

export const LISTA_BANDEIRAS: { id: Bandeira; label: string }[] = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'MasterCard' },
  { id: 'elo', label: 'Elo' },
  { id: 'amex', label: 'American Express' },
  { id: 'hipercard', label: 'Hipercard' },
  { id: 'diners', label: 'Diners Club' },
  { id: 'discover', label: 'Discover' },
  { id: 'jcb', label: 'JCB' },
  { id: 'alelo', label: 'Alelo (Benefício)' },
  { id: 'sodexo', label: 'Sodexo (Pluxee)' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'caju', label: 'Caju' },
  { id: 'vr', label: 'VR Benefícios' },
  { id: 'outro', label: 'Outra / Geral' },
]

export function CardBrandBadge({
  bandeira,
  size = 'md',
  showLabel = false,
}: {
  bandeira: Bandeira | string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}) {
  const b = (bandeira || 'outro').toLowerCase() as Bandeira

  const sizeClasses = {
    sm: 'h-5 px-2 text-[9px]',
    md: 'h-7 px-2.5 text-xs',
    lg: 'h-9 px-3.5 text-sm',
  }

  // Visual customizado para cada bandeira
  if (b === 'mastercard') {
    return (
      <div
        className={`inline-flex items-center gap-1 font-extrabold bg-black/40 backdrop-blur-md text-white rounded-lg ${sizeClasses[size]}`}
        title="MasterCard"
      >
        <div className="flex -space-x-1.5 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#EB001B]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#F79E1B] opacity-90" />
        </div>
        <span className="tracking-tight italic font-mono text-[10px]">mastercard</span>
      </div>
    )
  }

  if (b === 'visa') {
    return (
      <div
        className={`inline-flex items-center font-black tracking-wider bg-gradient-to-r from-[#1A1F71] to-[#0057B8] text-white rounded-lg shadow-sm border border-white/20 ${sizeClasses[size]}`}
        title="Visa"
      >
        <span className="italic font-serif font-bold tracking-widest text-[#F7B600]">VISA</span>
      </div>
    )
  }

  if (b === 'elo') {
    return (
      <div
        className={`inline-flex items-center gap-1 font-bold bg-[#000000] text-white rounded-lg border border-white/10 ${sizeClasses[size]}`}
        title="Elo"
      >
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#0099FF]" />
        </div>
        <span className="tracking-wider uppercase text-[10px] text-[#0099FF]">elo</span>
      </div>
    )
  }

  if (b === 'amex') {
    return (
      <div
        className={`inline-flex items-center font-extrabold bg-[#006FCF] text-white uppercase tracking-tighter rounded-lg ${sizeClasses[size]}`}
        title="American Express"
      >
        <span>AMEX</span>
      </div>
    )
  }

  if (b === 'hipercard') {
    return (
      <div
        className={`inline-flex items-center font-bold bg-[#B31919] text-white uppercase tracking-tight rounded-lg ${sizeClasses[size]}`}
        title="Hipercard"
      >
        <span>HIPERCARD</span>
      </div>
    )
  }

  if (b === 'diners') {
    return (
      <div
        className={`inline-flex items-center font-bold bg-[#004B87] text-white rounded-lg ${sizeClasses[size]}`}
        title="Diners Club"
      >
        <span className="tracking-tight">Diners Club</span>
      </div>
    )
  }

  if (b === 'discover') {
    return (
      <div
        className={`inline-flex items-center gap-1 font-bold bg-[#1C252C] text-white rounded-lg ${sizeClasses[size]}`}
        title="Discover"
      >
        <span>DISCOVER</span>
        <div className="w-2 h-2 rounded-full bg-[#FF6000]" />
      </div>
    )
  }

  if (b === 'jcb') {
    return (
      <div
        className={`inline-flex items-center font-black bg-[#003B82] text-white rounded-lg tracking-widest ${sizeClasses[size]}`}
        title="JCB"
      >
        <span className="text-[#0057B8]">J</span>
        <span className="text-[#E60012]">C</span>
        <span className="text-[#009944]">B</span>
      </div>
    )
  }

  if (b === 'alelo') {
    return (
      <div
        className={`inline-flex items-center font-bold bg-[#006837] text-white rounded-lg ${sizeClasses[size]}`}
        title="Alelo"
      >
        <span>alelo</span>
      </div>
    )
  }

  if (b === 'sodexo') {
    return (
      <div
        className={`inline-flex items-center font-bold bg-[#E2001A] text-white rounded-lg ${sizeClasses[size]}`}
        title="Sodexo"
      >
        <span>sodexo</span>
      </div>
    )
  }

  if (b === 'ticket') {
    return (
      <div
        className={`inline-flex items-center font-extrabold bg-[#E2001A] text-white rounded-lg ${sizeClasses[size]}`}
        title="Ticket"
      >
        <span>Ticket</span>
      </div>
    )
  }

  if (b === 'caju') {
    return (
      <div
        className={`inline-flex items-center font-bold bg-[#FF5000] text-white rounded-lg ${sizeClasses[size]}`}
        title="Caju"
      >
        <span>caju</span>
      </div>
    )
  }

  if (b === 'vr') {
    return (
      <div
        className={`inline-flex items-center font-extrabold bg-[#00A859] text-white rounded-lg ${sizeClasses[size]}`}
        title="VR Benefícios"
      >
        <span>VR</span>
      </div>
    )
  }

  // Fallback padrão
  const item = LISTA_BANDEIRAS.find(x => x.id === b)
  return (
    <div
      className={`inline-flex items-center font-bold bg-white/15 backdrop-blur-md text-white uppercase rounded-lg ${sizeClasses[size]}`}
      title={item?.label || bandeira}
    >
      <span>{showLabel ? item?.label || bandeira : bandeira}</span>
    </div>
  )
}
