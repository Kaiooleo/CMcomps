/*
 * CM Comps — telas e interação.
 * As regras e os cálculos ficam em logic.js (window.CMLogic); os dados em data.js.
 */
(() => {
  const L = window.CMLogic;
  const CAT = window.CM_CATALOG;
  const ATLAS = window.CM_ATLAS;
  // Current PvP: o primeiro PvP cuja final ainda não passou (datas em data.js)
  const CONF = L.resolveCurrent(
    CAT.cms,
    window.CM_SCHEDULE || {},
    window.CM_CONFIG || {},
  );
  // As datas do calendário (GameTora) são o último dia do PvP; a final em si
  // começa na véspera (às 19h de Brasília) e fica aberta até esse último dia.
  const FINAL_DAY = CONF.date ? L.addDays(CONF.date, -1) : null;
  const finalLabel = () =>
    FINAL_DAY ? fmtDate(FINAL_DAY) + (CONF.est ? " (estimated)" : "") : "";

  const STORAGE_KEY = "cmcomps:data";
  const LEGACY_KEY = "cmcomps:data:v1"; // versão inicial (mapa puro, sem número de formato)
  const SAVE_DELAY = 500;

  const STYLES = [
    "Runaway",
    "Front Runner",
    "Pace Chaser",
    "Late Surger",
    "End Closer",
  ];
  /** Classe de cor de cada estilo (mesmas cores da planilha). */
  const ST_CLASS = {
    Runaway: "st-runaway",
    "Front Runner": "st-front",
    "Pace Chaser": "st-pace",
    "Late Surger": "st-late",
    "End Closer": "st-end",
  };
  const stClass = (st) => ST_CLASS[st] || "";
  const ROLES = ["Ace", "Debuffer"];
  const TYPES = ["Speed", "Stamina", "Power", "Guts", "Wit", "Pal", "Group"];
  const PAR = ["P1", "GP1.1", "GP1.2", "P2", "GP2.1", "GP2.2"];
  const { PLACES } = L;

  const CHAR = new Map(CAT.chars.map((c) => [c.n, c]));
  const CARD = new Map(CAT.cards.map((c) => [c.k, c]));
  const CM_BY_ID = new Map(CAT.cms.map((c, i) => [c.id, { ...c, i }]));

  /* ---------- utilidades ---------- */
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const pct = (x) => (Math.round(x * 1000) / 10).toLocaleString("en-US") + "%";
  const plClass = (p) => (p ? "pl-" + p.replace(" ", "") : "");
  const typeVar = (t) =>
    "var(--t-" + (t || "").toLowerCase() + ",var(--muted))";
  const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const fmtShort = (d) =>
    d ? `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}` : "";
  const fmtDate = (d) => (d ? `${fmtShort(d)}, ${d.slice(0, 4)}` : "");
  const cond = (c) => [c.se, c.we, c.gr].filter(Boolean).map(esc).join(" · ");
  const isLoh = (id) => id.startsWith("LOH");
  // distância: pelos metros; sem metros ainda (PvP só anunciado), pela categoria "dc"
  const distOf = (c) => L.dist(c.m) || c.dc || "";
  /** "Pista · 2400m · Turf · Medium · Left", pulando o que ainda não se sabe. */
  const courseLine = (c) =>
    [c.tr, c.m ? `${c.m}m` : "", c.su, distOf(c), c.dir]
      .filter(Boolean)
      .map(esc)
      .join(" · ");
  const status = (text, isError = false) => {
    const s = $("#status");
    s.textContent = text;
    s.classList.toggle("err", isError);
  };

  /* ---------- Current PvP (definido em data.js) ---------- */
  const phase = (id) => L.phase(CAT.cms, CONF, id);
  const counted = (id) => L.counted(CAT.cms, CONF, id);
  const finalPassed = () => L.finalPassed(CONF);

  /* ---------- dados do usuário ---------- */
  let DATA = {};
  const record = (id) => DATA[id] || (DATA[id] = L.blankRecord());

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return L.migrate(JSON.parse(raw));
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const data = L.migrate(JSON.parse(legacy));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(L.serialize(data)));
        localStorage.removeItem(LEGACY_KEY);
        return data;
      }
    } catch (e) {
      status(
        e && e.message && e.message.includes("newer version")
          ? e.message
          : "Could not read the data saved in this browser.",
        true,
      );
    }
    return {};
  }

  let saveTimer = null;
  function save() {
    status("Saving…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, SAVE_DELAY);
  }
  function flush() {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(L.serialize(DATA)));
      status("Saved in this browser");
    } catch (_) {
      status(
        "This browser blocked saving. Use “Download backup” so you don't lose your data.",
        true,
      );
    }
  }
  // não perde a última mudança se a página for fechada logo depois de editar
  window.addEventListener("pagehide", () => saveTimer && flush());

  /* ---------- imagens (folhas em sp/) ---------- */
  /**
   * Imagem de uma Uma ou carta. Artes e cartas são arquivos próprios em alta
   * (carregados só quando aparecem na tela); ícones vêm de folhas em sp/.
   */
  function spr(file, alt) {
    const entry = ATLAS[file];
    if (typeof entry === "string")
      return `<img class="spr" src="${entry}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
    const [url, c, r, C, R] = entry;
    const x = C > 1 ? (c / (C - 1)) * 100 : 0;
    const y = R > 1 ? (r / (R - 1)) * 100 : 0;
    return `<span class="spr" role="img" aria-label="${esc(alt)}" style="background-image:url(${url});background-size:${C * 100}% ${R * 100}%;background-position:${x}% ${y}%"></span>`;
  }
  function initials(name) {
    return esc(
      String(name || "")
        .replace(/\(.*?\)/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase(),
    );
  }
  /** Arte da Uma (`big`) ou ícone; cai para as iniciais se não houver imagem. */
  function charImg(name, big = false) {
    if (!name) return "";
    const c = CHAR.get(name);
    const order = big ? [c && c.s, c && c.i] : [c && c.i, c && c.s];
    const file = order.find((f) => f && ATLAS[f]);
    return file
      ? spr(file, name)
      : `<span class="ph" title="${esc(name)}">${initials(name)}</span>`;
  }
  function cardImg(key) {
    if (!key) return "";
    const c = CARD.get(key);
    if (c && ATLAS[c.im]) return spr(c.im, `${c.n} – ${c.t}`);
    const name = c ? c.n : key.split("\n")[0];
    return `<span class="ph" style="background:${c ? typeVar(c.ty) : "var(--surface-2)"};color:#fff" title="${esc(key)}">${esc(name)}</span>`;
  }

  /* ---------- navegação ---------- */
  function setNav(tab) {
    $("#back").hidden = !/^#(cm|rank|uma)-/.test(location.hash);
    for (const id of ["resumo", "cms"])
      $("#nav-" + id).toggleAttribute("aria-current", id === tab);
    $("#nav-" + tab).setAttribute("aria-current", "page");
  }
  function route() {
    const h = location.hash.slice(1);
    if (h.startsWith("cm-") && CM_BY_ID.has(h.slice(3)))
      return viewCM(h.slice(3));
    const uma = /^uma-(.+)-([123])$/.exec(h);
    if (uma && CM_BY_ID.has(uma[1])) return viewUma(uma[1], uma[2] - 1);
    if (h === "cms") return viewList();
    if (RANKINGS[h]) return viewRanking(h);
    return viewResumo();
  }

  /* ---------- Resumo ---------- */
  function currentHero() {
    const cm = CONF.cur && CM_BY_ID.get(CONF.cur);
    if (!cm) return "";
    const d = DATA[cm.id];
    const passed = finalPassed();
    const days = L.daysToFinal({ date: FINAL_DAY });
    const when = passed
      ? `Final on ${finalLabel()} · done`
      : days != null
        ? `Final on ${finalLabel()} · ${days <= 0 ? "today" : days === 1 ? "tomorrow" : `${days} days left`}`
        : "Final date not set";
    const team = d ? d.team.filter((t) => t.n) : [];
    const teamHtml = team.length
      ? team
          .map(
            (t) =>
              `<a class="ct ${t.ro === "Debuffer" ? "debuff" : ""}" href="#cm-${esc(cm.id)}"><span class="av">${charImg(t.n, true)}</span><b>${esc(t.n)}</b><small>${esc(t.ro)}${t.st ? ` · <span class="${stClass(t.st)}">${esc(t.st)}</span>` : ""}</small></a>`,
          )
          .join("")
      : `<a class="btn primary" href="#cm-${esc(cm.id)}" style="align-self:center;justify-self:start">Build team</a>`;
    return `<section class="curhero">
    <a class="ch-main" href="#cm-${esc(cm.id)}">
      <div class="label" style="color:var(--accent)">Current PvP</div>
      <h1><span class="cmid ${isLoh(cm.id) ? "loh" : ""}">${esc(cm.id)}</span> <span class="sc">· ${esc(cm.sc)}</span></h1>
      <div class="ln num">${courseLine(cm)}</div>
      ${cond(cm) ? `<div class="ln">${cond(cm)}</div>` : ""}
      <div class="when"><span class="chip cur">${when}</span>${d && d.pl ? ` <span class="chip ${plClass(d.pl)}">${esc(d.pl)}</span>` : ""}</div>
    </a>
    <div class="ch-team">${teamHtml}</div>
  </section>`;
  }

  function scoreChart(scores, avg) {
    if (!scores.length)
      return '<p class="empty">WR shows up here once you fill in the rounds of a PvP.</p>';
    const W = 640,
      H = 200,
      LEFT = 34,
      RIGHT = 8,
      TOP = 12,
      BOTTOM = 28;
    const bw = (W - LEFT - RIGHT) / scores.length;
    const y = (v) => TOP + (1 - v) * (H - TOP - BOTTOM);
    const every = Math.max(1, Math.ceil(scores.length / 12));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="WR by PvP">`;
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      s += `<line x1="${LEFT}" x2="${W - RIGHT}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${LEFT - 6}" y="${y(t) + 3}" text-anchor="end">${t * 100}%</text>`;
    scores.forEach((d, i) => {
      const x = LEFT + i * bw;
      const w = Math.max(3, bw - 4);
      const h = y(0) - y(d.sc);
      const r = Math.min(4, w / 2, h);
      s += `<path d="M${x + 2},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z" fill="${d.pl === "1st" ? "var(--accent)" : "var(--faint)"}" />`;
      s += `<rect class="hit" x="${x}" y="${TOP}" width="${bw}" height="${H - TOP - BOTTOM}" fill="transparent" data-i="${i}"/>`;
      if (i % every === 0)
        s += `<text x="${x + bw / 2}" y="${H - BOTTOM + 14}" text-anchor="middle">${esc(d.id)}</text>`;
    });
    s += `<line x1="${LEFT}" x2="${W - RIGHT}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--fg)" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${W - RIGHT}" y="${y(avg) - 5}" text-anchor="end" style="fill:var(--fg);font-weight:700">Average WR ${pct(avg)}</text>`;
    return s + '</svg><div class="tip" hidden></div>';
  }

  /* ---------- rankings (top 5 no Resumo, lista completa em página própria) ---------- */
  const TOP = 5;
  const RANKINGS = {
    "rank-aces": { title: "Umas (Ace)", key: "aces" },
    "rank-cards": { title: "Most Used Cards", key: "cards" },
    "rank-borrowed": {
      title: "Most Borrowed Cards",
      key: "borrow",
      pink: true,
    },
    "rank-parents": { title: "Most Used Parents", key: "parents" },
    "rank-grandparents": {
      title: "Most Used Grandparents",
      key: "grandparents",
    },
    "rank-wincards": { title: "Cards in 1st Places", key: "winCards" },
  };

  /** Barras de WR (0–100%): [{ label, v, sub, cls }]; sem dado, a barra fica vazia. */
  function wrBars(rows) {
    if (!rows.some((r) => r.v != null))
      return '<p class="empty">Nothing recorded yet.</p>';
    return `<div class="bars wrbars">${rows
      .map(
        (r) =>
          `<div class="bar ${r.cls || ""}"><span>${esc(r.label)}</span><span class="t"><i style="width:${(r.v || 0) * 100}%"></i></span><b class="num">${r.v != null ? pct(r.v) : "–"}</b><small>${r.sub || ""}</small></div>`,
      )
      .join("")}</div>`;
  }

  function panelHead(id, total) {
    const r = RANKINGS[id];
    const more =
      total > TOP
        ? `<a class="more" href="#${id}">See all (${total}) →</a>`
        : "";
    return `<div class="phead"><div class="label"${r.pink ? ' style="color:var(--pink)"' : ""}>${r.title}</div>${more}</div>`;
  }

  function aceGrid(entries, start = 0) {
    return `<div class="aces">${entries
      .map(
        ([k, n], i) =>
          `<div class="ace"><span class="av">${charImg(k, true)}<b class="num">${n}</b>${start ? `<i class="rk">${start + i}</i>` : ""}</span><span>${esc(k)}</span></div>`,
      )
      .join("")}</div>`;
  }

  function viewRanking(id) {
    setNav("resumo");
    const r = RANKINGS[id];
    const list = L.computeStats(CAT.cms, DATA, counted)[r.key];
    const body = !list.length
      ? '<p class="empty">Nothing recorded yet.</p>'
      : ["aces", "parents", "grandparents"].includes(r.key)
        ? aceGrid(list, 1)
        : podium(list, r.key === "borrow", true);
    $("#app").innerHTML = `
  <section class="lhead"><h1${r.pink ? ' style="color:var(--pink)"' : ""}>${r.title}</h1><span class="chip">${list.length}</span></section>
  <section class="panel">${body}</section>`;
  }

  function podium(entries, borrowed, wrap = false) {
    if (!entries.length) return '<p class="empty">Nothing recorded yet.</p>';
    return `<div class="podium${wrap ? " wrap" : ""}">${entries
      .map(([k, n], i) => {
        const c = CARD.get(k);
        return `<div class="pc ${borrowed ? "borrow" : ""}"><div class="art">${cardImg(k)}<span class="rk">${i + 1}</span><span class="ct num">${n}×</span></div><div class="nm">${esc(c ? c.n : k.split("\n")[0])}${c ? `<small>${esc(c.t)}</small>` : ""}</div></div>`;
      })
      .join("")}</div>`;
  }

  function viewResumo() {
    setNav("resumo");
    const s = L.computeStats(CAT.cms, DATA, counted);
    const empty = s.tot === 0 && !s.aces.length && !s.scores.length;
    const styleMax = Math.max(1, ...Object.values(s.styles));
    $("#app").innerHTML = `
  ${currentHero()}
  ${empty ? `<div class="banner"><p>No results recorded yet. Open a PvP, build your team and set your placement to see stats here.</p><a class="btn primary" href="#cms">See PvPs</a></div>` : ""}
  <section class="hero">
    <div class="panel perf">
      <div class="label">Placed · Win rate</div>
      <div class="wr"><b class="num">${pct(s.wr)}</b><span>${s.pl["1st"]} 1st / ${s.tot} finals</span></div>
      <div class="medals">${PLACES.map((p) => `<div class="medal"><b class="num">${s.pl[p]}</b><span class="chip ${plClass(p)}">${p}</span></div>`).join("")}</div>
      <div class="facts">
        <div><span class="label">Average WR</span><b class="num">${s.scores.length ? pct(s.avg) : "–"}</b></div>
        <div><span class="label">Best WR</span><b class="num">${s.best ? pct(s.best.sc) : "–"}</b>${s.best ? `<a href="#cm-${esc(s.best.id)}">${esc(s.best.id)}</a>` : ""}</div>
        <div><span class="label">Worst WR</span><b class="num">${s.worst ? pct(s.worst.sc) : "–"}</b>${s.worst ? `<a href="#cm-${esc(s.worst.id)}">${esc(s.worst.id)}</a>` : ""}</div>
      </div>
    </div>
    <div class="panel"><div class="label">WR by PvP <span style="text-transform:none;letter-spacing:0;font-weight:500">· blue = 1st</span></div>
      <div class="chart" id="chart" style="margin-top:12px">${scoreChart(s.scores, s.avg)}</div>
    </div>
  </section>
  <section class="row2">
    <div class="panel">${panelHead("rank-aces", s.aces.length)}
      ${s.aces.length ? aceGrid(s.aces.slice(0, TOP)) : '<p class="empty">Nothing recorded yet.</p>'}
    </div>
    <div class="panel"><div class="label">Style (Ace)</div>
      <div class="bars">${STYLES.map((st) => {
        const n = s.styles[st] || 0;
        return `<div class="bar ${stClass(st)}"><span>${st}</span><span class="t"><i style="width:${(n / styleMax) * 100}%"></i></span><b class="num">${n}</b></div>`;
      }).join("")}</div>
    </div>
  </section>
  <section class="row2 even">
    <div class="panel"><div class="label">WR by distance</div>
      ${wrBars(
        ["Sprint", "Mile", "Medium", "Long", "Dirt"].map((k) => {
          const b = s.byDist[k];
          return {
            label: k,
            v: b ? b.sum / b.n : null,
            sub: b ? `${b.n} PvP${b.n > 1 ? "s" : ""}` : "",
          };
        }),
      )}
    </div>
    <div class="panel"><div class="label">WR by scenario</div>
    ${wrBars(s.byScenario.map((r) => ({ label: r.sc, v: r.avg, sub: `${r.n} PvP${r.n > 1 ? "s" : ""}` })))}
    </div>
  </section>
  <section class="panel">${panelHead("rank-cards", s.cards.length)}${podium(s.cards.slice(0, TOP), false)}</section>
  <section class="panel">${panelHead("rank-borrowed", s.borrow.length)}${podium(s.borrow.slice(0, TOP), true)}</section>
  <section class="row2 even">
    <div class="panel">${panelHead("rank-parents", s.parents.length)}
      ${s.parents.length ? aceGrid(s.parents.slice(0, TOP)) : '<p class="empty">Nothing recorded yet.</p>'}
    </div>
    <div class="panel">${panelHead("rank-grandparents", s.grandparents.length)}
      ${s.grandparents.length ? aceGrid(s.grandparents.slice(0, TOP)) : '<p class="empty">Nothing recorded yet.</p>'}
    </div>
  </section>
  <section class="panel">${panelHead("rank-wincards", s.winCards.length)}${podium(s.winCards.slice(0, TOP), false)}</section>`;

    const chart = $("#chart");
    const tip = chart && chart.querySelector(".tip");
    if (!tip) return;
    chart.querySelectorAll(".hit").forEach((bar) => {
      const d = s.scores[+bar.dataset.i];
      bar.style.cursor = "pointer";
      bar.addEventListener("mouseenter", () => {
        const box = chart.getBoundingClientRect();
        const rb = bar.getBoundingClientRect();
        tip.hidden = false;
        tip.textContent = `${d.id} · ${pct(d.sc)}${d.pl ? " · " + d.pl : ""}`;
        tip.style.left = rb.left - box.left + rb.width / 2 + "px";
        tip.style.top = rb.top - box.top + (1 - d.sc) * rb.height + "px";
      });
      bar.addEventListener("mouseleave", () => (tip.hidden = true));
      bar.addEventListener("click", () => (location.hash = "cm-" + d.id));
    });
  }

  /* ---------- lista de PvPs ---------- */
  let listQuery = "";
  let listFilter = "all";

  function tileHtml(c) {
    const d = DATA[c.id];
    const team = d ? d.team.filter((t) => t.n) : [];
    const ph = phase(c.id);
    const title = c.nm && c.nm !== "League of Heroes" ? c.nm : c.sc;
    let chips = "";
    if (ph === "current")
      chips += `<span class="chip cur">Current PvP${CONF.date ? " · final " + fmtShort(FINAL_DAY) + (CONF.est ? " (est.)" : "") : ""}</span>`;
    if (ph === "future") chips += '<span class="chip none">Not counted</span>';
    if (d && d.pl)
      chips += `<span class="chip ${plClass(d.pl)}">${esc(d.pl)}</span>`;
    else if (ph !== "future")
      chips += `<span class="chip none">${team.length ? "No result" : "Empty"}</span>`;
    return `<a class="tile ${ph === "future" ? "future" : ""} ${ph === "current" ? "current" : ""}" href="#cm-${esc(c.id)}">
      <div class="top"><h2><span class="cmid ${isLoh(c.id) ? "loh" : ""}">${esc(c.id)}</span> <span class="sc">· ${esc(title)}</span></h2>${chips}</div>
      <div class="ln num">${courseLine(c)}</div>
      <div class="cond"><b>${esc(c.sc)}</b>${cond(c) ? " · " + cond(c) : ""}</div>
      <div class="faces">${team.map((t) => `<span class="face ${t.ro === "Debuffer" ? "debuff" : ""}" title="${esc(t.n)} · ${esc(t.ro)}">${charImg(t.n, true)}</span>`).join("")}</div>
    </a>`;
  }

  function viewList() {
    setNav("cms");
    const q = listQuery.toLowerCase();
    const rows = CAT.cms.filter(
      (c) =>
        (listFilter === "all" || (listFilter === "loh") === isLoh(c.id)) &&
        (!q ||
          [c.id, c.nm, c.sc, c.ab, c.tr, c.su, distOf(c), c.m]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
    const filters = [
      ["all", "All"],
      ["cm", "CM"],
      ["loh", "LOH"],
    ]
      .map(
        ([k, t]) =>
          `<button type="button" class="tog" data-f="${k}" aria-pressed="${listFilter === k}">${t}</button>`,
      )
      .join("");
    $("#app").innerHTML = `
  <section class="lhead"><h1>PvP</h1>
    <div class="seg" role="group" aria-label="Type">${filters}</div>
    <input class="search" id="lq" type="search" placeholder="Search by CM, scenario, track, distance…" value="${esc(listQuery)}"></section>
  <section class="tiles">${rows.length ? rows.map(tileHtml).join("") : '<p class="empty">No PvP found.</p>'}</section>`;

    const input = $("#lq");
    input.addEventListener("input", () => {
      listQuery = input.value;
      const pos = input.selectionStart;
      viewList();
      const again = $("#lq");
      again.focus();
      again.setSelectionRange(pos, pos);
    });
    document.querySelectorAll("[data-f]").forEach((b) =>
      b.addEventListener("click", () => {
        listFilter = b.dataset.f;
        viewList();
      }),
    );
  }

  /* ---------- página de um PvP ---------- */
  const ROUND_LABELS = [
    "Round 1 · Day 1",
    "Round 1 · Day 2",
    "Round 2 · Day 1",
    "Round 2 · Day 2",
  ];
  /** " · 52 / 65 wins" com o que já foi preenchido nos rounds. */
  const raceCount = (rat) => {
    const { wins, races } = L.roundTotals(rat);
    return races ? ` · ${wins} / ${races} wins` : "";
  };
  const umaWr = (t, total) => (t.w != null ? pct(t.w / total) : "–");

  function currentNote(id) {
    if (phase(id) !== "current") return "";
    return `<div class="banner sched"><p><b>Current PvP.</b> ${finalPassed() ? "This PvP is over and it now counts in the stats." : `It counts in the stats once this PvP ends${CONF.date ? ` on ${fmtDate(CONF.date)}` : ""}${CONF.est ? ` (estimated date, plus ${L.MARGIN_DAYS} days of margin)` : ""}.`}</p></div>`;
  }

  function pvpHead(cm, sub = "") {
    const prev = CAT.cms[cm.i - 1];
    const next = CAT.cms[cm.i + 1];
    const meta = [
      cm.tr,
      cm.m ? `${cm.m}m` : "",
      cm.su,
      distOf(cm),
      cm.dir,
      cm.se,
      cm.we,
      cm.gr,
    ]
      .filter(Boolean)
      .map((x) => `<span class="chip">${esc(x)}</span>`)
      .join("");
    const nav = sub
      ? ""
      : `<div class="nav2"><button class="btn primary" id="share" type="button">Share</button>${prev ? `<a class="btn" href="#cm-${esc(prev.id)}">← ${esc(prev.id)}</a>` : ""}<a class="btn" href="#cms">All PvP</a>${next ? `<a class="btn" href="#cm-${esc(next.id)}">${esc(next.id)} →</a>` : ""}</div>`;
    return `<section class="cmhead">
    <div><div class="label">${esc(cm.sc)}${cm.nm ? " · " + esc(cm.nm) : ""}</div><h1><a class="cmid ${isLoh(cm.id) ? "loh" : ""}" href="#cm-${esc(cm.id)}">${esc(cm.id)}</a>${sub}</h1></div>
    <div class="meta">${meta}</div>
    ${nav}
  </section>`;
  }

  /**
   * Resumo dos parents como no jogo: cada parent maior, com os dois avós
   * menores ao lado, ligados a ele por uma linha.
   * Ordem em `p`: P1, GP1.1, GP1.2, P2, GP2.1, GP2.2.
   */
  function parentsSummary(p) {
    const face = (name, cls, label) =>
      `<span class="${cls} ${name ? "" : "off"}" title="${esc(label + (name ? ": " + name : ""))}">${name ? charImg(name) : ""}</span>`;
    const group = (i, n) =>
      `<span class="pg pg${n}">${face(p[i], "p", "P" + n)}<span class="gps">${face(p[i + 1], "g", `GP${n}.1`)}${face(p[i + 2], "g", `GP${n}.2`)}</span></span>`;
    return `<span class="pgroups">${group(0, 1)}${group(3, 2)}</span>`;
  }

  /** Card resumido de uma Uma na página do PvP; clicar abre a página dela. */
  function umaCardHtml(cmId, t, k) {
    const total = L.winsTotal(DATA[cmId] && DATA[cmId].rat);
    const href = `#uma-${esc(cmId)}-${k + 1}`;
    if (!t.n)
      return `<a class="panel umacard empty" href="${href}"><span class="plus">+</span><span>Choose Uma ${k + 1}</span></a>`;
    const mini = (items, img, borrowedAt = -1) =>
      items
        .map(
          (x, j) =>
            `<span class="m ${j === borrowedAt ? "borrow" : ""} ${x ? "" : "off"}">${x ? img(x) : ""}</span>`,
        )
        .join("");
    return `<a class="panel umacard ${t.ro === "Debuffer" ? "debuff" : ""}" href="${href}" title="Open ${esc(t.n)}">
    <span class="art">${charImg(t.n, true)}</span>
    <span class="info">
      <b class="nm">${esc(t.n)}</b>
      <span class="tags"><span class="chip ${t.ro === "Debuffer" ? "deb" : "ace"}">${esc(t.ro)}</span>${t.st ? `<span class="chip ${stClass(t.st)}">${esc(t.st)}</span>` : ""}</span>
      <span class="wrbox"><span class="label">WR</span><b class="num">${umaWr(t, total)}</b><small>${t.w != null ? `${t.w} / ${total} wins` : "no wins"}</small></span>
    </span>
    <span class="minis">
      <span class="label">Parents</span>${parentsSummary(t.p)}
      <span class="label">Deck</span><span class="mrow deckrow">${mini(t.d, cardImg, L.BORROWED_SLOT)}</span>
    </span>
  </a>`;
  }

  function viewCM(id) {
    setNav("cms");
    const cm = CM_BY_ID.get(id);
    const d = record(id);
    const total = L.ratingScore(d.rat);
    $("#app").innerHTML = `
  ${pvpHead(cm)}
  ${currentNote(id)}
  <section class="umacards">${d.team.map((t, k) => umaCardHtml(id, t, k)).join("")}</section>
  <section class="result">
    <div class="panel"><div class="label">Final</div>
      <div class="places" role="group" aria-label="Final">${[...PLACES, ""].map((p) => `<button type="button" class="p-${p ? p.replace(" ", "") : "none"}" data-pl="${p}" aria-pressed="${d.pl === p}">${p || "No result"}</button>`).join("")}</div>
    </div>
    <div class="panel"><div class="label">Rounds</div>
      <div class="rounds">${d.rat
        .map(
          (
            r,
            k,
          ) => `<label class="day"><span class="label">${ROUND_LABELS[k]}</span>
          <input id="rat-${k}" autocomplete="off" value="${esc(r)}" class="${L.isValidRound(r) ? "" : "bad"}">
          <span class="num dwr" id="dwr-${k}">${r && L.isValidRound(r) ? pct(L.ratingScore([r])) : ""}</span></label>`,
        )
        .join("")}</div>
      <div class="score"><b class="num" id="score">${total ? pct(total) : "–"}</b><span style="color:var(--muted)">WR total<span id="score-n">${raceCount(d.rat)}</span></span></div>
    </div>
  </section>`;

    $("#share").addEventListener("click", () => openShare(id));
    document.querySelectorAll("[data-pl]").forEach((b) =>
      b.addEventListener("click", () => {
        d.pl = b.dataset.pl;
        save();
        viewCM(id);
      }),
    );
    d.rat.forEach((_, k) => {
      const input = $("#rat-" + k);
      input.addEventListener("input", () => {
        const v = input.value.trim();
        const ok = L.isValidRound(v);
        input.classList.toggle("bad", !ok);
        d.rat[k] = v;
        save();
        $("#dwr-" + k).textContent = v && ok ? pct(L.ratingScore([v])) : "";
        const s = L.ratingScore(d.rat);
        $("#score").textContent = s ? pct(s) : "–";
        $("#score-n").textContent = raceCount(d.rat);
      });
    });
  }

  /* ---------- página de uma Uma (dentro de um PvP) ---------- */
  function viewUma(id, k) {
    setNav("cms");
    const cm = CM_BY_ID.get(id);
    const d = record(id);
    const t = d.team[k];
    const tabs = d.team
      .map(
        (u, j) =>
          `<a class="tog" href="#uma-${esc(id)}-${j + 1}" aria-pressed="${j === k}">${u.n ? esc(u.n) : "Uma " + (j + 1)}</a>`,
      )
      .join("");
    $("#app").innerHTML = `
  ${pvpHead(cm, ` <span class="sub">· Uma ${k + 1}</span>`)}
  <nav class="seg umatabs" aria-label="Umas in this PvP">${tabs}</nav>
  <section>${runnerHtml(t, k, true, L.winsTotal(d.rat))}</section>`;
    bindRunner(
      document.querySelector(".runner"),
      t,
      k,
      () => viewUma(id, k),
      L.winsTotal(d.rat),
    );
    // abas: troca de Uma sem criar um passo a mais no "voltar" do navegador
    document.querySelectorAll(".umatabs a").forEach((tab) =>
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        location.replace(tab.getAttribute("href"));
      }),
    );
  }

  /** Liga os botões e campos de um card de Uma editável. */
  function bindRunner(card, t, k, rerender, total = L.WINS_TOTAL) {
    const change = (fn, redraw = true) => {
      fn();
      save();
      if (redraw) rerender();
    };
    const pickUma = () =>
      openPicker("char", t.n, `Uma ${k + 1}`, (v) => change(() => (t.n = v)));
    card.querySelector(".main").addEventListener("click", pickUma);
    card.querySelector(".rname").addEventListener("click", pickUma);
    card
      .querySelector("[name=ro]")
      .addEventListener("change", (e) => change(() => (t.ro = e.target.value)));
    card.querySelector("[name=st]").addEventListener("change", (e) =>
      change(() => {
        t.st = e.target.value || null;
        e.target.className = stClass(t.st);
      }, false),
    );
    const wins = card.querySelector("[name=w]");
    wins.addEventListener("input", () => {
      const v = parseInt(wins.value, 10);
      change(() => (t.w = isNaN(v) ? null : v), false);
      card.querySelector(".wrp").textContent = umaWr(t, total);
    });
    card.querySelectorAll("[data-p]").forEach((b) =>
      b.addEventListener("click", () => {
        const j = +b.dataset.p;
        // cada opção mostra a affinity que ela daria nesse lugar, da maior para
        // a menor: parent → com a Uma; GP → com a Uma e o parent desse lado
        const main = charaIdOf(t.n);
        const isParent = j === 0 || j === 3;
        const parent = isParent ? null : charaIdOf(t.p[j < 3 ? 0 : 3]);
        const score =
          main && (isParent || parent)
            ? (name) =>
                L.affinityOf(
                  [main, ...(parent ? [parent] : []), charaIdOf(name)],
                  window.CM_AFFINITY,
                )
            : null;
        openPicker(
          "char",
          t.p[j],
          `${PAR[j]} · ${t.n || "Uma " + (k + 1)}`,
          (v) => change(() => (t.p[j] = v)),
          score,
        );
      }),
    );
    card
      .querySelectorAll("[data-lb]")
      .forEach((sel) =>
        sel.addEventListener("change", () =>
          change(() => (t.lb[+sel.dataset.lb] = L.lbValue(sel.value)), false),
        ),
      );
    card.querySelectorAll("[data-d]").forEach((b) =>
      b.addEventListener("click", () => {
        const j = +b.dataset.d;
        const title =
          j === L.BORROWED_SLOT ? "Borrowed card" : `Support card ${j + 1}`;
        openPicker("card", t.d[j], title, (v) =>
          change(() => {
            // carta nova entra como MLB; dá para trocar depois
            if (v !== t.d[j]) t.lb[j] = v ? 4 : null;
            t.d[j] = v;
          }),
        );
      }),
    );
  }

  /** Id do personagem (o mesmo em todas as versões dela) pelo nome no catálogo. */
  const charaIdOf = (name) =>
    name && CHAR.has(name) ? L.charaId(CHAR.get(name).i) : null;

  /** Affinity base da Uma com os parents: total em destaque e cada segmento. */
  function affinityHtml(t) {
    const a = L.affinity(
      charaIdOf(t.n),
      t.p.map(charaIdOf),
      window.CM_AFFINITY,
    );
    const any = a.parts.some((p) => p.value !== null);
    const rows = a.parts
      .map(
        (p) =>
          `<li class="${p.value === null ? "off" : ""}"><span>${esc(p.label)}</span><b class="num">${p.value ?? "—"}</b></li>`,
      )
      .join("");
    return `<section class="affinity" aria-label="Affinity">
      <div class="afftot ${any ? "" : "off"}"><span class="label">Affinity</span><b class="num">${any ? a.total : "—"}</b>${any ? `<span class="mark" title="${a.mark === "◎" ? "151 or more" : a.mark === "○" ? "51 to 150" : "up to 50"}">${a.mark}</span>` : ""}</div>
      <ul class="affparts">${rows}</ul>
    </section>`;
  }

  function runnerHtml(t, k, big = false, total = L.WINS_TOTAL) {
    const slot = (cls, inner, attrs, label, empty, extra = "") =>
      `<button type="button" class="slot ${cls} ${inner ? "filled" : ""}" ${attrs} aria-label="${esc(label)}" title="${esc(label)}">${inner || empty}${extra}</button>`;
    const parent = (j) =>
      slot(
        j === 0 || j === 3 ? "par" : "gp",
        t.p[j] ? charImg(t.p[j]) : "",
        `data-p="${j}"`,
        `${PAR[j]}: ${t.p[j] || "empty"}`,
        PAR[j],
      );
    const lbSelect = (j) =>
      `<select class="lb" data-lb="${j}" aria-label="Limit break of card ${j + 1}" ${t.d[j] ? "" : 'disabled style="visibility:hidden"'}>${L.LB_LABELS.map((x, n) => `<option value="${n}" ${(t.lb[j] ?? 4) === n ? "selected" : ""}>${x}</option>`).join("")}</select>`;
    const deck = t.d
      .map((c, j) => {
        const borrowed = j === L.BORROWED_SLOT;
        const card = slot(
          borrowed ? "borrow" : "",
          c ? cardImg(c) : "",
          `data-d="${j}"`,
          `${borrowed ? "Borrowed card" : "Card " + (j + 1)}: ${c ? c.replace("\n", " ") : "empty"}`,
          borrowed ? "" : "+",
          borrowed ? '<span class="tag">BORROW</span>' : "",
        );
        return `<div class="dcell">${card}${big ? lbSelect(j) : ""}</div>`;
      })
      .join("");
    return `<article class="panel runner ${big ? "big" : ""} ${t.ro === "Debuffer" ? "debuff" : ""}" data-k="${k}">
    <div class="rtop">${slot("main", t.n ? charImg(t.n, true) : "", "", t.n ? `Change ${t.n}` : "Choose Uma", '<span class="plus">+</span>')}
      <div><button type="button" class="rname">${t.n ? esc(t.n) : `<span style="color:var(--muted)">Choose Uma ${k + 1}</span>`}</button>
        <div class="fields">
          <label class="nolab"><select name="ro" aria-label="Ace or Debuffer">${ROLES.map((r) => `<option ${t.ro === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
          <label class="nolab"><select name="st" class="${stClass(t.st)}" aria-label="Style"><option value="">Style —</option>${STYLES.map((s) => `<option ${t.st === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label>Wins<span class="wins"><input name="w" type="number" min="0" max="${total}" inputmode="numeric" value="${t.w ?? ""}" aria-label="Wins (out of ${total})"><span class="of">/ ${total}</span></span></label>
          <div class="wrbox"><span class="label">WR</span><b class="num wrp">${umaWr(t, total)}</b></div>
        </div></div></div>
    <div class="lower">
      <div><div class="label">Parents</div>
        <div class="tree">
          ${parent(0)}${parent(3)}
          ${parent(1)}${parent(2)}${parent(4)}${parent(5)}
        </div>${big ? affinityHtml(t) : ""}</div>
      <div><div class="label">Deck</div><div class="deck">${deck}</div></div>
    </div>
  </article>`;
  }

  /* ---------- seletor de Uma / carta ---------- */
  let picker = null;
  const pickerState = { q: "", rarity: new Set(), type: new Set() };

  function openPicker(kind, current, title, onPick, score = null) {
    picker = { kind, onPick, score };
    pickerState.q = "";
    $("#pk-q").value = "";
    $("#pk-title").textContent = title;
    $("#pk-remove").hidden = !current;
    const fil = $("#pk-fil");
    fil.hidden = kind !== "card";
    fil.innerHTML =
      kind === "card"
        ? ["SSR", "SR"]
            .map(
              (r) =>
                `<button type="button" class="tog" data-rar="${r}" aria-pressed="${pickerState.rarity.has(r)}">${r}</button>`,
            )
            .join("") +
          '<span style="width:8px"></span>' +
          TYPES.map(
            (t) =>
              `<button type="button" class="tog" data-ty="${t}" aria-pressed="${pickerState.type.has(t)}"><span class="ty" style="background:${typeVar(t)}"></span>${t}</button>`,
          ).join("")
        : "";
    fil.querySelectorAll(".tog").forEach((b) =>
      b.addEventListener("click", () => {
        const set = b.dataset.rar ? pickerState.rarity : pickerState.type;
        const v = b.dataset.rar || b.dataset.ty;
        set.has(v) ? set.delete(v) : set.add(v);
        b.setAttribute("aria-pressed", set.has(v));
        renderPicker();
      }),
    );
    renderPicker();
    $("#picker").showModal();
    $("#pk-q").focus();
  }

  function renderPicker() {
    const q = pickerState.q.toLowerCase();
    const list = $("#pk-list");
    list.classList.toggle("cards", picker.kind === "card");
    const items =
      picker.kind === "char"
        ? CAT.chars
            .filter((c) => !q || c.n.toLowerCase().includes(q))
            .map((c) => ({ c, sc: picker.score ? picker.score(c.n) : null }))
            // com affinity: da maior para a menor (empates mantêm a ordem do jogo)
            .sort((a, b) => (picker.score ? b.sc - a.sc : 0))
            .map(
              ({ c, sc }) =>
                `<button type="button" data-v="${esc(c.n)}"><span class="im">${charImg(c.n)}${sc != null ? `<b class="aff num" title="Affinity">${sc}</b>` : ""}</span><span>${esc(c.n)}</span></button>`,
            )
        : CAT.cards
            .filter(
              (c) =>
                (!q || (c.n + " " + c.t).toLowerCase().includes(q)) &&
                (!pickerState.rarity.size || pickerState.rarity.has(c.r)) &&
                (!pickerState.type.size || pickerState.type.has(c.ty)),
            )
            .map(
              (c) =>
                `<button type="button" data-v="${esc(c.k)}"><span class="im">${cardImg(c.k)}</span><span><b>${esc(c.n)}</b><br><small>${esc(c.t)}</small><br><small><span class="ty" style="background:${typeVar(c.ty)}"></span>${esc(c.ty)} · ${esc(c.r)}</small></span></button>`,
            );
    list.innerHTML = items.length
      ? items.join("")
      : '<p class="empty">Nothing found with this filter.</p>';
    list
      .querySelectorAll("button")
      .forEach((b) => b.addEventListener("click", () => pick(b.dataset.v)));
  }

  function pick(value) {
    const done = picker.onPick;
    $("#picker").close();
    done(value);
  }

  $("#pk-q").addEventListener("input", (e) => {
    pickerState.q = e.target.value;
    renderPicker();
  });
  $("#pk-close").addEventListener("click", () => $("#picker").close());
  $("#pk-remove").addEventListener("click", () => pick(null));
  $("#picker").addEventListener("click", (e) => {
    if (e.target === $("#picker")) $("#picker").close();
  });

  /* ---------- compartilhar o time de um PvP como imagem ---------- */
  // Desenha num <canvas> com as mesmas artes do site (mesma origem, então a
  // imagem pode ser copiada/baixada). Cores fixas do tema escuro.
  const SH = {
    bg: "#08090e",
    panel: "#11131b",
    panel2: "#161d26",
    line: "#23303d",
    fg: "#e9ebf5",
    muted: "#93a7b8",
    faint: "#686e8f",
    accent: "#8fd8ec",
    pink: "#f070ab",
    loh: "#f0625e",
    place: {
      "1st": "#e2b843",
      "2nd": "#aab4bf",
      "3rd": "#d58a5c",
      "B 1st": "#8fd8ec",
    },
    style: {
      Runaway: "#96dcf8",
      "Front Runner": "#00b0f0",
      "Pace Chaser": "#00b050",
      "Late Surger": "#e9712f",
      "End Closer": "#ff4a4a",
    },
    font: (w, px) =>
      `${w} ${px}px Figtree, system-ui, -apple-system, "Segoe UI", sans-serif`,
  };
  const imgCache = new Map();
  const loadImg = (url) => {
    if (!imgCache.has(url))
      imgCache.set(
        url,
        new Promise((res) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = url;
        }),
      );
    return imgCache.get(url);
  };
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  /** Desenha um arquivo do ATLAS (imagem solta ou pedaço de folha) cobrindo a caixa. */
  async function drawArt(ctx, file, x, y, w, h, r = 0, alignBottom = false) {
    const e = file && ATLAS[file];
    if (!e) return false;
    const im = await loadImg(typeof e === "string" ? e : e[0]);
    if (!im) return false;
    let sx = 0;
    let sy = 0;
    let sw = im.naturalWidth;
    let sh = im.naturalHeight;
    if (typeof e !== "string") {
      const [, c, rr, C, R] = e;
      sw /= C;
      sh /= R;
      sx = c * sw;
      sy = rr * sh;
    }
    const k = Math.max(w / sw, h / sh); // "cover"
    const cw = w / k;
    const ch = h / k;
    const ox = sx + (sw - cw) / 2;
    const oy = alignBottom ? sy + sh - ch : sy + (sh - ch) / 2;
    ctx.save();
    rrect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.drawImage(im, ox, oy, cw, ch, x, y, w, h);
    ctx.restore();
    return true;
  }
  /** Texto numa largura máxima: diminui a fonte até caber, e corta com "…" se precisar. */
  function fitText(ctx, text, x, y, maxW, px, weight = 600, min = 12) {
    let size = px;
    ctx.font = SH.font(weight, size);
    while (size > min && ctx.measureText(text).width > maxW) {
      size--;
      ctx.font = SH.font(weight, size);
    }
    let t = text;
    while (t.length > 1 && ctx.measureText(t).width > maxW)
      t = t.slice(0, -2) + "…";
    ctx.fillText(t, x, y);
  }
  function chip(ctx, text, x, y, color, filled = false, px = 15) {
    ctx.font = SH.font(700, px);
    const w = ctx.measureText(text).width + 20;
    const h = px + 12;
    rrect(ctx, x, y, w, h, h / 2);
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#0b0f14";
    } else {
      ctx.fillStyle = SH.panel2;
      ctx.fill();
      ctx.fillStyle = color;
    }
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 10, y + h / 2 + 1);
    ctx.textBaseline = "alphabetic";
    return w;
  }
  /** Espaço com arte; vazio fica tracejado (azul-claro, ou rosa na emprestada). */
  async function slot(ctx, file, x, y, w, h, r, kind = "") {
    const ok = await drawArt(ctx, file, x, y, w, h, r);
    const color = kind === "borrow" ? "240,112,171" : "143,216,236";
    ctx.save();
    rrect(ctx, x, y, w, h, r);
    if (!ok) {
      ctx.fillStyle = kind ? `rgba(${color},0.08)` : SH.panel2;
      ctx.fill();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = kind ? `rgba(${color},0.8)` : SH.line;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (kind === "borrow") {
      ctx.strokeStyle = `rgb(${color})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  async function renderShare(id) {
    const cm = CM_BY_ID.get(id);
    const d = record(id);
    const W = 1600;
    const H = 840;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    try {
      await document.fonts.ready;
    } catch (_) {
      /* sem fontes da web: usa as do sistema */
    }
    ctx.fillStyle = SH.bg;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(260, 120, 0, 260, 120, 700);
    g.addColorStop(0, "rgba(143,216,236,0.10)");
    g.addColorStop(1, "rgba(143,216,236,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // cabeçalho
    const P = 56;
    ctx.fillStyle = SH.muted;
    ctx.font = SH.font(700, 18);
    const top = [cm.sc, cm.nm].filter(Boolean).join(" · ").toUpperCase();
    ctx.fillText(top, P, 74);
    ctx.fillStyle = isLoh(cm.id) ? SH.loh : SH.fg;
    ctx.font = SH.font(800, 64);
    ctx.fillText(cm.id, P, 140);
    const idW = ctx.measureText(cm.id).width;
    const name = getName();
    if (name) {
      ctx.fillStyle = SH.muted;
      ctx.font = SH.font(600, 26);
      ctx.fillText(`· ${name}`, P + idW + 16, 138);
    }
    ctx.fillStyle = SH.muted;
    ctx.font = SH.font(500, 22);
    const course = [
      cm.tr,
      cm.m ? cm.m + "m" : "",
      cm.su,
      distOf(cm),
      cm.dir,
      cm.se,
      cm.we,
      cm.gr,
    ]
      .filter(Boolean)
      .join(" · ");
    ctx.fillText(course, P, 180);

    // resultado (direita)
    const score = L.ratingScore(d.rat);
    const tot = L.roundTotals(d.rat);
    let rx = W - P;
    ctx.textAlign = "right";
    if (score) {
      ctx.fillStyle = SH.fg;
      ctx.font = SH.font(800, 58);
      ctx.fillText(pct(score), rx, 134);
      ctx.fillStyle = SH.muted;
      ctx.font = SH.font(600, 20);
      ctx.fillText(`WR · ${tot.wins} / ${tot.races} wins`, rx, 166);
    }
    ctx.textAlign = "left";
    if (d.pl) {
      ctx.font = SH.font(800, 26);
      const w = ctx.measureText(d.pl).width + 36;
      const x = score ? rx - 250 - w : rx - w;
      rrect(ctx, x, 92, w, 48, 24);
      ctx.fillStyle = SH.place[d.pl] || SH.accent;
      ctx.fill();
      ctx.fillStyle = "#0b0f14";
      ctx.textBaseline = "middle";
      ctx.fillText(d.pl, x + 18, 117);
      ctx.textBaseline = "alphabetic";
    }

    // as 3 Umas
    const gap = 24;
    const cw = (W - 2 * P - 2 * gap) / 3;
    const cy = 216;
    const chh = 530;
    for (let k = 0; k < 3; k++) {
      const t = d.team[k];
      const x = P + k * (cw + gap);
      rrect(ctx, x, cy, cw, chh, 22);
      ctx.fillStyle = SH.panel;
      ctx.fill();
      ctx.strokeStyle = t.ro === "Debuffer" ? SH.loh + "aa" : SH.line;
      ctx.lineWidth = t.ro === "Debuffer" ? 2 : 1;
      ctx.stroke();
      const ix = x + 22;
      if (!t.n) {
        ctx.fillStyle = SH.faint;
        ctx.font = SH.font(600, 22);
        ctx.fillText(`Uma ${k + 1} — empty`, ix, cy + 50);
        continue;
      }
      const c = CHAR.get(t.n);
      // arte + nome
      rrect(ctx, ix, cy + 22, 150, 150, 16);
      ctx.fillStyle = SH.panel2;
      ctx.fill();
      await drawArt(ctx, c && (c.s || c.i), ix, cy + 22, 150, 150, 16, true);
      const tx = ix + 168;
      const tw = cw - 44 - 168;
      ctx.fillStyle = SH.fg;
      fitText(ctx, t.n, tx, cy + 56, tw, 25, 700, 15);
      let chx = tx;
      chx +=
        chip(
          ctx,
          t.ro,
          chx,
          cy + 72,
          t.ro === "Debuffer" ? SH.loh : SH.accent,
        ) + 8;
      if (t.st) chip(ctx, t.st, chx, cy + 72, SH.style[t.st] || SH.muted);
      const total = L.winsTotal(d.rat);
      ctx.fillStyle = SH.muted;
      ctx.font = SH.font(700, 15);
      ctx.fillText("WR", tx, cy + 146);
      ctx.fillStyle = SH.fg;
      ctx.font = SH.font(800, 34);
      ctx.fillText(t.w != null ? pct(t.w / total) : "–", tx + 32, cy + 150);
      if (t.w != null) {
        ctx.fillStyle = SH.muted;
        ctx.font = SH.font(500, 15);
        ctx.fillText(`${t.w} / ${total}`, tx + 34, cy + 172);
      }

      // parents: P grande com os dois avós ao lado
      let py = cy + 200;
      ctx.fillStyle = SH.muted;
      ctx.font = SH.font(700, 14);
      ctx.fillText("PARENTS", ix, py);
      py += 14;
      const half = (cw - 44) / 2;
      for (const [side, base] of [
        [0, 0],
        [1, 3],
      ]) {
        const px = ix + side * half;
        const pName = t.p[base];
        await slot(
          ctx,
          pName && CHAR.get(pName) && CHAR.get(pName).i,
          px,
          py,
          72,
          72,
          36,
        );
        // ligação do parent aos dois avós, como no site
        const gy = py + 24;
        const c1 = px + 80 + 24;
        const c2 = px + 80 + 54 + 24;
        ctx.save();
        ctx.strokeStyle = "rgba(147,167,184,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 66, gy - 9);
        ctx.lineTo(c2 - 6, gy - 9);
        ctx.arcTo(c2, gy - 9, c2, gy - 3, 6);
        ctx.lineTo(c2, gy);
        ctx.moveTo(c1, gy - 9);
        ctx.lineTo(c1, gy);
        ctx.stroke();
        ctx.restore();
        for (const g2 of [1, 2]) {
          const gName = t.p[base + g2];
          await slot(
            ctx,
            gName && CHAR.get(gName) && CHAR.get(gName).i,
            px + 80 + (g2 - 1) * 54,
            py + 24,
            48,
            48,
            24,
          );
        }
      }
      // affinity
      const aff = L.affinity(
        charaIdOf(t.n),
        t.p.map(charaIdOf),
        window.CM_AFFINITY,
      );
      const anyAff = aff.parts.some((p) => p.value !== null);
      py += 92;
      rrect(ctx, ix, py, cw - 44, 54, 14);
      ctx.fillStyle = SH.panel2;
      ctx.fill();
      ctx.fillStyle = SH.muted;
      ctx.font = SH.font(700, 14);
      ctx.fillText("AFFINITY", ix + 16, py + 33);
      ctx.textAlign = "right";
      ctx.fillStyle = SH.fg;
      ctx.font = SH.font(800, 30);
      ctx.fillText(
        anyAff ? `${aff.total} ${aff.mark}` : "–",
        ix + cw - 44 - 16,
        py + 38,
      );
      ctx.textAlign = "left";

      // deck 3×2 com o limit break
      py += 78;
      ctx.fillStyle = SH.muted;
      ctx.font = SH.font(700, 14);
      ctx.fillText("DECK", ix, py);
      py += 12;
      const dw = (cw - 44 - 5 * 10) / 6;
      const dh = dw * (4 / 3);
      for (let j = 0; j < 6; j++) {
        const key = t.d[j];
        const card = key && CARD.get(key);
        const dx = ix + j * (dw + 10);
        const borrowed = j === L.BORROWED_SLOT;
        await slot(
          ctx,
          card && card.im,
          dx,
          py,
          dw,
          dh,
          8,
          borrowed ? "borrow" : "card",
        );
        if (key) {
          ctx.fillStyle = SH.muted;
          ctx.font = SH.font(700, 13);
          ctx.textAlign = "center";
          ctx.fillText(L.LB_LABELS[t.lb[j] ?? 4], dx + dw / 2, py + dh + 18);
          ctx.textAlign = "left";
        }
      }
    }

    // rounds e rodapé
    const fy = cy + chh + 46;
    ctx.font = SH.font(600, 18);
    let fx = P;
    const labels = ["R1 D1", "R1 D2", "R2 D1", "R2 D2"];
    d.rat.forEach((r, k) => {
      const p = L.parseRound(r);
      if (!p) return;
      const txt = `${labels[k]}  ${r}  (${pct(p.wins / p.races)})`;
      ctx.fillStyle = SH.panel2;
      const w = ctx.measureText(txt).width + 24;
      rrect(ctx, fx, fy - 24, w, 36, 18);
      ctx.fill();
      ctx.fillStyle = SH.fg;
      ctx.fillText(txt, fx + 12, fy);
      fx += w + 10;
    });
    ctx.textAlign = "right";
    ctx.fillStyle = SH.faint;
    ctx.font = SH.font(600, 18);
    ctx.fillText("kaiooleo.github.io/CMcomps", W - P - 52, fy);
    ctx.textAlign = "left";
    const chibi = await loadImg("icons/cheval-chibi.webp");
    if (chibi) ctx.drawImage(chibi, W - P - 46, fy - 34, 44, 44);
    return cv;
  }

  async function openShare(id) {
    const dlg = $("#share-dlg");
    const img = $("#share-img");
    img.removeAttribute("src");
    $("#share-msg").textContent = "Making the image…";
    dlg.showModal();
    const cv = await renderShare(id);
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    img.src = URL.createObjectURL(blob);
    $("#share-msg").textContent = "";
    const file = `comps-${id}${getName() ? "-" + getName().replace(/[^\p{L}\p{N}_-]+/gu, "-") : ""}.png`;
    const copy = $("#share-copy");
    copy.hidden = !(navigator.clipboard && window.ClipboardItem);
    copy.onclick = async () => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        $("#share-msg").textContent = "Copied! Paste it on Discord (Ctrl+V).";
      } catch (_) {
        $("#share-msg").textContent =
          "This browser didn't allow copying. Use Download.";
      }
    };
    $("#share-down").onclick = () => {
      const a = document.createElement("a");
      a.href = img.src;
      a.download = file;
      a.click();
    };
    const f = new File([blob], file, { type: "image/png" });
    const native = $("#share-native");
    native.hidden = !(navigator.canShare && navigator.canShare({ files: [f] }));
    native.onclick = () => navigator.share({ files: [f] }).catch(() => {});
  }
  $("#share-close").addEventListener("click", () => $("#share-dlg").close());
  $("#share-dlg").addEventListener("click", (e) => {
    if (e.target === $("#share-dlg")) $("#share-dlg").close();
  });

  /* ---------- backup ---------- */
  // Nome da pessoa: fica neste navegador e dá nome ao arquivo de backup
  const NAME_KEY = "cmcomps:name";
  const getName = () => {
    try {
      return localStorage.getItem(NAME_KEY) || "";
    } catch (_) {
      return "";
    }
  };
  const setName = (v) => {
    try {
      v ? localStorage.setItem(NAME_KEY, v) : localStorage.removeItem(NAME_KEY);
    } catch (_) {
      /* sem armazenamento: o nome só vale até fechar a página */
    }
  };
  const backupFileName = () => {
    const n = getName()
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/^-+|-+$/g, "");
    return `comps-${n || "backup"}.json`;
  };
  // Digitou uma vez, fica salvo: o campo some e aparece só o nome com "Change"
  const nameInput = $("#me-name");
  const nameEdit = $("#me-edit");
  const nameShow = $("#me-show");
  function showName(editing = false) {
    const n = getName();
    const edit = editing || !n;
    nameInput.closest("label").hidden = !edit;
    nameShow.hidden = edit;
    $("#me-text").textContent = n;
    if (edit) nameInput.value = n;
  }
  function commitName() {
    const v = nameInput.value.trim();
    if (!v) return; // vazio não apaga o nome que já existe
    setName(v);
    showName();
  }
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commitName();
    if (e.key === "Escape" && getName()) showName();
  });
  nameInput.addEventListener("blur", commitName);
  nameEdit.addEventListener("click", () => {
    showName(true);
    nameInput.focus();
    nameInput.select();
  });
  showName();

  // Arquivo de backup escolhido da primeira vez (Chrome/Edge no computador):
  // os próximos backups substituem esse mesmo arquivo, sem perguntar de novo.
  const HANDLE_DB = "cmcomps";
  function handleStore(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(HANDLE_DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction("kv", mode);
        const req = fn(tx.objectStore("kv"));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }
  const loadHandle = () =>
    handleStore("readonly", (st) => st.get("backup")).catch(() => null);
  const saveHandle = (v) =>
    handleStore("readwrite", (st) => st.put(v, "backup")).catch(() => {});

  async function saveToSameFile(text) {
    const name = backupFileName();
    let saved = await loadHandle();
    let handle = saved && saved.forName === name ? saved.handle : null;
    if (handle) {
      const opts = { mode: "readwrite" };
      if (
        (await handle.queryPermission(opts)) !== "granted" &&
        (await handle.requestPermission(opts)) !== "granted"
      )
        handle = null;
    }
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: "Comps backup",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      await saveHandle({ handle, forName: name });
    }
    const w = await handle.createWritable();
    await w.write(text);
    await w.close();
    return handle.name;
  }

  function download(text) {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  $("#bk-down").addEventListener("click", async () => {
    if (saveTimer) flush();
    const backup = L.makeBackup(DATA);
    if (getName()) backup.name = getName();
    const text = JSON.stringify(backup, null, 1);
    if (window.showSaveFilePicker) {
      try {
        status(`Backup saved to ${await saveToSameFile(text)}`);
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // fechou a janela de salvar
        // qualquer outro problema: baixa o arquivo do jeito normal
      }
    }
    download(text);
  });

  $("#bk-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = L.parseBackup(text);
      const name = JSON.parse(text).name;
      const n = Object.keys(data).length;
      const hasData = Object.keys(L.serialize(DATA).data).length > 0;
      if (
        hasData &&
        !confirm(
          `Load this backup (${n} PvPs)? It replaces what is saved in this browser.`,
        )
      )
        return;
      DATA = data;
      if (typeof name === "string" && name && !getName()) {
        setName(name);
        showName();
      }
      flush();
      status(`Backup loaded: ${n} PvPs`);
      route();
    } catch (err) {
      status(err.message, true);
    }
  });

  /* ---------- botão voltar ---------- */
  // Sobe um nível na estrutura do site (não segue o histórico):
  // Uma → PvP dela → lista de PvP; "Ver todas" → Resumo.
  function parentRoute(hash) {
    const uma = /^#uma-(.+)-\d$/.exec(hash);
    if (uma) return "cm-" + uma[1];
    if (hash.startsWith("#rank-")) return "resumo";
    return "cms";
  }
  $("#back").addEventListener("click", () => {
    location.hash = parentRoute(location.hash);
  });
  window.addEventListener("hashchange", () => {
    if ($("#picker").open) $("#picker").close();
    window.scrollTo(0, 0);
    route();
  });

  /* ---------- início ---------- */
  DATA = load();
  if (!$("#status").classList.contains("err"))
    // o aviso fica vazio até a pessoa mudar algo (aí mostra "Saving…/Saved")
    status("");
  route();

  // PWA: permite instalar e abrir sem internet (só em http/https)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
    navigator.serviceWorker.register("sw.js").catch(() => {});
})();
