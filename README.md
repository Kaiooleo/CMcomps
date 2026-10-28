# CM Comps

Site para montar e acompanhar times de Champions Meeting e League of Heroes de Uma Musume.

**Site:** https://kaiooleo.github.io/CMcomps/

- Cada pessoa salva os próprios times **no navegador**. O rodapé tem **Baixar backup** e **Carregar backup** para levar os dados para outro aparelho.
- Dá para **instalar como app** no celular ou computador (o navegador oferece "Instalar" / "Adicionar à tela inicial"), e ele abre mesmo sem internet.
- O **Current PvP** é automático: é o primeiro PvP cuja final ainda não passou, pelas datas do servidor global em `data.js` (`window.CM_SCHEDULE`). PvPs depois dele não entram nas estatísticas, e ele mesmo só entra depois da final. Com data **estimada**, ele só passa a contar 3 dias depois da estimativa. PvPs sem data são estimados pela final anterior + 21 dias. Para forçar manualmente, use `window.CM_CONFIG`.

## Arquivos

| Arquivo                | O que tem                                                                         |
| ---------------------- | --------------------------------------------------------------------------------- |
| `index.html`           | Estrutura da página, prévia do link e ícones                                      |
| `style.css`            | Visual (cores, layout, tema claro/escuro)                                         |
| `logic.js`             | Regras e cálculos: WR, o que conta, estatísticas, formato dos dados e backup      |
| `app.js`               | Telas e interação: Resumo, lista de PvPs, página do PvP, seletor, salvar e backup |
| `data.js`              | Current PvP, PvPs, personagens e cartas (não formatado de propósito)              |
| `affinity.js`          | Grupos de afinidade de cada personagem (GameTora), para a affinity base           |
| `img/s/`, `img/c/`     | Artes das Umas (512 px) e cartas (360×480) em alta, carregadas só quando aparecem |
| `sp/`                  | Ícones das Umas agrupados em folhas (192 px)                                      |
| `sw.js`                | Service worker: permite instalar e abrir sem internet                             |
| `manifest.webmanifest` | Nome, cores e ícones do app instalado                                             |
| `icons/`, `og.png`     | Ícones e imagem da prévia do link (Discord etc.)                                  |
| `tests/`               | Testes automáticos                                                                |

## Formato dos dados salvos

O navegador guarda `{ "v": 1, "data": { "CM1": {...}, ... } }` na chave `cmcomps:data`; o backup é igual, com `"app": "cmcomps"`.
Quando a estrutura mudar, aumente `SCHEMA` em `logic.js` e trate a conversão em `migrate()`: dados e backups antigos são convertidos sozinhos ao abrir.

## Desenvolvimento

```sh
npm install
npx playwright install chromium
npm test              # testes dos cálculos + teste do site no navegador
npm run format        # formata com Prettier
```

A cada envio para o GitHub, o **GitHub Actions** (`.github/workflows/ci.yml`) confere a formatação e roda os testes. Se algo falhar, o commit fica com um X vermelho.
