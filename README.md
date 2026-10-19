# 💰 Gestor Financeiro — PWA

App de gestão financeira pessoal com React + Supabase. Roda no celular como PWA (sem precisar de loja de apps).

---

## ✅ PASSO A PASSO COMPLETO

### ETAPA 1 — Instalar ferramentas

1. Instale o **Node.js 20+**: https://nodejs.org
2. Instale o **Antigravity**: https://antigravity.google/download
3. Instale o **Git**: https://git-scm.com (se ainda não tiver)

---

### ETAPA 2 — Configurar o Supabase

Você já tem uma conta Supabase — basta criar um **novo projeto** para o gestor:

1. Acesse https://supabase.com/dashboard
2. Clique em **"New project"**
3. Preencha:
   - Name: `gestor-financeiro`
   - Password: crie uma senha forte (guarde em lugar seguro)
   - Region: **South America (São Paulo)**
4. Aguarde ~2 minutos para o projeto subir
5. Vá em **Settings → API** e copie:
   - **Project URL** (ex: `https://abcxyz.supabase.co`)
   - **anon / public key** (a chave longa que começa com `eyJ...`)

> **Posso usar meu projeto existente?**
> Sim! O schema foi projetado para não conflitar. As tabelas têm nomes descritivos (`contas`, `categorias`, `lancamentos` etc.) e todas têm RLS — cada usuário só vê seus próprios dados.

#### Criar as tabelas

1. No painel do Supabase, vá em **SQL Editor**
2. Clique em **"New query"**
3. Cole todo o conteúdo do arquivo **`supabase/schema-novo.sql`** (banco novo, recomendado) ou `setup-completo.sql` (versão antiga)
4. Clique em **"Run"** (botão verde ou Ctrl+Enter)
5. Deve aparecer mensagem de sucesso sem erros

Guia detalhado: **`supabase/LEIA-ME.md`**

---

### ETAPA 3 — Abrir o projeto no Antigravity

1. Abra o **Antigravity**
2. **File → Open Folder** → selecione a pasta `gestor-financeiro`
3. O Antigravity vai detectar o `package.json` automaticamente

#### Instalar dependências

No terminal integrado do Antigravity (botão Terminal na barra lateral ou `Ctrl+\``):

```bash
npm install
```

Aguarde baixar todos os pacotes (~1-2 minutos).

#### Configurar variáveis de ambiente

1. Na raiz do projeto, copie o arquivo de exemplo:
```bash
cp .env.example .env.local
```

2. Abra o `.env.local` e cole suas chaves do Supabase:
```
VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...sua_chave_aqui
```

> ⚠️ NUNCA suba o `.env.local` para o Git. Ele já está no `.gitignore`.

---

### ETAPA 4 — Rodar o projeto

```bash
npm run dev
```

Abra no navegador: **http://localhost:5173**

Você deve ver a tela de login. Crie uma conta e explore!

---

### ETAPA 5 — Usar o Antigravity para desenvolver

O Antigravity é onde você vai pedir ao agente de IA para construir as telas restantes.

#### Configurar o modelo (recomendado: Claude)

1. Abra o Antigravity
2. Clique no seletor de modelo (canto inferior esquerdo)
3. Escolha **Claude Sonnet 4.6** ou **Claude Opus 4.6**
   - Sonnet: mais rápido, ótimo para a maioria das tarefas
   - Opus: mais poderoso, para telas complexas

#### Exemplos de prompts para o agente

Abra o painel do Agente (`Ctrl+Shift+A`) e cole prompts como:

```
Implemente a página de Lançamentos (src/pages/Lancamentos.tsx).
Ela deve:
- Mostrar lista agrupada por data
- Ter filtros por tipo (receita/despesa/parcelado/recorrente)
- Ter um botão FAB para abrir modal de novo lançamento
- O modal deve suportar parcelamento (campo total de parcelas)
- Usar o hook useLancamentos() e useAdicionarLancamento() já existentes
- Seguir a paleta de cores do projeto (dark mode, azul #6C8EF5)
```

