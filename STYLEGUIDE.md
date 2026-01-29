# Guia de Estilo - Caixa Ponto (Tema Futurista)

Este documento define os padrões visuais e de acessibilidade do sistema Caixa Ponto, garantindo consistência com o novo tema visual futurista (Dark Mode + Neon).

## Paleta de Cores

### Fundo e Superfícies (Dark Theme)
Utilizadas para criar profundidade e imersão.

- **Background (Deep Blue)**: `#0b1121`
  - Uso: Fundo principal da aplicação.
- **Surface (Slate 800/900)**: `#151e32`
  - Uso: Fundo de painéis e áreas de conteúdo.
- **Glass Background**: `rgba(21, 30, 50, 0.7)` + `backdrop-filter: blur(16px)`
  - Uso: Cards flutuantes e painéis sobrepostos.

### Cores Primárias (Neon Cyan)
Utilizadas para ações principais, destaques e identidade "tech".

- **Primary (Cyan 500)**: `#06b6d4`
  - Uso: Botões principais, ícones de destaque, textos de ênfase, brilhos (glow).
- **Primary Hover (Cyan 400)**: `#22d3ee`
  - Uso: Estado hover interativo.
- **Primary Glow**: `rgba(6, 182, 212, 0.4)`
  - Uso: Sombras de brilho (box-shadow) para elementos ativos.

### Acentos Secundários (Neon Purple)
Utilizados para detalhes decorativos e diferenciação.

- **Secondary (Violet 500)**: `#8b5cf6`
  - Uso: Gradientes, detalhes secundários.

### Texto e Conteúdo
- **Foreground (Slate 50)**: `#f8fafc`
  - Uso: Texto principal (Alto contraste).
- **Text Muted (Slate 400)**: `#94a3b8`
  - Uso: Legendas, metadados.

### Estados Semânticos
- **Erro (Rose 500)**: `#f43f5e`
  - Fundo: `rgba(136, 19, 55, 0.2)`
- **Sucesso (Emerald 500)**: `#10b981`
  - Fundo: `rgba(6, 78, 59, 0.2)`

## Efeitos Visuais

### Glassmorphism
Para cards e containers flutuantes:
```css
background: var(--glass-bg);
border: 1px solid var(--glass-border);
backdrop-filter: blur(var(--blur));
```

### Neon Glow
Para foco e estados ativos:
```css
box-shadow: 0 0 15px var(--primary-glow);
border-color: var(--primary);
```

### Gradientes de Texto
Para títulos principais:
```css
background: linear-gradient(135deg, var(--foreground) 0%, var(--primary) 100%);
-webkit-background-clip: text;
color: transparent;
```

## Componentes

### Botões
- **Estilo**: Borda fina ou fundo translúcido com brilho no hover.
- **Hover**: Preenchimento total com cor primária e texto preto (para contraste).

### Inputs
- **Estilo**: Fundo escuro translúcido (`rgba(0,0,0,0.2)`), borda sutil.
- **Foco**: Borda primária + Glow.

## Acessibilidade
- O tema escuro mantém alto contraste (texto claro sobre fundo escuro).
- As cores neon são usadas para destaque, mas o texto principal permanece branco/off-white para legibilidade.
