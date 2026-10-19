# Design System — Gestor Financeiro

## Identidade
Fintech brasileira: roxo `#820AD1` (light) / `#9D4EDD` (dark), navy `#1A1F36`, feedback verde/vermelho.

## Tokens
- `src/design-system/tokens.ts` — cores, sombras, motion
- `src/index.css` — variáveis CSS `--bg`, `--primary`, etc. (temas `.light` e `.dark`)

## Componentes UI (`src/ui/`)
| Arquivo | Componentes |
|---------|-------------|
| `primitives.tsx` | Button, Card, Input, Chip, Badge, SectionTitle |
| `feedback.tsx` | Skeleton, EmptyState, StateScreen |
| `finance.tsx` | CreditCardVisual, StatCard, ProgressBar, MoneyDisplay, QuickAction |
| `Screen.tsx` | Screen, FAB |

## Telas
Todas em `src/pages/` — fluxo via `App.tsx` + `AppShell` + `BottomNav`.

## Tema
Toggle em **Configurações** → persiste via Zustand (`darkMode`).

## Estados
Demo em `/estados` (loading, skeleton, empty, success, error, offline).
