# Banco de dados — começar do zero

## Passo 1 — Apagar e recriar tudo (recomendado para você)

1. [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto  
2. **SQL Editor** → **New query**  
3. Cole **todo** o arquivo **`schema-novo.sql`**  
4. Clique **Run**

Isso remove tabelas antigas e cria a estrutura nova.

## Passo 2 — Variáveis no app (`.env.local`)

```
VITE_SUPABASE_URL=https://SEU_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

## Passo 3 — Rodar o app

```bash
npm run dev
```

## Passo 4 — Cadastrar seu primeiro banco

No app: **Bancos** (menu inferior) → **+** → preencha:

- Instituição (Nubank, Bradesco…)
- Nome da conta
- **Saldo inicial**
- **Data do saldo inicial** (a partir dessa data entram os movimentos no cálculo)

---

## Tabelas criadas

| Tabela | Descrição |
|--------|-----------|
| `perfis` | Nome, CPF, tema |
| **`bancos`** | **Cadastro de banco + saldo inicial + data** |
| `categorias` | Categorias e subcategorias (`parent_id`) |
| `cartoes` | Cartões de crédito |
| `lancamentos` | Receitas, despesas, transferências |
| `metas` | Metas financeiras |
| `orcamentos` | Limite por categoria |
| `notificacoes` | Alertas |
| `insights` | Sugestões |

**Views:** `saldo_bancos`, `resumo_categorias`, `fatura_cartoes`

---

## Saldo do banco

```
saldo_atual = saldo_inicial (na data_saldo_inicial)
            + receitas
            - despesas
            ± transferências
```

Somente lançamentos com `data >= data_saldo_inicial` entram no cálculo.

---

## Se o cadastro de usuário falhar

Execute também: **`fix-signup.sql`**

---

## Arquivos antigos (ignore se usou schema-novo.sql)

- `schema.sql`, `setup-completo.sql` — versão anterior com tabela `contas`
