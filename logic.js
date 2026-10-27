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

  /** Uma rodada é "n-n-n-n" com notas de 0 a 5 (até quatro números). */
  function isValidRound(v) {
    return !v || /^[0-5](-[0-5]){0,3}$/.test(String(v).trim());
  }

  /**
   * WR das rodadas: soma das notas ÷ (rodadas preenchidas × 20).
   * Ex.: ["4-5-4-4"] → 17/20 = 0,85. Rodadas vazias não entram na conta.
   */
  function ratingScore(rat) {
    let sum = 0;
    let rounds = 0;
    for (const r of rat || []) {
      if (!r) continue;
      const nums = String(r)
        .split("-")
        .map((x) => parseInt(x, 10))
        .filter((x) => !isNaN(x));
      if (!nums.length) continue;
      sum += nums.reduce((a, b) => a + b, 0);
      rounds++;
    }
    return rounds ? sum / (rounds * 20) : 0;
  }

  /** Data no formato AAAA-MM-DD com ano plausível; qualquer outra coisa vale como "sem data". */
  function validDate(d) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const y = +d.slice(0, 4);
    return y >= 2020 && y <= 2100;
  }

  /** A final já terminou? (conta a partir do fim do dia da final) */
  function finalPassed(conf, now = new Date()) {
    if (!conf || !validDate(conf.date)) return false;
    return now > new Date(conf.date + "T23:59:59");
  }

  /**
   * Em que fase um PvP está em relação ao Current CM:
   * "past" (antes dele), "current" (é ele) ou "future" (depois dele).
   * Sem Current CM definido, tudo é "past".
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
    for (const cm of cms) {
      const d = data[cm.id];
      if (!d || !isCounted(cm.id)) continue;
      if (pl[d.pl] !== undefined) pl[d.pl]++;
      const sc = ratingScore(d.rat);
      if (sc > 0) scores.push({ id: cm.id, sc, pl: d.pl });
      for (const t of d.team || []) {
        if (!t.n || t.ro === "Debuffer") continue;
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
      aces: top(aces, Infinity), // todas as Aces usadas, da mais para a menos usada
      cards: top(cards, 5),
      borrow: top(borrow, 5),
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

  /** Garante que um PvP salvo tenha sempre 3 Umas, 6 pais, 6 cartas e 4 rodadas, com tipos corretos. */
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
        `Estes dados são de uma versão mais nova do site (formato ${v}). Atualize a página.`,
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
          t.d.every((x) => !x),
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
      throw new Error("Esse arquivo não é um backup do CM Comps.");
    }
    if (!j || j.app !== "cmcomps" || typeof j.data !== "object")
      throw new Error("Esse arquivo não é um backup do CM Comps.");
    return migrate(j);
  }

  return {
    PLACES,
    SCHEMA,
    BORROWED_SLOT,
    WINS_TOTAL,
    dist,
    isValidRound,
    ratingScore,
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
