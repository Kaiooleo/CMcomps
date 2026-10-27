# CM Comps

Site para montar e acompanhar times de Champions Meeting e League of Heroes (Uma Musume).

- Abra `index.html` (ou o link do GitHub Pages).
- Os times ficam salvos no navegador de cada pessoa. Use **Baixar backup** / **Carregar backup** no rodapé para levar os dados para outro aparelho.
- O Current CM e a data da final ficam no próprio `index.html` (bloco `cmconfig`).

## Arquivos

| Arquivo | O que tem |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual (cores, layout, tema claro/escuro) |
| `app.js` | Funcionamento: telas, seletor, estatísticas, salvar e backup |
| `data.js` | Dados: Current CM, PvPs, personagens e cartas (não formatado de propósito) |
| `sp/` | Imagens das Umas e cartas agrupadas em folhas |

O código é formatado com [Prettier](https://prettier.io): `npx prettier --write .`
