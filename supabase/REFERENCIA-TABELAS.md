# Referência — todas as tabelas e campos

Use com **`schema-novo.sql`** (banco limpo).

---

## `perfis`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| user_id | UUID PK | = auth.users |
| nome | text | Nome exibido |
| cpf | text | CPF |
| tema | text | dark / light |
| idioma | text | pt-BR |
| moeda | text | BRL |

---

## `bancos` ⭐ cadastro de banco
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| user_id | UUID | Dono |
| nome | text | Ex: Conta corrente |
| instituicao | text | Ex: Nubank, Bradesco |
| tipo | text | corrente, poupanca, carteira, investimento, outro |
| saldo_inicial | numeric | Valor na data de referência |
| data_saldo_inicial | date | **Data do saldo inicial** |
| agencia | text | Opcional |
| numero_conta | text | Opcional |
| cor, icone | text | UI |
| ativo | boolean | |

**View `saldo_bancos`:** calcula `saldo_atual` = saldo_inicial + lançamentos desde `data_saldo_inicial`.

---

## `categorias`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| parent_id | UUID | **null = categoria; preenchido = subcategoria** |
| nome, tipo, cor, icone | | receita / despesa / ambos |

---

## `cartoes`
| Campo | Tipo |
|-------|------|
| nome, banco, bandeira, limite | |
| dia_fechamento, dia_vencimento | |
| banco_pagamento_id | FK → bancos |

---

## `lancamentos`
| Campo | Tipo |
|-------|------|
| tipo | receita, despesa, transferencia |
| descricao, valor, data | |
| categoria_id, banco_id, cartao_id | |
| parcelado, parcela_atual, total_parcelas | |
| recorrente, frequencia | |
| local_compra, observacao, comprovante_url | |
| banco_destino_id | transferências |

---

## `metas`
| Campo | Tipo |
|-------|------|
| nome, valor_alvo, valor_atual, prazo | |
| banco_id | opcional |

---

## `orcamentos`, `notificacoes`, `insights`
Orçamento por categoria; alertas; sugestões IA.

---

## Relacionamentos

```
auth.users
  └── perfis (1:1)
  └── bancos (1:N)
  └── categorias (1:N, árvore via parent_id)
  └── cartoes (1:N) → banco_pagamento_id → bancos
  └── lancamentos (1:N) → banco_id, categoria_id, cartao_id
  └── metas (1:N)
```
