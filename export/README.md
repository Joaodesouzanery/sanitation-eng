# Hub de Noticias - Template Standalone

## Arquivo
- `hub-standalone.html` (~60KB) - Template completo e auto-contido

## Como Usar

1. **Copie o arquivo** `hub-standalone.html` para seu projeto
2. **Busque por "CUSTOMIZE"** no arquivo para encontrar as areas que precisam de ajuste
3. **Personalize** conforme seu projeto

## Areas para Customizar

| Linha | Area | O que alterar |
|-------|------|---------------|
| ~6 | Head | Titulo e meta description |
| ~847 | Header | Logo e links de navegacao |
| ~860 | Hero | Titulo e descricao principal |
| ~1200 | Sidebar | Links rapidos |
| ~1310 | Footer | Logo, links e copyright |

## Cores (CSS)

Edite as variaveis no `:root` (linha ~23):

```css
:root {
    --primary-dark: #1a1f2e;    /* Fundo escuro */
    --primary-blue: #2c4a7c;    /* Azul principal */
    --accent-blue: #3d6cb9;     /* Azul destaque */
    --gold: #c9a227;            /* Dourado */
    --gold-light: #e8c547;      /* Dourado claro */
}
```

## Dependencias Externas

- Google Fonts (Montserrat e Noto Sans) - carregadas via CDN

## Funcionalidades Incluidas

- Tabs de categorias (Noticias, Artigos, Atualizacoes)
- Layout responsivo
- Sidebar com links rapidos e newsletter
- Cards de noticias com imagens placeholder
- Animacoes suaves
- Headers de seguranca
