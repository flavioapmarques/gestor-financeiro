import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Fingerprint, Chrome } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button, Input } from '../../ui/primitives'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col px-6 py-10 max-w-lg mx-auto">
      <div className="mb-10">
        <div className="w-14 h-14 rounded-2xl bg-[var(--primary-soft)] flex items-center justify-center mb-4">
          <span className="text-2xl">💳</span>
        </div>
        <h1 className="text-2xl font-bold">Bem-vindo de volta</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Entre para gerenciar suas finanças</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1">
        <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <Input label="Senha" type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" />
        <Link to="/auth/recuperar" className="text-xs text-[var(--primary)] font-medium block text-right">Esqueci minha senha</Link>
        {erro && <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 rounded-lg" role="alert">{erro}</p>}
        <Button type="submit" className="w-full" size="lg" loading={loading}>Entrar</Button>
      </form>

      <div className="space-y-3 mt-6">
        <Button variant="outline" className="w-full" type="button" onClick={() => setErro('Login com Google em breve')}>
          <Chrome size={18} /> Continuar com Google
        </Button>
        <Button variant="secondary" className="w-full" type="button" onClick={() => setErro('Biometria em breve')}>
          <Fingerprint size={18} /> Face ID / Biometria
        </Button>
      </div>

      <p className="text-center text-sm text-[var(--text-muted)] mt-8">
        Não tem conta?{' '}
        <Link to="/auth/cadastro" className="text-[var(--primary)] font-semibold">Cadastre-se</Link>
      </p>
    </div>
  )
}