```
Crie o componente FormLancamento em src/components/lancamentos/FormLancamento.tsx.
É um modal bottom-sheet com campos:
- Tipo (receita/despesa/transferência) — toggles no topo
- Descrição (text input)
- Valor (número com máscara R$)
- Data (date picker)
- Categoria (select carregado de useCategorias())
- Conta ou Cartão (select)
- Toggle "Parcelado" que mostra campo "Número de parcelas"
- Toggle "Recorrente" que mostra select de frequência
```

#### O config.yaml do Antigravity

O arquivo `.antigravity/config.yaml` já está configurado com:
- Stack tecnológica completa
- Padrões de código do projeto
- Lista de tarefas sugeridas

O agente vai ler esse arquivo automaticamente e entender o contexto do seu projeto sem você precisar explicar tudo em cada prompt.

---

### ETAPA 6 — Testar no celular (PWA)

#### Opção A — Rede local (mais rápido para teste)

1. Descubra seu IP local:
   - Windows: `ipconfig` no terminal
   - Mac/Linux: `ifconfig` ou `ip addr`
2. No `vite.config.ts`, já está configurado para aceitar conexões externas
3. Acesse no celular: `http://SEU_IP:5173`
4. No Chrome/Safari, use **"Adicionar à tela inicial"**

#### Opção B — Deploy gratuito na Vercel

```bash
npm install -g vercel
vercel
```

Siga o wizard. Depois adicione as variáveis de ambiente no dashboard da Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

O link gerado funciona de qualquer lugar como PWA.

---

### ETAPA 7 — Estrutura do projeto para referência

```
gestor-financeiro/
├── .antigravity/
│   └── config.yaml          ← contexto do projeto para o Antigravity
├── src/
│   ├── components/
│   │   └── layout/
│   │       └── Layout.tsx   ← nav bottom + outlet
│   ├── hooks/
│   │   └── useData.ts       ← TODOS os hooks de dados (Supabase)
│   ├── lib/
│   │   ├── supabase.ts      ← client + TypeScript types
│   │   ├── store.ts         ← estado global (Zustand)
│   │   └── utils.ts         ← formatBRL, datas etc.
│   ├── pages/
│   │   ├── AuthPage.tsx     ✅ implementado
│   │   ├── Dashboard.tsx    ✅ implementado
│   │   ├── Lancamentos.tsx  🔧 delegar ao Antigravity
│   │   ├── Cartoes.tsx      🔧 delegar ao Antigravity
│   │   ├── Metas.tsx        🔧 delegar ao Antigravity
│   │   └── Relatorios.tsx   🔧 delegar ao Antigravity
│   └── App.tsx              ← rotas + auth listener
├── supabase/
│   └── schema.sql           ← execute este no Supabase
├── .env.example             ← copie para .env.local
├── vite.config.ts           ← configuração Vite + PWA
└── package.json
```

---

## 👤 Dados por usuário (multi-tenant)

Cada conta de login tem **dados isolados**: contas, categorias, cartões, lançamentos, metas e orçamentos pertencem a um `user_id` e o Supabase aplica **Row Level Security (RLS)** — um usuário não vê nem altera dados de outro.

- Trocar de usuário: use **Sair** no app e entre com outra conta
- No Supabase, execute também `supabase/multi-tenant.sql` (reforça RLS e views)

---

## 🚀 Funcionalidades implementadas

| Funcionalidade | Status |
|---|---|
| Autenticação (login/cadastro) | ✅ |
| Dashboard com saldo e gráfico | ✅ |
| Schema do banco completo | ✅ |
| Hooks de dados (Supabase) | ✅ |
| Suporte a parcelamentos | ✅ (hook) |
| Suporte a recorrências | ✅ (hook) |
| PWA instalável | ✅ |
| Dark mode | ✅ |
| Tela de Lançamentos | 🔧 delegar ao Antigravity |
| Tela de Cartões | 🔧 delegar ao Antigravity |
| Tela de Metas | 🔧 delegar ao Antigravity |
| Tela de Relatórios | 🔧 delegar ao Antigravity |
| Notificações push | 🔧 delegar ao Antigravity |
| Upload de comprovantes | 🔧 delegar ao Antigravity |

---

## 🛠️ Comandos úteis

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build para produção
npm run preview    # testar o build localmente
```
