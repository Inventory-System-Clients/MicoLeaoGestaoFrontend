# 🧸 Design System - Agarra Mais

## Paleta de Cores

Este sistema foi desenvolvido especialmente para uma empresa de gestão de pelúcias, utilizando uma paleta de cores quente e acolhedora que remete ao universo lúdico e aconchegante das pelúcias.

### Cores Principais

```css
--primary: #F2A20C        /* Laranja principal - Cor vibrante e alegre */
--accent-yellow: #F2B705   /* Amarelo dourado - Complemento caloroso */
--accent-cream: #F2DC99    /* Creme suave - Tonalidade acolhedora */
--background-light: #F2F2F2 /* Cinza claro - Fundo limpo */
--background-dark: #0D0D0D  /* Preto suave - Contraste elegante */
```

### Uso das Cores

- **#F2A20C (Primary Orange)**: Usado em botões principais, destaques e elementos de ação
- **#F2B705 (Accent Yellow)**: Gradientes e elementos secundários de destaque
- **#F2DC99 (Cream)**: Backgrounds sutis, badges e elementos informativos
- **#F2F2F2 (Light Gray)**: Background principal da aplicação
- **#0D0D0D (Dark)**: Navbar, textos principais e elementos de alto contraste

## Componentes de Design

### Cards

#### `.card`

Card básico com design limpo e moderno

- Fundo branco com bordas arredondadas (rounded-2xl)
- Sombra suave com hover effect
- Borda sutil em cinza claro

#### `.card-gradient`

Card com gradiente sutil para áreas especiais

