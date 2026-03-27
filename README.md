# EduGestão — Sistema de Gestão Escolar

Sistema web completo para gerenciar **alunos, presença, notas e atividades** das turmas CK 1–4 e CT 1–4.

---

## 🚀 Como usar

1. Abra o arquivo `index.html` no navegador (ou hospede em qualquer servidor estático).
2. O sistema funciona **offline** (dados no localStorage) ou **com Supabase** para banco de dados real.

---

## 🔗 Integração com Supabase

### 1. Crie um projeto no Supabase
Acesse [supabase.com](https://supabase.com) e crie um projeto gratuito.

### 2. Crie as tabelas no SQL Editor

```sql
-- ALUNOS
create table alunos (
  id serial primary key,
  nome text not null,
  matricula text,
  turma text not null
);

-- NOTAS
create table notas (
  id serial primary key,
  aluno_id integer references alunos(id) on delete cascade,
  disciplina text not null,
  bimestre integer not null,
  nota numeric(4,1) not null,
  turma text
);

-- PRESENÇAS
create table presencas (
  id serial primary key,
  aluno_id integer references alunos(id) on delete cascade,
  data date not null,
  status char(1) not null,   -- 'P', 'A', 'J'
  justificativa text,
  turma text not null
);

-- ATIVIDADES
create table atividades (
  id serial primary key,
  titulo text not null,
  descricao text,
  disciplina text,
  data_entrega date,
  peso integer default 1,
  turma text not null
);

-- AULAS
create table aulas (
  id serial primary key,
  tipo text not null,          -- 'regular' (2h) ou 'AE' (1h)
  disciplina text,
  conteudo text,
  data date not null,
  inicio time not null,
  fim time not null,
  turma text not null
);
```

### 3. Habilite RLS (Row Level Security)
No Supabase, vá em **Authentication → Policies** e crie políticas permissivas para cada tabela, ou desabilite o RLS durante o desenvolvimento:

```sql
alter table alunos    disable row level security;
alter table notas     disable row level security;
alter table presencas disable row level security;
alter table atividades disable row level security;
alter table aulas     disable row level security;
```

### 4. Configure no sistema
- Clique em **⚙ Configurar** no canto inferior esquerdo
- Cole a **URL do projeto** (ex: `https://abcxyz.supabase.co`)
- Cole a **Anon Key** (encontrada em Settings → API)
- Clique **Salvar & Conectar**

---

## 📋 Funcionalidades

| Módulo | Funções |
|---|---|
| **Alunos** | Adicionar, editar, remover, buscar |
| **Presença** | Lançar P/F/J por data, histórico, salvar em lote |
| **Notas** | Lançar por bimestre e disciplina, editar, remover |
| **Atividades** | Criar com peso, data de entrega, disciplina |
| **Aulas** | Registrar aulas Regular (2h) e AE (1h), cálculo automático do término, carga horária total |
| **Desempenho** | Média geral, frequência, score, conceito A/B/C/D |
| **Dashboard** | Ranking da turma, alertas de risco, estatísticas |

---

## 📁 Estrutura
```
escola-gestao/
├── index.html   ← estrutura HTML
├── style.css    ← estilos (tema escuro, responsivo)
├── app.js       ← toda a lógica + integração Supabase
└── README.md    ← este arquivo
```
