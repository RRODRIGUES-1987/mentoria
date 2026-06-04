# Mentoria · Gestão de Programas de Mentoria

App web estático (HTML/CSS/JS) com backend no **Supabase**. Cobre quatro módulos:

- **Contatos** — cadastro e gestão de pessoas
- **Mentorias** — programas com encontros e observações
- **Avaliações** — avaliação de performance (nota geral + critérios)
- **Faturamento** — controle financeiro por programa

Cada usuário só enxerga os próprios dados (Row Level Security).

---

## Passo a passo

### 1. Criar o projeto no Supabase
1. Acesse <https://supabase.com> e crie um projeto (plano free serve).
2. No menu lateral, abra **SQL Editor** → **New query**.
3. Cole todo o conteúdo de `schema.sql` e clique em **Run**. Isso cria as tabelas e as políticas de segurança.

### 2. Pegar as credenciais
1. Vá em **Project Settings → API**.
2. Copie a **Project URL** e a chave **`anon` `public`**.
3. Abra `config.js` e cole nos campos correspondentes:
   ```js
   window.SUPABASE_CONFIG = {
     url: "https://xxxx.supabase.co",
     anonKey: "eyJhbGci..."
   };
   ```
   > A chave `anon` é pública por design — quem protege os dados é o RLS, não a chave.

### 3. (Opcional) Login sem confirmação de e-mail
Por padrão o Supabase pede confirmação de e-mail no cadastro. Para testar sozinho mais rápido:
**Authentication → Providers → Email** e desligue *"Confirm email"*.

### 4. Publicar no GitHub Pages
1. Crie um repositório e suba os 5 arquivos (`index.html`, `styles.css`, `app.js`, `config.js`, `schema.sql`).
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, escolha `main` / `root`.
3. Em ~1 min o app fica em `https://SEU-USUARIO.github.io/SEU-REPO/`.
4. Em **Authentication → URL Configuration** no Supabase, adicione essa URL em *Site URL* e *Redirect URLs*.

Pronto: abra a URL, crie sua conta e comece a usar.

---

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura: tela de login + shell do app |
| `styles.css` | Design system (tema editorial creme + verde) |
| `app.js` | Toda a lógica: auth, navegação, CRUD |
| `config.js` | Suas credenciais do Supabase |
| `schema.sql` | Tabelas e regras de segurança |

## Modelo de dados
`contacts` → `programs` (1 mentorado por programa) → `meetings`, `evaluations`, `billings`.
Avaliações guardam os critérios em JSON (`[{name, score}]`), então você pode usar critérios diferentes por avaliação sem mudar o banco.

## Ideias para evoluir
- Exportar faturamento para CSV / relatório PDF
- Gráfico de evolução das notas por mentorado
- Lembretes de encontros (Supabase Edge Functions + e-mail)
- Compartilhar um programa com o mentorado (papéis/roles no RLS)
