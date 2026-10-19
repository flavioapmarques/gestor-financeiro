export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Mesma formatação, mas mascarada quando o usuário ativa "ocultar valores". */
export function formatBRLOuOculto(valor: number, oculto: boolean): string {
  return oculto ? 'R$ ••••••' : formatBRL(valor)
}

export function nomeMes(mes: number, ano: number): string {
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function primeiroDiaMes(mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-01`
}

export function ultimoDiaMes(mes: number, ano: number): string {
  const ultimo = new Date(ano, mes, 0).getDate()
  return `${ano}-${String(mes).padStart(2, '0')}-${ultimo}`
}

export function proximoMes(mes: number, ano: number): { mes: number; ano: number } {
  if (mes === 12) return { mes: 1, ano: ano + 1 }
  return { mes: mes + 1, ano }
}

export function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  if (mes === 1) return { mes: 12, ano: ano - 1 }
  return { mes: mes - 1, ano }
}

/**
 * Subtrai N meses de um mês/ano usando aritmética pura de inteiros — nunca usa
 * Date.setMonth(), que "estoura" pra frente quando o dia atual (29, 30 ou 31) não
 * existe no mês de destino (ex.: 31 de janeiro − 1 mês viraria março, não fevereiro).
 * Isso já causou meses duplicados/pulados no gráfico de evolução mensal.
 */
export function subtrairMeses(ano: number, mes: number, n: number): { ano: number; mes: number } {
  const totalMeses = ano * 12 + (mes - 1) - n
  const novoAno = Math.floor(totalMeses / 12)
  const novoMes = (((totalMeses % 12) + 12) % 12) + 1
  return { ano: novoAno, mes: novoMes }
}

export function corCategoria(cor?: string): string {
  return cor ?? '#6C8EF5'
}
