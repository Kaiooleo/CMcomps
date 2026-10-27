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
  const finalLabel = () =>
    CONF.date ? fmtDate(CONF.date) + (CONF.est ? " (estimada)" : "") : "";

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
  const pct = (x) => (Math.round(x * 1000) / 10).toLocaleString("pt-BR") + "%";
  const plClass = (p) => (p ? "pl-" + p.replace(" ", "") : "");
  const typeVar = (t) =>
    "var(--t-" + (t || "").toLowerCase() + ",var(--muted))";
  const fmtDate = (d) => (d ? d.split("-").reverse().join("/") : "");
  const cond = (c) => [c.se, c.we, c.gr].filter(Boolean).map(esc).join(" · ");
  const isLoh = (id) => id.startsWith("LOH");
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
        e && e.message && e.message.includes("versão")
          ? e.message
          : "Não foi possível ler os dados salvos neste navegador.",
        true,
      );
    }
    return {};
  }

  let saveTimer = null;
  function save() {
    status("Salvando…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, SAVE_DELAY);
  }
  function flush() {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(L.serialize(DATA)));
      status("Salvo neste navegador");
    } catch (_) {
      status(
        "Este navegador não deixou salvar. Use “Baixar backup” para não perder seus dados.",
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
    const days = L.daysToFinal(CONF);
    const when = passed
      ? `Final em ${finalLabel()} · concluída`
      : days != null
        ? `Final em ${finalLabel()} · ${days <= 0 ? "hoje" : days === 1 ? "amanhã" : `faltam ${days} dias`}`
        : "Data da final não definida";
    const team = d ? d.team.filter((t) => t.n) : [];
    const teamHtml = team.length
      ? team
          .map(
            (t) =>
              `<a class="ct ${t.ro === "Debuffer" ? "debuff" : ""}" href="#cm-${esc(cm.id)}"><span class="av">${charImg(t.n, true)}</span><b>${esc(t.n)}</b><small>${esc(t.ro)}${t.st ? " · " + esc(t.st) : ""}</small></a>`,
          )
          .join("")
      : `<a class="btn primary" href="#cm-${esc(cm.id)}" style="align-self:center;justify-self:start">Montar time</a>`;
    return `<section class="curhero">
    <a class="ch-main" href="#cm-${esc(cm.id)}">
      <div class="label" style="color:var(--accent)">Current PvP</div>
      <h1><span class="cmid ${isLoh(cm.id) ? "loh" : ""}">${esc(cm.id)}</span> <span class="sc">· ${esc(cm.sc)}</span></h1>
      <div class="ln num">${esc(cm.tr)} · ${cm.m || "?"}m · ${esc(cm.su)} · ${esc(L.dist(cm.m))}${cm.dir ? " · " + esc(cm.dir) : ""}</div>
      ${cond(cm) ? `<div class="ln">${cond(cm)}</div>` : ""}
      <div class="when"><span class="chip cur">${when}</span>${d && d.pl ? ` <span class="chip ${plClass(d.pl)}">${esc(d.pl)}</span>` : ""}</div>
    </a>
    <div class="ch-team">${teamHtml}</div>
  </section>`;
  }

  function scoreChart(scores, avg) {
    if (!scores.length)
      return '<p class="empty">O WR aparece aqui quando você preencher as rodadas de um CM.</p>';
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
  };

  function panelHead(id, total) {
    const r = RANKINGS[id];
    const more =
      total > TOP
        ? `<a class="more" href="#${id}">Ver todas (${total}) →</a>`
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
      ? '<p class="empty">Nada registrado ainda.</p>'
      : r.key === "aces"
        ? aceGrid(list, 1)
        : podium(list, r.key === "borrow", true);
    $("#app").innerHTML = `
  <section class="lhead"><h1${r.pink ? ' style="color:var(--pink)"' : ""}>${r.title}</h1><span class="chip">${list.length}</span></section>
  <section class="panel">${body}</section>`;
  }

  function podium(entries, borrowed, wrap = false) {
    if (!entries.length) return '<p class="empty">Nada registrado ainda.</p>';
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
  ${empty ? `<div class="banner"><p>Nenhum resultado registrado ainda. Abra um PvP, monte seu time e marque a colocação para ver as estatísticas aqui.</p><a class="btn primary" href="#cms">Ver PvPs</a></div>` : ""}
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
    <div class="panel"><div class="label">WR by PvP <span style="text-transform:none;letter-spacing:0;font-weight:500">· verde = 1st</span></div>
      <div class="chart" id="chart" style="margin-top:12px">${scoreChart(s.scores, s.avg)}</div>
    </div>
  </section>
  <section class="row2">
    <div class="panel">${panelHead("rank-aces", s.aces.length)}
      ${s.aces.length ? aceGrid(s.aces.slice(0, TOP)) : '<p class="empty">Nada registrado ainda.</p>'}
    </div>
    <div class="panel"><div class="label">Style (Ace)</div>
      <div class="bars">${STYLES.map((st) => {
        const n = s.styles[st] || 0;
        return `<div class="bar"><span>${st}</span><span class="t"><i style="width:${(n / styleMax) * 100}%"></i></span><b class="num">${n}</b></div>`;
      }).join("")}</div>
    </div>
  </section>
  <section class="panel">${panelHead("rank-cards", s.cards.length)}${podium(s.cards.slice(0, TOP), false)}</section>
  <section class="panel">${panelHead("rank-borrowed", s.borrow.length)}${podium(s.borrow.slice(0, TOP), true)}</section>`;

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
      chips += `<span class="chip cur">Current PvP${CONF.date ? " · final " + fmtDate(CONF.date).slice(0, 5) + (CONF.est ? " (est.)" : "") : ""}</span>`;
    if (ph === "future") chips += '<span class="chip none">Not counted</span>';
    if (d && d.pl)
      chips += `<span class="chip ${plClass(d.pl)}">${esc(d.pl)}</span>`;
    else if (ph !== "future")
      chips += `<span class="chip none">${team.length ? "No result" : "Empty"}</span>`;
    return `<a class="tile ${ph === "future" ? "future" : ""} ${ph === "current" ? "current" : ""}" href="#cm-${esc(c.id)}">
      <div class="top"><h2><span class="cmid ${isLoh(c.id) ? "loh" : ""}">${esc(c.id)}</span> <span class="sc">· ${esc(title)}</span></h2>${chips}</div>
      <div class="ln num">${esc(c.tr)} · ${c.m || "?"}m · ${esc(c.su)} · ${esc(L.dist(c.m))}${c.dir ? " · " + esc(c.dir) : ""}</div>
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
          [c.id, c.nm, c.sc, c.tr, c.su, L.dist(c.m), c.m]
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
    <div class="seg" role="group" aria-label="Tipo">${filters}</div>
    <input class="search" id="lq" type="search" placeholder="Buscar por CM, cenário, pista, distância…" value="${esc(listQuery)}"></section>
  <section class="tiles">${rows.length ? rows.map(tileHtml).join("") : '<p class="empty">Nenhum PvP encontrado.</p>'}</section>`;

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
  const umaWr = (t) => (t.w != null ? pct(t.w / L.WINS_TOTAL) : "–");

  function currentNote(id) {
    if (phase(id) !== "current") return "";
    return `<div class="banner sched"><p><b>Current PvP.</b> ${finalPassed() ? "A final já passou e ele já conta nas estatísticas." : `Entra nas estatísticas depois da final${CONF.date ? ` (${finalLabel()})` : ""}${CONF.est ? `, com ${L.MARGIN_DAYS} dias de folga por ser data estimada` : ""}.`}</p></div>`;
  }

  function pvpHead(cm, sub = "") {
    const prev = CAT.cms[cm.i - 1];
    const next = CAT.cms[cm.i + 1];
    const meta = [
      cm.tr,
      `${cm.m || "?"}m`,
      cm.su,
      L.dist(cm.m),
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
      : `<div class="nav2">${prev ? `<a class="btn" href="#cm-${esc(prev.id)}">← ${esc(prev.id)}</a>` : ""}<a class="btn" href="#cms">All PvP</a>${next ? `<a class="btn" href="#cm-${esc(next.id)}">${esc(next.id)} →</a>` : ""}</div>`;
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
    const href = `#uma-${esc(cmId)}-${k + 1}`;
    if (!t.n)
      return `<a class="panel umacard empty" href="${href}"><span class="plus">+</span><span>Escolher Uma ${k + 1}</span></a>`;
    const mini = (items, img, borrowedAt = -1) =>
      items
        .map(
          (x, j) =>
            `<span class="m ${j === borrowedAt ? "borrow" : ""} ${x ? "" : "off"}">${x ? img(x) : ""}</span>`,
        )
        .join("");
    return `<a class="panel umacard ${t.ro === "Debuffer" ? "debuff" : ""}" href="${href}" title="Abrir ${esc(t.n)}">
    <span class="art">${charImg(t.n, true)}</span>
    <span class="info">
      <b class="nm">${esc(t.n)}</b>
      <span class="tags"><span class="chip ${t.ro === "Debuffer" ? "deb" : "ace"}">${esc(t.ro)}</span>${t.st ? `<span class="chip">${esc(t.st)}</span>` : ""}</span>
      <span class="wrbox"><span class="label">WR</span><b class="num">${umaWr(t)}</b><small>${t.w != null ? `${t.w} / ${L.WINS_TOTAL} wins` : "sem wins"}</small></span>
    </span>
    <span class="minis">
      <span class="label">Parents</span>${t.p.some(Boolean) ? parentsSummary(t.p) : '<span class="none">—</span>'}
      <span class="label">Deck</span>${t.d.some(Boolean) ? `<span class="mrow deckrow">${mini(t.d, cardImg, L.BORROWED_SLOT)}</span>` : '<span class="none">—</span>'}
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
    <div class="panel"><div class="label">Rounds <span style="text-transform:none;letter-spacing:0;font-weight:500">· vitórias de cada tentativa (5-4-3-5) ou o total do dia (17)</span></div>
      <div class="rounds">${d.rat
        .map(
          (
            r,
            k,
          ) => `<label class="day"><span class="label">${ROUND_LABELS[k]}</span>
          <input id="rat-${k}" inputmode="numeric" placeholder="5-4-3-5 ou 17" value="${esc(r)}" class="${L.isValidRound(r) ? "" : "bad"}">
          <span class="num dwr" id="dwr-${k}">${r && L.isValidRound(r) ? pct(L.ratingScore([r])) : ""}</span></label>`,
        )
        .join("")}</div>
      <div class="score"><b class="num" id="score">${total ? pct(total) : "–"}</b><span style="color:var(--muted)">WR total</span></div>
    </div>
  </section>`;

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
  <nav class="seg umatabs" aria-label="Umas deste PvP">${tabs}</nav>
  <section>${runnerHtml(t, k, true)}</section>`;
    bindRunner(document.querySelector(".runner"), t, k, () => viewUma(id, k));
  }

  /** Liga os botões e campos de um card de Uma editável. */
  function bindRunner(card, t, k, rerender) {
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
    card
      .querySelector("[name=st]")
      .addEventListener("change", (e) =>
        change(() => (t.st = e.target.value || null), false),
      );
    const wins = card.querySelector("[name=w]");
    wins.addEventListener("input", () => {
      const v = parseInt(wins.value, 10);
      change(() => (t.w = isNaN(v) ? null : v), false);
      card.querySelector(".wrp").textContent = umaWr(t);
    });
    card.querySelectorAll("[data-p]").forEach((b) =>
      b.addEventListener("click", () => {
        const j = +b.dataset.p;
        openPicker(
          "char",
          t.p[j],
          `${PAR[j]} · ${t.n || "Uma " + (k + 1)}`,
          (v) => change(() => (t.p[j] = v)),
        );
      }),
    );
    card.querySelectorAll("[data-d]").forEach((b) =>
      b.addEventListener("click", () => {
        const j = +b.dataset.d;
        const title =
          j === L.BORROWED_SLOT ? "Borrowed card" : `Support card ${j + 1}`;
        openPicker("card", t.d[j], title, (v) => change(() => (t.d[j] = v)));
      }),
    );
  }

  function runnerHtml(t, k, big = false) {
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
    const deck = t.d
      .map((c, j) => {
        const borrowed = j === L.BORROWED_SLOT;
        return slot(
          borrowed ? "borrow" : "",
          c ? cardImg(c) : "",
          `data-d="${j}"`,
          `${borrowed ? "Borrowed card" : "Card " + (j + 1)}: ${c ? c.replace("\n", " ") : "empty"}`,
          borrowed ? "" : "+",
          borrowed ? '<span class="tag">BORROW</span>' : "",
        );
      })
      .join("");
    return `<article class="panel runner ${big ? "big" : ""} ${t.ro === "Debuffer" ? "debuff" : ""}" data-k="${k}">
    <div class="rtop">${slot("main", t.n ? charImg(t.n, true) : "", "", t.n ? `Change ${t.n}` : "Choose Uma", '<span class="plus">+</span>')}
      <div><button type="button" class="rname">${t.n ? esc(t.n) : `<span style="color:var(--muted)">Escolher Uma ${k + 1}</span>`}</button>
        <div class="fields">
          <label class="nolab"><select name="ro" aria-label="Ace ou Debuffer">${ROLES.map((r) => `<option ${t.ro === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
          <label class="nolab"><select name="st" aria-label="Style"><option value="">Style —</option>${STYLES.map((s) => `<option ${t.st === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label>Wins<span class="wins"><input name="w" type="number" min="0" max="${L.WINS_TOTAL}" inputmode="numeric" value="${t.w ?? ""}" aria-label="Wins (de ${L.WINS_TOTAL})"><span class="of">/ ${L.WINS_TOTAL}</span></span></label>
          <div class="wrbox"><span class="label">WR</span><b class="num wrp">${umaWr(t)}</b></div>
        </div></div></div>
    <div class="lower">
      <div><div class="label">Parents</div>
        <div class="tree">
          ${parent(0)}${parent(3)}
          ${parent(1)}${parent(2)}${parent(4)}${parent(5)}
        </div></div>
      <div><div class="label">Deck</div><div class="deck">${deck}</div></div>
    </div>
  </article>`;
  }

  /* ---------- seletor de Uma / carta ---------- */
  let picker = null;
  const pickerState = { q: "", rarity: new Set(), type: new Set() };

  function openPicker(kind, current, title, onPick) {
    picker = { kind, onPick };
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
            .map(
              (c) =>
                `<button type="button" data-v="${esc(c.n)}"><span class="im">${charImg(c.n)}</span><span>${esc(c.n)}</span></button>`,
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
      : '<p class="empty">Nada encontrado com esse filtro.</p>';
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

  /* ---------- backup ---------- */
  $("#bk-down").addEventListener("click", () => {
    if (saveTimer) flush();
    const blob = new Blob([JSON.stringify(L.makeBackup(DATA), null, 1)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cmcomps-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  });

  $("#bk-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = L.parseBackup(await file.text());
      const n = Object.keys(data).length;
      const hasData = Object.keys(L.serialize(DATA).data).length > 0;
      if (
        hasData &&
        !confirm(
          `Carregar este backup (${n} PvPs)? Ele substitui o que está salvo neste navegador.`,
        )
      )
        return;
      DATA = data;
      flush();
      status(`Backup carregado: ${n} PvPs`);
      route();
    } catch (err) {
      status(err.message, true);
    }
  });

  /* ---------- botão voltar ---------- */
  const backStack = [];
  let lastHash = location.hash;
  let goingBack = false;
  $("#back").addEventListener("click", () => {
    if (backStack.length) {
      goingBack = true;
      location.hash = backStack.pop() || "resumo";
    } else {
      // sem histórico (ex.: página recarregada): sobe um nível
      const uma = /^#uma-(.+)-\d$/.exec(location.hash);
      location.hash = uma
        ? "cm-" + uma[1]
        : location.hash.startsWith("#rank-")
          ? "resumo"
          : "cms";
    }
  });
  window.addEventListener("hashchange", () => {
    if (!goingBack && lastHash !== location.hash) backStack.push(lastHash);
    goingBack = false;
    lastHash = location.hash;
    if ($("#picker").open) $("#picker").close();
    window.scrollTo(0, 0);
    route();
  });

  /* ---------- início ---------- */
  DATA = load();
  if (!$("#status").classList.contains("err"))
    status(Object.keys(DATA).length ? "Salvo neste navegador" : "Pronto");
  route();

  // PWA: permite instalar e abrir sem internet (só em http/https)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
    navigator.serviceWorker.register("sw.js").catch(() => {});
})();
