import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input } from '../../ui/primitives'
import { supabase } from '../../lib/supabase'

export function CadastroPage() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [termos, setTermos] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== confirmar) { setErro('As senhas não coincidem'); return }
    if (!termos) { setErro('Aceite os termos para continuar'); return }
    setLoading(true)
    setErro('')
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { full_name: nome, cpf } },
      })
      if (error) throw error
      navigate('/auth', { replace: true, state: { msg: 'Verifique seu e-mail para confirmar o cadastro.' } })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar'
      setErro(msg.includes('Database error') ? 'Erro no banco. Execute supabase/fix-signup.sql no Supabase.' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-8 max-w-lg mx-auto overflow-y-auto">
      <Link to="/auth" className="text-sm text-[var(--primary)] font-medium mb-6 inline-block">← Voltar</Link>
      <h1 className="text-2xl font-bold mb-1">Criar conta</h1>
      <p className="text-[var(--text-muted)] text-sm mb-6">Comece seu controle financeiro</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome completo" value={nome} onChange={e => setNome(e.target.value)} required />
        <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input label="CPF" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} />
        <Input label="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={6} />
        <Input label="Confirmar senha" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} required />
        <label className="flex items-start gap-3 text-sm text-[var(--text-muted)] cursor-pointer">
          <input type="checkbox" checked={termos} onChange={e => setTermos(e.target.checked)} className="mt-1 accent-[var(--primary)]" />
          <span>Li e aceito os <span className="text-[var(--primary)]">Termos de Uso</span> e <span className="text-[var(--primary)]">Política de Privacidade</span></span>
        </label>
        {erro && <p className="text-xs text-[var(--danger)]" role="alert">{erro}</p>}
        <Button type="submit" className="w-full" size="lg" loading={loading}>Criar conta</Button>
      </form>
    </div>
  )
}