- Gradiente de branco para creme (#F2DC99/30)
- Borda com cor accent cream
- Ideal para formulários e áreas de destaque

#### `.stat-card`

Cards de estatísticas com design premium

- Fundo com gradiente colorido
- Elementos decorativos circulares
- Efeito de hover com escala
- Perfeito para métricas e KPIs

### Botões

#### `.btn-primary`

Botão principal com gradiente laranja-amarelo

- Gradiente: #F2A20C → #F2B705
- Sombra e efeito de elevação ao hover
- Ring focus para acessibilidade

#### `.btn-secondary`

Botão secundário com borda

- Fundo branco com borda laranja
- Hover com fundo laranja suave
- Estilo outline moderno

#### `.btn-danger` / `.btn-success`

Botões para ações destrutivas/positivas

- Vermelho/Verde com gradiente
- Mesmos efeitos dos botões primários

### Inputs

#### `.input-field`

Campo de entrada com design moderno

- Bordas arredondadas (rounded-xl)
- Borda dupla com transição suave
- Focus ring laranja translúcido
- Hover effect sutil

#### `.select-field`

Select estilizado

- Mesmas características do input-field
- Cursor pointer para indicar interatividade

### Badges

Pequenos elementos informativos com cores contextuais:

- `.badge-warning`: Amarelo - alertas e avisos
- `.badge-success`: Verde - sucesso e confirmações
- `.badge-danger`: Vermelho - erros e críticos
- `.badge-info`: Azul - informações gerais

### Tabelas

#### `.table-modern`

Tabelas com design sofisticado

- Header com gradiente sutil laranja/amarelo
- Linhas com hover effect suave
- Divisores discretos
- Ícones coloridos nos headers

### Alerts

Caixas de mensagem com bordas laterais coloridas:

- `.alert-success`: Verde
- `.alert-error`: Vermelho
- `.alert-warning`: Amarelo
- `.alert-info`: Azul

## Elementos Especiais

### Efeitos e Padrões

#### `.teddy-pattern`

Padrão de fundo sutil com círculos radiais que remetem às cores das pelúcias

#### `.bg-pattern`

Grid pattern com linhas sutis em creme

#### `.text-gradient`

Texto com gradiente laranja-amarelo

- Ideal para títulos e destaques especiais

### Animações

#### `.spinner`

Loading spinner personalizado

- Bordas coloridas (creme e laranja)
- Rotação suave
- Pode incluir emoji de pelúcia no centro

## Componentes Customizados

### Navbar

- Fundo escuro (#0D0D0D) com gradiente
- Logo com efeito glow ao hover
- Links ativos destacados com gradiente
- Info do usuário em card translúcido
- Ícones emoji para cada seção

### Footer

- Mesmo tema da navbar
- Borda superior colorida (#F2A20C)
- Grid responsivo com informações
- Links com bullets coloridos
- Informações de contato com ícones

### Loading States

#### `PageLoader`

Loader de página completa

- Background com padrão decorativo
- Card central com spinner
- Emoji de pelúcia animado

#### `LoadingSpinner`

Componente reutilizável de loading

- Tamanhos: sm, md, lg
- Mensagem customizável
- Emoji de pelúcia no centro

#### `EmptyState`

Estado vazio com design amigável

- Emoji grande e customizável
- Título e descrição
- Ação opcional

## Princípios de Design

### 1. **Acolhedor e Alegre**

As cores quentes (laranja e amarelo) criam uma atmosfera acolhedora e divertida, perfeita para o universo das pelúcias.

### 2. **Moderno e Profissional**

Apesar do tema lúdico, o design mantém profissionalismo com:

- Espaçamentos generosos
- Tipografia clara
- Sombras sutis
- Animações suaves

### 3. **Acessibilidade**

- Alto contraste entre texto e fundo
- Focus rings visíveis
- Estados de hover claros
- Tamanhos de toque adequados para mobile

### 4. **Responsividade**

- Grid system do Tailwind
- Breakpoints: sm, md, lg, xl
- Mobile-first approach

### 5. **Feedback Visual**

- Hover effects em todos elementos interativos
- Transições suaves (duration-200/300)
- Estados de loading claros
- Alerts contextualizados

## Ícones e Emojis

O sistema utiliza uma combinação de:

- **SVG Icons**: Para ícones funcionais (Heroicons)
- **Emojis**: Para elementos lúdicos e temáticos
  - 🧸 Pelúcia (tema principal)
  - 📊 Dashboard
  - 📦 Movimentações
  - 🎮 Máquinas
  - 🏪 Lojas
  - 👥 Usuários
  - 💰 Faturamento
  - 🎁 Prêmios
  - ⚠️ Alertas

## Tipografia

- **Font Family**: Inter (sistema)
- **Pesos**:
  - Regular (400): Texto normal
  - Medium (500): Labels
  - Semibold (600): Subtítulos
  - Bold (700): Títulos principais

## Espaçamentos

Baseado no sistema do Tailwind:

- **Gap entre cards**: 6 (1.5rem)
- **Padding de cards**: 6 (1.5rem)
- **Margin entre seções**: 8 (2rem)
- **Espaçamento interno de forms**: 4-6

## Sombras

- **Card padrão**: shadow-lg
- **Card hover**: shadow-xl
- **Botões**: shadow-md → shadow-lg (hover)
- **Stat cards**: shadow-lg → shadow-2xl (hover)

## Bordas

- **Border Radius Pequeno**: rounded-lg (0.5rem)
- **Border Radius Médio**: rounded-xl (0.75rem)
- **Border Radius Grande**: rounded-2xl (1rem)
- **Border Radius Completo**: rounded-full

## Guia de Uso Rápido

### Como criar um novo card de estatística:

```jsx
<div className="stat-card bg-gradient-to-br from-primary to-accent-yellow">
  <div className="relative z-10">
    <h3 className="text-sm font-medium opacity-90">Título</h3>
    <p className="text-3xl font-bold">Valor</p>
  </div>
</div>
```

### Como criar um botão de ação:

```jsx
<button className="btn-primary flex items-center gap-2">
  <svg>...</svg>
  Texto do Botão
</button>
```

### Como criar um alerta:

```jsx
<div className="alert alert-warning">
  <div className="flex items-center gap-2">
    <svg>...</svg>
    <span>Mensagem do alerta</span>
  </div>
</div>
```

## Manutenção

Para manter a consistência do design:

1. **Use sempre as classes utilitárias** definidas no index.css
2. **Não crie estilos inline** a menos que absolutamente necessário
3. **Mantenha a paleta de cores** definida no tailwind.config.js
4. **Siga os padrões de espaçamento** estabelecidos
5. **Use os componentes de Loading** para estados de carregamento
6. **Adicione emojis temáticos** onde apropriado para manter o tema lúdico

---

**Desenvolvido com ❤️ para gestão de pelúcias 🧸**
