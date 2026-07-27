# 🚀 Guia Rápido - Início Rápido

## ✅ O que foi implementado

### 🎨 Sistema de Design Completo

1. **Paleta de Cores Personalizada**

   - Cores especiais para empresa de pelúcias
   - Gradientes modernos e acolhedores
   - Configurado no `tailwind.config.js`

2. **Componentes CSS Utilitários** (`src/index.css`)

   - `.card` e `.card-gradient` - Cards modernos
   - `.stat-card` - Cards de estatísticas premium
   - `.btn-primary`, `.btn-secondary`, etc. - Botões estilizados
   - `.input-field`, `.select-field` - Campos de entrada
   - `.badge-*` - Badges contextuais
   - `.alert-*` - Alertas coloridos
   - `.table-modern` - Tabelas elegantes
   - Padrões decorativos (`.teddy-pattern`, `.bg-pattern`)

3. **Componentes React Reutilizáveis**

   - `Navbar` - Barra de navegação premium
   - `Footer` - Rodapé informativo
   - `Loading` - Estados de carregamento temáticos
   - `UIComponents` - Biblioteca completa de componentes

4. **Páginas Estilizadas**
   - ✅ Login - Design moderno com gradientes
   - ✅ Registro - Formulário elegante
   - ✅ Dashboard - Cards e tabelas estilizados
   - ✅ StyleGuide - Guia visual de componentes

## 📍 Como Acessar

### Ver o Style Guide

```
http://localhost:5173/style-guide
```

Aqui você encontra TODOS os componentes disponíveis com exemplos de uso.

### Páginas Disponíveis

- `/login` - Página de login
- `/registrar` - Página de registro
- `/` - Dashboard (requer login)
- `/style-guide` - Guia de componentes (público)

## 🎯 Como Usar os Componentes

### 1. Criar uma Nova Página

```jsx
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";

export function MinhaPage() {
  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Título da Página"
          subtitle="Descrição da página"
          icon="🎯"
          action={<button className="btn-primary">Nova Ação</button>}
        />

        <div className="card">
          <p>Conteúdo aqui</p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
```

### 2. Usar Cards de Estatísticas

```jsx
import { StatsGrid } from "../components/UIComponents";

const stats = [
  {
    label: "Total",
    value: "R$ 1.000,00",
    subtitle: "💰 Este mês",
    gradient: "bg-gradient-to-br from-primary to-accent-yellow",
  },
];

<StatsGrid stats={stats} />;
```

### 3. Criar uma Tabela

```jsx
import { DataTable } from "../components/UIComponents";

const headers = [
  { label: "Nome", key: "nome" },
  {
    label: "Status",
    key: "status",
    render: (row) => <Badge variant="success">{row.status}</Badge>,
  },
];

const data = [{ nome: "Item 1", status: "Ativo" }];

<DataTable headers={headers} data={data} />;
```

### 4. Mostrar Alertas

```jsx
import { AlertBox } from "../components/UIComponents";

<AlertBox
  type="success"
  title="Sucesso!"
  message="Operação realizada com sucesso."
/>;
```

### 5. Usar Modal

```jsx
import { Modal } from "../components/UIComponents";
const [open, setOpen] = useState(false);

<Modal isOpen={open} onClose={() => setOpen(false)} title="Título do Modal">
  <p>Conteúdo do modal</p>
</Modal>;
```

## 🎨 Classes CSS Principais

### Cards

```html
<div class="card">Conteúdo</div>
<div class="card-gradient">Com gradiente</div>
<div class="stat-card bg-gradient-to-br from-primary to-accent-yellow">
  Estatística
</div>
```

### Botões

```html
<button class="btn-primary">Primary</button>
<button class="btn-secondary">Secondary</button>
<button class="btn-success">Success</button>
<button class="btn-danger">Danger</button>
```

### Inputs

```html
<input type="text" class="input-field" placeholder="..." />
<select class="select-field">
  ...
</select>
```

### Badges

```html
<span class="badge badge-success">Badge</span>
<span class="badge badge-warning">Warning</span>
```

### Alerts

```html
<div class="alert alert-success">Mensagem</div>
<div class="alert alert-error">Erro</div>
```

## 🌈 Paleta de Cores

Use estas cores do Tailwind:

- `bg-primary` ou `text-primary` - #F2A20C
- `bg-accent-yellow` - #F2B705
- `bg-accent-cream` - #F2DC99
- `bg-background-light` - #F2F2F2
- `bg-background-dark` - #0D0D0D

### Gradientes Prontos

```html
bg-gradient-to-br from-primary to-accent-yellow bg-gradient-to-r from-blue-500
to-blue-600 bg-gradient-to-br from-green-500 to-green-600
```

## 📚 Documentação Completa

- **DESIGN.md** - Documentação detalhada do design system
- **README_DESIGN.md** - Overview do projeto
- **/style-guide** - Visualização interativa de todos os componentes

## 🔥 Dicas Rápidas

1. **Sempre use as classes utilitárias** já definidas no `index.css`
2. **Adicione emojis temáticos** para manter o tema lúdico (🧸, 🎯, 📊, etc.)
3. **Use o StatsGrid** para dashboards
4. **Mantenha os padrões de espaçamento** (gap-6, p-6, mb-8)
5. **Teste em mobile** - tudo é responsivo!

## 🎯 Próximos Passos

Para aplicar o design em outras páginas:

1. Abra a página que quer estilizar
2. Consulte o `/style-guide` para ver componentes disponíveis
3. Importe os componentes necessários
4. Use as classes CSS utilitárias
5. Adicione o Navbar e Footer

## 💡 Exemplos Práticos

### Página de Lista

```jsx
<PageHeader title="Produtos" icon="🧸" />
<DataTable headers={headers} data={produtos} />
```

### Formulário

```jsx
<div className="card">
  <input className="input-field" placeholder="Nome" />
  <select className="select-field">...</select>
  <button className="btn-primary">Salvar</button>
</div>
```

### Dashboard

```jsx
<StatsGrid stats={estatisticas} />
<div className="card">
  <AlertBox type="warning" message="Atenção!" />
</div>
```

---

**🧸 Divirta-se desenvolvendo com o sistema Agarra Mais!**

Para dúvidas, consulte o `/style-guide` ou a documentação em `DESIGN.md`
