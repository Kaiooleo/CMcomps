/*
 * CM Comps — regras e cálculos (sem nada de tela).
 *
 * Funciona no navegador (vira `window.CMLogic`) e no Node (via `require`),
 * para que os testes em `tests/` possam conferir cada regra isoladamente.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CMLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const PLACES = ["1st", "2nd", "3rd", "B 1st"];
  const TEAM_SIZE = 3;
  const SLOTS = 6; // pais/avós e cartas do deck
  const ROUNDS = 4;
  const BORROWED_SLOT = 5; // último slot do deck = carta emprestada
  const WINS_TOTAL = 80; // "Wins" é mostrado como vitórias ÷ 80, como na planilha

  /** Formato dos dados salvos. Suba este número quando a estrutura mudar e trate a conversão em `migrate`. */
  const SCHEMA = 1;

  /** Sprint até 1400 m, Mile até 1999 m, Medium até 2400 m, Long acima disso. */
  function dist(m) {
    if (!m) return "";
    if (m <= 1400) return "Sprint";
    if (m <= 1999) return "Mile";
    if (m <= 2400) return "Medium";
    return "Long";
  }

  /**
   * Um dia de round aceita dois formatos:
   * - vitórias de cada tentativa, de 0 a 5, separadas por hífen: "5-4-3-5"
   * - o total de vitórias do dia, de 0 a 20: "17"
   */
  const RACES_PER_DAY = 20; // 4 tentativas × 5 corridas

  /**
   * Lê um dia de round. Aceita três formatos:
   * - tentativas: "5-4-3-5" (2 a 4 tentativas de 0 a 5) → corridas = tentativas × 5;
   * - vitórias/corridas: "12/15" (até 20 corridas);
   * - só o total do dia: "17" → considera 20 corridas.
   * Devolve { wins, races }, ou null se vazio ou inválido.
   */
  function parseRound(v) {
    const x = String(v ?? "").trim();
    if (!x) return null;
    if (/^\d{1,2}$/.test(x)) {
      const w = +x;
      return w <= RACES_PER_DAY ? { wins: w, races: RACES_PER_DAY } : null;
    }
    if (/^[0-5](-[0-5]){1,3}$/.test(x)) {
      const nums = x.split("-").map(Number);
      return { wins: nums.reduce((a, b) => a + b, 0), races: nums.length * 5 };
    }
    const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(x);
    if (m) {
      const w = +m[1];
      const r = +m[2];
      return r >= 1 && r <= RACES_PER_DAY && w <= r
        ? { wins: w, races: r }
        : null;
    }
    return null;
  }

  /** Campo vazio também é válido (dia ainda não preenchido). */
  function isValidRound(v) {
    return !String(v ?? "").trim() || parseRound(v) !== null;
  }

  /** Soma de vitórias e corridas dos dias preenchidos (inválidos ficam de fora). */
  function roundTotals(rat) {
    let wins = 0;
    let races = 0;
    for (const r of rat || []) {
      const p = parseRound(r);
      if (!p) continue;
      wins += p.wins;
      races += p.races;
    }
    return { wins, races };
  }

  /**
   * WR dos rounds: vitórias ÷ corridas realmente feitas nos dias preenchidos.
   * "4-5-4-4", "17" e "17/20" dão o mesmo (85%); "5-4-3" vale 12/15.
   */
  function ratingScore(rat) {
    const { wins, races } = roundTotals(rat);
    return races ? wins / races : 0;
  }

  /**
   * Total de corridas para o "Wins" de cada Uma: as corridas feitas nos rounds
   * preenchidos; sem nenhum round preenchido, 80 (4 dias × 20), como na planilha.
   */
  function winsTotal(rat) {
    return roundTotals(rat).races || WINS_TOTAL;
  }

  /** Data no formato AAAA-MM-DD com ano plausível; qualquer outra coisa vale como "sem data". */
  function validDate(d) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const y = +d.slice(0, 4);
    return y >= 2020 && y <= 2100;
  }

  /** Dias de folga depois de uma final estimada antes de o PvP passar a contar (opção A). */
  const MARGIN_DAYS = 3;
  /** Intervalo entre finais no servidor global, usado para estimar PvPs ainda sem data. */
  const CADENCE_DAYS = 21;

  /** Soma dias a uma data AAAA-MM-DD. */
  function addDays(date, n) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }

  /**
   * A final já terminou? Conta a partir do fim do dia da final.
   * Se a data for estimada (`est`), espera mais MARGIN_DAYS dias, para não
   * contar antes da final de verdade caso a estimativa esteja adiantada.
   */
  function finalPassed(conf, now = new Date()) {
    if (!conf || !validDate(conf.date)) return false;
    const deadline = conf.est ? addDays(conf.date, MARGIN_DAYS) : conf.date;
    return now > new Date(deadline + "T23:59:59");
  }

  /**
   * Calendário completo das finais: usa as datas de `sched` (oficiais ou
   * estimadas) e, para os PvPs seguintes sem data, estima a partir da
   * anterior + CADENCE_DAYS. Resultado: { id: { end, est, auto } }.
   */
  function fillSchedule(cms, sched = {}) {
    const out = {};
    let last = null;
    for (const c of cms) {
      const e = sched[c.id];
      if (e && validDate(e.end)) {
        out[c.id] = { end: e.end, est: !!e.est, auto: false };
        last = e.end;
      } else if (last) {
        last = addDays(last, CADENCE_DAYS);
        out[c.id] = { end: last, est: true, auto: true };
      }
    }
    return out;
  }

  /**
   * Qual é o Current PvP hoje: o primeiro PvP cuja final ainda não passou.
   * `config.cur` força um PvP manualmente (com `config.date` opcional).
   * Retorna { cur, date, est, manual }; `cur` null = todos já passaram.
   */
  function resolveCurrent(cms, sched, config = {}, now = new Date()) {
    const full = fillSchedule(cms, sched);
    const ids = cms.map((c) => c.id);
    if (config && config.cur && ids.includes(config.cur)) {
      const e = full[config.cur];
      const date = validDate(config.date) ? config.date : e ? e.end : null;
      const est = validDate(config.date) ? false : !!(e && e.est);
      return { cur: config.cur, date, est, manual: true };
    }
    for (const id of ids) {
      const e = full[id];
      if (!e) return { cur: id, date: null, est: false, manual: false };
      if (!finalPassed({ date: e.end, est: e.est }, now))
        return { cur: id, date: e.end, est: e.est, manual: false };
    }
    return { cur: null, date: null, est: false, manual: false };
  }

  /**
   * Em que fase um PvP está em relação ao Current PvP:
   * "past" (antes dele), "current" (é ele) ou "future" (depois dele).
   * Sem Current PvP definido, tudo é "past".
   */
  function phase(cms, conf, id) {
    const ids = cms.map((c) => c.id);
    const cur = conf && conf.cur ? ids.indexOf(conf.cur) : -1;
    if (cur < 0) return "past";
    const i = ids.indexOf(id);
    if (i < cur) return "past";
    return i === cur ? "current" : "future";
  }

  /** Entra nas estatísticas? Anteriores sempre; o atual só depois da final; os seguintes nunca. */
  function counted(cms, conf, id, now = new Date()) {
    const ph = phase(cms, conf, id);
    return ph === "past" || (ph === "current" && finalPassed(conf, now));
  }

  /** Dias até o fim do dia da final (0 = hoje). `null` sem data válida. */
  function daysToFinal(conf, now = new Date()) {
    if (!conf || !validDate(conf.date)) return null;
    return Math.ceil((new Date(conf.date + "T23:59:59") - now) / 864e5);
  }

  /**
   * Estatísticas do Resumo, só com os PvPs que contam.
   * Debuffers ficam fora de Aces, estilos e cartas, como na planilha.
   */
  function computeStats(cms, data, isCounted = () => true) {
    const pl = Object.fromEntries(PLACES.map((p) => [p, 0]));
    const styles = {};
    const aces = {};
    const cards = {};
    const borrow = {};
    const scores = [];
    const byDist = {}; // "Turf Mile", "Dirt Medium"… → { wins: 1st, finals: finais registradas }
    const byScenario = []; // [{ sc, wins: 1st, finals }] na ordem dos PvPs
    const parents = {}; // P1 e P2 usados (todas as Umas)
    const grandparents = {}; // avós usados (todas as Umas)
    for (const cm of cms) {
      const d = data[cm.id];
      if (!d || !isCounted(cm.id)) continue;
      if (pl[d.pl] !== undefined) pl[d.pl]++;
      if (pl[d.pl] !== undefined) {
        const dd = dist(cm.m) || cm.dc;
        const dk = dd && `${cm.su === "Dirt" ? "Dirt" : "Turf"} ${dd}`;
        if (dk) {
          const b = (byDist[dk] = byDist[dk] || { wins: 0, finals: 0 });
          b.finals++;
          if (d.pl === "1st") b.wins++;
        }
        if (cm.sc) {
          let row = byScenario.find((r) => r.sc === cm.sc);
          if (!row) byScenario.push((row = { sc: cm.sc, wins: 0, finals: 0 }));
          row.finals++;
          if (d.pl === "1st") row.wins++;
        }
      }
      const sc = ratingScore(d.rat);
      if (sc > 0) {
        scores.push({ id: cm.id, sc, pl: d.pl });
      }
      for (const t of d.team || []) {
        if (!t.n) continue;
        (t.p || []).forEach((n, i) => {
          if (!n) return;
          const m = i === 0 || i === 3 ? parents : grandparents;
          m[n] = (m[n] || 0) + 1;
        });
        if (t.ro === "Debuffer") continue;
        aces[t.n] = (aces[t.n] || 0) + 1;
        if (t.st) styles[t.st] = (styles[t.st] || 0) + 1;
        (t.d || []).forEach((k, i) => {
          if (!k) return;
          const bucket = i === BORROWED_SLOT ? borrow : cards;
          bucket[k] = (bucket[k] || 0) + 1;
        });
      }
    }
    const tot = PLACES.reduce((a, p) => a + pl[p], 0);
    const top = (m, n) =>
      Object.entries(m)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, n);
    const sorted = [...scores].sort((a, b) => b.sc - a.sc);
    return {
      pl,
      tot,
      wr: tot ? pl["1st"] / tot : 0,
      styles,
      // listas completas, da mais para a menos usada (o Resumo mostra o top 5)
      aces: top(aces, Infinity),
      cards: top(cards, Infinity),
      borrow: top(borrow, Infinity),
      parents: top(parents, Infinity),
      grandparents: top(grandparents, Infinity),
      byDist,
      byScenario,
      scores,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      avg: scores.length
        ? scores.reduce((a, b) => a + b.sc, 0) / scores.length
        : 0,
    };
  }

  /* ---------- formato dos dados salvos ---------- */

  function blankRecord() {
    return {
      team: Array.from({ length: TEAM_SIZE }, () => ({
        n: null,
        ro: "Ace",
        st: null,
        w: null,
        p: Array(SLOTS).fill(null),
        d: Array(SLOTS).fill(null),
        lb: Array(SLOTS).fill(null), // limit break de cada carta: 0–4 (4 = MLB) ou null
      })),
      rat: Array(ROUNDS).fill(""),
      pl: "",
    };
  }

  const str = (v) => (typeof v === "string" && v.trim() ? v : null);
  const fit = (arr, len, fill, map) =>
    Array.from({ length: len }, (_, i) =>
      Array.isArray(arr) && arr[i] != null ? map(arr[i]) : fill,
    );

  /** Limit break válido: 0 a 4 (4 = MLB); qualquer outra coisa vira null. */
  const LB_LABELS = ["0LB", "1LB", "2LB", "3LB", "MLB"];
  function lbValue(v) {
    const n = parseInt(v, 10);
    return n >= 0 && n <= 4 ? n : null;
  }

  /** Garante que um PvP salvo tenha sempre 3 Umas, 6 pais, 6 cartas (com limit break) e 4 dias de round, com tipos corretos. */
  function normalizeRecord(r) {
    const base = blankRecord();
    if (!r || typeof r !== "object") return base;
    base.pl = PLACES.includes(r.pl) ? r.pl : "";
    base.rat = fit(r.rat, ROUNDS, "", (v) => String(v));
    base.team = base.team.map((blank, i) => {
      const t = Array.isArray(r.team) && r.team[i] ? r.team[i] : {};
      const w = parseInt(t.w, 10);
      return {
        n: str(t.n),
        ro: t.ro === "Debuffer" ? "Debuffer" : "Ace",
        st: str(t.st),
        w: isNaN(w) ? null : w,
        p: fit(t.p, SLOTS, null, str),
        d: fit(t.d, SLOTS, null, str),
        lb: fit(t.lb, SLOTS, null, lbValue),
      };
    });
    return base;
  }

  /**
   * Converte qualquer formato já usado para o atual (SCHEMA).
   * Aceita: `{ v, data }` (atual), `{ app: "cmcomps", v, data }` (backup)
   * ou o mapa puro `{ CM1: {...} }` (versão inicial, sem número de formato).
   * Lança erro se a versão for mais nova do que este site entende.
   */
  function migrate(raw) {
    if (!raw || typeof raw !== "object") return {};
    let v = 0;
    let data = raw;
    if ("data" in raw && typeof raw.data === "object") {
      v = Number(raw.v) || 0;
      data = raw.data || {};
    }
    if (v > SCHEMA) {
      throw new Error(
        `This data is from a newer version of the site (format ${v}). Reload the page.`,
      );
    }
    // v0 → v1: mesmo conteúdo, só passa a ser normalizado e ganhar número de formato.
    const out = {};
    for (const [id, rec] of Object.entries(data)) {
      if (/^[A-Za-z0-9_-]+$/.test(id)) out[id] = normalizeRecord(rec);
    }
    return out;
  }

  /** PvP sem nada preenchido? (não precisa ser salvo) */
  function isEmptyRecord(r) {
    return (
      !r.pl &&
      r.rat.every((x) => !x) &&
      r.team.every(
        (t) =>
          !t.n &&
          t.w == null &&
          !t.st &&
          t.ro === "Ace" &&
          t.p.every((x) => !x) &&
          t.d.every((x) => !x) &&
          t.lb.every((x) => x == null),
      )
    );
  }

  /** O que vai para o navegador: só os PvPs com algo preenchido, com o número do formato. */
  function serialize(data) {
    const out = {};
    for (const [id, r] of Object.entries(data)) {
      if (!isEmptyRecord(r)) out[id] = r;
    }
    return { v: SCHEMA, data: out };
  }

  function makeBackup(data, now = new Date()) {
    return { app: "cmcomps", ...serialize(data), saved: now.toISOString() };
  }

  /** Lê o conteúdo de um arquivo de backup. Lança erro se não for um backup do CM Comps. */
  function parseBackup(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (_) {
      throw new Error("This file is not a Comps backup.");
    }
    if (!j || j.app !== "cmcomps" || typeof j.data !== "object")
      throw new Error("This file is not a Comps backup.");
    return migrate(j);
  }

  /* ---------- Affinity (compatibilidade) ---------- */

  /** Id do personagem (igual para todas as versões dela) pelo nome do ícone: chr_icon_1006_... → "1006". */
  function charaId(icon) {
    const m = /chr_icon_(\d+)_/.exec(icon || "");
    return m ? m[1] : null;
  }

  /**
   * Segmentos da affinity base. Posições: -1 = a Uma; 0..5 = ordem de `p`
   * (P1, GP1.1, GP1.2, P2, GP2.1, GP2.2).
   */
  const AFF_SEGMENTS = [
    { label: "Uma · P1", ids: [-1, 0] },
    { label: "Uma · P2", ids: [-1, 3] },
    { label: "P1 · P2", ids: [0, 3] },
    { label: "Uma · P1 · GP1.1", ids: [-1, 0, 1] },
    { label: "Uma · P1 · GP1.2", ids: [-1, 0, 2] },
    { label: "Uma · P2 · GP2.1", ids: [-1, 3, 4] },
    { label: "Uma · P2 · GP2.2", ids: [-1, 3, 5] },
  ];

  /** △ abaixo de 51, ○ de 51 a 150, ◎ a partir de 151. */
  function affinityMark(total) {
    return total >= 151 ? "◎" : total >= 51 ? "○" : "△";
  }

  /**
   * Pontos de afinidade de um grupo de personagens: soma dos grupos que
   * todos têm em comum. Usa os dados do global quando todos já estão lá
   * (e fora de `jpOnly`); senão, os do japonês. Mesmo personagem repetido vale 0 (o jogo não deixa).
   */
  function affinityOf(chars, aff) {
    if (new Set(chars).size < chars.length) return 0;
    const jpOnly = aff.jpOnly || [];
    const db = chars.every((c) => aff.gl.g[c] && !jpOnly.includes(c))
      ? aff.gl
      : aff.jp;
    const sets = chars.map((c) => new Set(db.g[c] || []));
    let sum = 0;
    for (const t of sets[0])
      if (sets.every((s) => s.has(t))) sum += db.p[t] || 1;
    return sum;
  }

  /**
   * Affinity base (sem bônus de G1) da Uma com os parents.
   * `main` e `parents` são ids de personagem (ou null quando vazio).
   * Cada segmento vem com `value: null` se falta alguém nele.
   */
  function affinity(main, parents, aff) {
    const who = (i) => (i < 0 ? main : parents[i]);
    const parts = AFF_SEGMENTS.map((s) => {
      const chars = s.ids.map(who);
      return {
        label: s.label,
        ids: s.ids,
        value: aff && chars.every(Boolean) ? affinityOf(chars, aff) : null,
      };
    });
    const total = parts.reduce((a, p) => a + (p.value || 0), 0);
    return { total, mark: affinityMark(total), parts };
  }

  /**
   * A Uma/carta já tinha saído até o fim deste PvP?
   * item: { rj, re } = lançamento no JP e no Global; pvp: { jp } = último dia no JP;
   * glEnd = último dia oficial no Global (se houver). Com data Global dos dois
   * lados compara no Global; senão compara no JP; sem datas, mostra tudo.
   */
  function releasedBy(item, pvp, glEnd) {
    if (!item || !pvp) return true;
    if (glEnd && item.re) return item.re <= glEnd;
    if (pvp.jp && item.rj) return item.rj <= pvp.jp;
    return true;
  }

  return {
    releasedBy,
    charaId,
    AFF_SEGMENTS,
    affinityMark,
    affinityOf,
    affinity,
    PLACES,
    SCHEMA,
    BORROWED_SLOT,
    WINS_TOTAL,
    LB_LABELS,
    lbValue,
    MARGIN_DAYS,
    CADENCE_DAYS,
    addDays,
    fillSchedule,
    resolveCurrent,
    dist,
    RACES_PER_DAY,
    parseRound,
    isValidRound,
    roundTotals,
    ratingScore,
    winsTotal,
    validDate,
    finalPassed,
    phase,
    counted,
    daysToFinal,
    computeStats,
    blankRecord,
    normalizeRecord,
    migrate,
    isEmptyRecord,
    serialize,
    makeBackup,
    parseBackup,
  };
});
