import {
  Landmark,
  Building2,
  Wallet,
  PiggyBank,
  TrendingUp,
  CreditCard,
  DollarSign,
  Coins,
  Vault,
  Receipt,
  Globe,
  Smartphone,
  Shield,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface IconOption {
  id: string
  label: string
  icon: LucideIcon
}

export const ICONES_BANCO: IconOption[] = [
  { id: 'landmark', label: 'Banco tradicional', icon: Landmark },
  { id: 'building', label: 'Instituição / Empresa', icon: Building2 },
  { id: 'wallet', label: 'Carteira / Dinheiro', icon: Wallet },
  { id: 'piggy', label: 'Poupança / Cofrinho', icon: PiggyBank },
  { id: 'trending', label: 'Investimentos', icon: TrendingUp },
  { id: 'credit-card', label: 'Cartão / Digital', icon: CreditCard },
  { id: 'dollar', label: 'Caixa / Moeda', icon: DollarSign },
  { id: 'coins', label: 'Moedas', icon: Coins },
  { id: 'vault', label: 'Cofre', icon: Vault },
  { id: 'receipt', label: 'Extrato / Pagamentos', icon: Receipt },
  { id: 'globe', label: 'Conta Internacional', icon: Globe },
  { id: 'smartphone', label: 'App / Account', icon: Smartphone },
  { id: 'shield', label: 'Reserva / Seguro', icon: Shield },
  { id: 'sparkles', label: 'Premium / VIP', icon: Sparkles },
]

export function getBankIcon(id?: string): LucideIcon {
  const found = ICONES_BANCO.find(i => i.id === id)
  return found ? found.icon : Landmark
}

export function BankIcon({
  icone,
  size = 20,
  className = '',
}: {
  icone?: string
  size?: number
  className?: string
}) {
  const IconComponent = getBankIcon(icone)
  return <IconComponent size={size} className={className} />
}
