(() => {
  const CAT = window.CM_CATALOG;
  const ATLAS = window.CM_ATLAS;
  const IMGS = { has: (f) => !!(f && ATLAS[f]) };
  function spr(f, alt) {
    const [u, c, r, C, R] = ATLAS[f];
    return `<span class="spr" role="img" aria-label="${esc(alt)}" style="background-image:url(${u});background-size:${C * 100}% ${R * 100}%;background-position:${C > 1 ? (c / (C - 1)) * 100 : 0}% ${R > 1 ? (r / (R - 1)) * 100 : 0}%"></span>`;
  }
  const CHAR = new Map(CAT.chars.map((c) => [c.n, c]));
  const CARD = new Map(CAT.cards.map((c) => [c.k, c]));
  const STYLES = [
    "Runaway",
    "Front Runner",
    "Pace Chaser",
    "Late Surger",
    "End Closer",
  ];
  const ROLES = ["Ace", "Debuffer"];
  const PLACES = ["1st", "2nd", "3rd", "B 1st"];
  const TYPES = ["Speed", "Stamina", "Power", "Guts", "Wit", "Pal", "Group"];
  const PAR = ["P1", "GP1.1", "GP1.2", "P2", "GP2.1", "GP2.2"];
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
  const dist = (m) =>
    !m
      ? ""
      : m <= 1400
        ? "Sprint"
        : m <= 1999
          ? "Mile"
          : m <= 2400
            ? "Medium"
            : "Long";
  const plClass = (p) => (p ? "pl-" + p.replace(" ", "") : "");
  const typeVar = (t) =>
    "var(--t-" + (t || "").toLowerCase() + ",var(--muted))";

  /* ---------- estado ---------- */
  let DATA = {};
  /* ---------- CM atual (configuração do dono, vale para todos) ---------- */
  let CONF = { cur: null, date: null };
  const cmIdx = (id) => CAT.cms.findIndex((c) => c.id === id);
  const cond = (c) => [c.se, c.we, c.gr].filter(Boolean).map(esc).join(" · ");
  const fmtDate = (d) => (d ? d.split("-").reverse().join("/") : "");
  // data vazia = sem data; ano fora de 2020–2100 = inválida (evita salvar enquanto digita)
  function okDate(v) {
    if (!v) return null;
    const y = +v.slice(0, 4);
    if (y < 2020 || y > 2100) {
      status("Data inválida: confira o ano (ex.: 05/11/2026).", true);
      return false;
    }
    return v;
  }
  function finalPassed() {
    if (!CONF.date || +CONF.date.slice(0, 4) < 2020) return false;
    return new Date() > new Date(CONF.date + "T23:59:59");
  }
  // 'past' conta; 'current' conta só depois da final; 'future' não conta
  function phase(id) {
    if (!CONF.cur || cmIdx(CONF.cur) < 0) return "past";
    const i = cmIdx(id),
      c = cmIdx(CONF.cur);
    return i < c ? "past" : i === c ? "current" : "future";
  }
  function counted(id) {
    const ph = phase(id);
    return ph === "past" || (ph === "current" && finalPassed());
  }
  async function saveConf(next) {
    const prev = CONF;
    CONF = next;
    route();
    try {
      await db.doc("config/schedule").set(next);
      status("Current CM salvo");
    } catch (e) {
      CONF = prev;
      route();
      status("Não foi possível salvar o Current CM.", true);
    }
  }
  function scheduleBanner() {
    if (!CONF.cur || cmIdx(CONF.cur) < 0)
      return owner && db
        ? `<div class="banner"><p>Todos os CMs entram nas estatísticas. Para não contar os times que você está planejando, marque o CM atual na página dele.</p></div>`
        : "";
    const i = cmIdx(CONF.cur),
      nx = CAT.cms[i + 1],
      passed = finalPassed();
    const txt = passed
      ? `A final do <b>${esc(CONF.cur)}</b> já passou (${fmtDate(CONF.date)}), então ele já conta. Os CMs depois dele ainda ficam de fora.`
      : `O <b>${esc(CONF.cur)}</b> é o CM atual. Ele entra nas estatísticas depois da final${CONF.date ? ` (${fmtDate(CONF.date)})` : ""}. Os CMs depois dele ficam de fora.`;
    const act =
      passed && owner && nx
        ? `<span class="confirm"><input type="date" id="nx-date" class="search" style="max-width:170px" aria-label="Data da final do ${esc(nx.id)}"><button class="btn primary" type="button" id="nx-go">Definir ${esc(nx.id)} como atual</button></span>`
        : "";
    return `<div class="banner sched"><p>${txt}</p>${act}</div>`;
  }

  function currentHero() {
    if (!CONF.cur || cmIdx(CONF.cur) < 0)
      return owner && db
        ? `<div class="banner"><p>Nenhum Current CM definido, então todos os CMs entram nas estatísticas. Para marcar, abra o CM que está acontecendo.</p></div>`
        : "";
    const cm = CAT.cms[cmIdx(CONF.cur)],
      nx = CAT.cms[cmIdx(CONF.cur) + 1],
      d = DATA[cm.id],
      passed = finalPassed();
    const days =
      CONF.date && +CONF.date.slice(0, 4) >= 2020
        ? Math.ceil((new Date(CONF.date + "T23:59:59") - new Date()) / 864e5)
        : null;
    const when = passed
      ? `Final em ${fmtDate(CONF.date)} · concluída`
      : days != null
        ? `Final em ${fmtDate(CONF.date)} · ${days <= 0 ? "hoje" : days === 1 ? "amanhã" : `faltam ${days} dias`}`
        : "Data da final não definida";
    const team = d ? d.team.filter((t) => t.n) : [];
    const act =
      passed && owner && nx
        ? `<div class="confirm ch-next"><input type="date" id="nx-date" class="search" style="max-width:170px" aria-label="Final do ${esc(nx.id)}"><button class="btn primary" type="button" id="nx-go">Definir ${esc(nx.id)} como Current CM</button></div>`
        : "";
    return `<section class="curhero">
    <a class="ch-main" href="#cm-${esc(cm.id)}">
      <div class="label" style="color:var(--accent)">Current CM</div>
      <h1><span class="cmid ${cm.id.startsWith("LOH") ? "loh" : ""}">${esc(cm.id)}</span> <span class="sc">· ${esc(cm.sc)}</span></h1>
      <div class="ln num">${esc(cm.tr)} · ${cm.m || "?"}m · ${esc(cm.su)} · ${esc(dist(cm.m))}${cm.dir ? " · " + esc(cm.dir) : ""}</div>
      ${cond(cm) ? `<div class="ln">${cond(cm)}</div>` : ""}
      <div class="when"><span class="chip cur">${when}</span>${d && d.pl ? ` <span class="chip ${plClass(d.pl)}">${esc(d.pl)}</span>` : ""}</div>
      <p class="note">${passed ? "Já conta nas estatísticas." : "Este CM e os seguintes ficam fora das estatísticas até a final."}</p>
    </a>
    <div class="ch-team">${team.length ? team.map((t) => `<a class="ct ${t.ro === "Debuffer" ? "debuff" : ""}" href="#cm-${esc(cm.id)}"><span class="av">${charImg(t.n, true)}</span><b>${esc(t.n)}</b><small>${esc(t.ro || "")}${t.st ? " · " + esc(t.st) : ""}</small></a>`).join("") : `<a class="btn primary" href="#cm-${esc(cm.id)}" style="align-self:center;justify-self:start">Montar time</a>`}</div>
    ${act}
  </section>`;
  }
  function currentPanel(id) {
    const ph = phase(id),
      isCur = CONF.cur === id;
    if (!owner || !db) {
      if (ph === "current")
        return `<div class="banner sched"><p><b>Current CM.</b> ${finalPassed() ? "A final já passou e ele já conta nas estatísticas." : `Entra nas estatísticas depois da final${CONF.date ? ` (${fmtDate(CONF.date)})` : ""}.`}</p></div>`;
      if (ph === "future")
        return `<div class="banner sched"><p>Este CM vem depois do Current CM (${esc(CONF.cur)}), então o que você montar aqui ainda não conta nas estatísticas.</p></div>`;
      return "";
    }
    if (isCur)
      return `<div class="banner sched"><p><b>Current CM.</b> ${finalPassed() ? "A final já passou e ele já conta." : "Ele e os CMs seguintes ficam fora das estatísticas até a final."}</p>
    <span class="confirm"><label class="label" for="cur-date">Final</label><input type="date" id="cur-date" class="search" style="max-width:170px" value="${esc(CONF.date || "")}"><button class="btn primary" type="button" id="cur-save">Salvar data</button><button class="btn" type="button" id="cur-clear">Remover Current CM</button></span></div>`;
    return `<div class="banner sched"><p>${ph === "future" ? `Este CM vem depois do Current CM (${esc(CONF.cur)}) e ainda não conta nas estatísticas.` : "Marque como Current CM o CM que está acontecendo agora."}</p>
    <span class="confirm"><label class="label" for="cur-date">Final</label><input type="date" id="cur-date" class="search" style="max-width:170px"><button class="btn primary" type="button" id="cur-set">Definir como Current CM</button></span></div>`;
  }
  function bindCurrent(id) {
    const dt = $("#cur-date"),
      set = $("#cur-set"),
      clr = $("#cur-clear");
    if (set)
      set.addEventListener("click", () => {
        const v = okDate(dt.value);
        if (v !== false) saveConf({ cur: id, date: v });
      });
    if (clr)
      clr.addEventListener("click", () => saveConf({ cur: null, date: null }));
    const sv = $("#cur-save");
    if (sv)
      sv.addEventListener("click", () => {
        const v = okDate(dt.value);
        if (v !== false) saveConf({ cur: id, date: v });
      });
    if (dt)
      dt.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (sv || set).click();
        }
      });
  }
  function bindSchedule() {
    const go = $("#nx-go");
    if (!go) return;
    go.addEventListener("click", () => {
      const nx = CAT.cms[cmIdx(CONF.cur) + 1];
      const v = okDate($("#nx-date").value);
      if (v !== false) saveConf({ cur: nx.id, date: v });
    });
  }

  let db = null,
    uid = null,
    owner = false,
    canWrite = true;
  const timers = new Map();
  const blank = () => ({
    team: [0, 1, 2].map(() => ({
      n: null,
      ro: "Ace",
      st: null,
      w: null,
      p: Array(6).fill(null),
      d: Array(6).fill(null),
    })),
    rat: ["", "", "", ""],
    pl: "",
  });
  const get = (id) => DATA[id] || (DATA[id] = blank());

  /* ---------- imagens ---------- */
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
  function charImg(name, big) {
    if (!name) return "";
    const c = CHAR.get(name);
    const f =
      c &&
      (big && IMGS.has(c.s)
        ? c.s
        : IMGS.has(c.i)
          ? c.i
          : IMGS.has(c.s)
            ? c.s
            : null);
    return f
      ? spr(f, name)
      : `<span class="ph" title="${esc(name)}">${initials(name)}</span>`;
  }
  function cardImg(key) {
    if (!key) return "";
    const c = CARD.get(key);
    if (c && IMGS.has(c.im)) return spr(c.im, `${c.n} – ${c.t}`);
    const n = c ? c.n : key.split("\n")[0];
    return `<span class="ph" style="background:${c ? typeVar(c.ty) : "var(--surface-2)"};color:#fff" title="${esc(key)}">${esc(n)}</span>`;
  }

  /* ---------- cálculos ---------- */
  function ratingScore(rat) {
    let s = 0,
      n = 0;
    for (const r of rat || []) {
      if (!r) continue;
      const nums = String(r)
        .split("-")
        .map((x) => parseInt(x, 10))
        .filter((x) => !isNaN(x));
      if (!nums.length) continue;
      s += nums.reduce((a, b) => a + b, 0);
      n++;
    }
    return n ? s / (n * 20) : 0;
  }
  const pct = (x) => (Math.round(x * 1000) / 10).toLocaleString("pt-BR") + "%";
  function computeStats() {
    const pl = { "1st": 0, "2nd": 0, "3rd": 0, "B 1st": 0 },
      styles = {},
      aces = {},
      cards = {},
      borrow = {};
    const scores = [];
    for (const cm of CAT.cms) {
      const d = DATA[cm.id];
      if (!d || !counted(cm.id)) continue;
      if (pl[d.pl] !== undefined) pl[d.pl]++;
      const sc = ratingScore(d.rat);
      if (sc > 0) scores.push({ id: cm.id, sc, pl: d.pl });
      for (const t of d.team) {
        if (!t.n || t.ro === "Debuffer") continue;
        aces[t.n] = (aces[t.n] || 0) + 1;
        if (t.st) styles[t.st] = (styles[t.st] || 0) + 1;
        t.d.forEach((k, i) => {
          if (!k) return;
          const m = i === 5 ? borrow : cards;
          m[k] = (m[k] || 0) + 1;
        });
      }
    }
    const tot = PLACES.reduce((a, p) => a + pl[p], 0);
    const top = (m, n) =>
      Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
    const sorted = [...scores].sort((a, b) => b.sc - a.sc);
    return {
      pl,
      tot,
      wr: tot ? pl["1st"] / tot : 0,
      styles,
      aces: top(aces, 10),
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

  /* ---------- roteamento ---------- */
  function setNav(v) {
    const h = location.hash;
    $("#back").hidden = !h.startsWith("#cm-");
    $("#nav-resumo").removeAttribute("aria-current");
    $("#nav-cms").removeAttribute("aria-current");
    $("#nav-" + v).setAttribute("aria-current", "page");
  }
  function route() {
    const h = location.hash.slice(1);
    if (h.startsWith("cm-")) {
      const id = h.slice(3);
      if (CAT.cms.some((c) => c.id === id)) return viewCM(id);
    }
    if (h === "cms") return viewList();
    return viewResumo();
  }
  function importBanner() {
    if (!owner || !db || !uid || Object.keys(DATA).length) return "";
    return `<div class="banner"><p><b>Seus dados da planilha estão prontos para importar.</b> São as composições, colocações e WR de 35 CMs, e ficam salvos só para você.</p><button class="btn primary" id="do-import" type="button">Importar da planilha</button></div>`;
  }

  /* ---------- resumo ---------- */
  function scoreChart(scores, avg) {
    if (!scores.length)
      return '<p class="empty">O WR aparece aqui quando você preencher as rodadas de um CM.</p>';
    const W = 640,
      H = 200,
      L = 34,
      R = 8,
      T = 12,
      B = 28,
      n = scores.length,
      bw = (W - L - R) / n,
      y = (v) => T + (1 - v) * (H - T - B);
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    const every = Math.max(1, Math.ceil(n / 12));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="WR by PvP">`;
    s += ticks
      .map(
        (t) =>
          `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${t * 100}%</text>`,
      )
      .join("");
    scores.forEach((d, i) => {
      const x = L + i * bw,
        w = Math.max(3, bw - 4),
        h = y(0) - y(d.sc),
        r = Math.min(4, w / 2);
      s += `<path d="M${x + 2},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z" fill="${d.pl === "1st" ? "var(--accent)" : "var(--faint)"}" />`;
      s += `<rect class="hit" x="${x}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-i="${i}"/>`;
      if (i % every === 0)
        s += `<text x="${x + bw / 2}" y="${H - B + 14}" text-anchor="middle">${esc(d.id)}</text>`;
    });
    s += `<line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--fg)" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${W - R}" y="${y(avg) - 5}" text-anchor="end" style="fill:var(--fg);font-weight:700">Average WR ${pct(avg)}</text>`;
    return s + '</svg><div class="tip" hidden></div>';
  }
  function viewResumo() {
    setNav("resumo");
    const s = computeStats();
    const empty = s.tot === 0 && !s.aces.length && !s.scores.length;
    const styleMax = Math.max(1, ...Object.values(s.styles));
    const podium = (arr, borrow) =>
      arr.length
        ? `<div class="podium">${arr
            .map(([k, n], i) => {
              const c = CARD.get(k);
              return `<div class="pc ${borrow ? "borrow" : ""}"><div class="art">${cardImg(k)}<span class="rk">${i + 1}</span><span class="ct num">${n}×</span></div><div class="nm">${esc(c ? c.n : k.split("\n")[0])}${c ? `<small>${esc(c.t)}</small>` : ""}</div></div>`;
            })
            .join("")}</div>`
        : '<p class="empty">Nada registrado ainda.</p>';
    $("#app").innerHTML = `
  ${importBanner()}
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
    <div class="panel"><div class="label">Umas (Ace)</div>
      ${s.aces.length ? `<div class="aces">${s.aces.map(([k, n]) => `<div class="ace"><span class="av">${charImg(k, true)}<b class="num">${n}</b></span><span>${esc(k)}</span></div>`).join("")}</div>` : '<p class="empty">Nada registrado ainda.</p>'}
    </div>
    <div class="panel"><div class="label">Style (Ace)</div>
      <div class="bars">${STYLES.map((st) => {
        const n = s.styles[st] || 0;
        return `<div class="bar"><span>${st}</span><span class="t"><i style="width:${(n / styleMax) * 100}%"></i></span><b class="num">${n}</b></div>`;
      }).join("")}</div>
    </div>
  </section>
  <section class="panel"><div class="label">Most Used Cards</div>${podium(s.cards, false)}</section>
  <section class="panel"><div class="label" style="color:var(--pink)">Most Borrowed Cards</div>${podium(s.borrow, true)}</section>`;
    const ch = $("#chart"),
      tip = ch && ch.querySelector(".tip");
    if (tip)
      ch.querySelectorAll(".hit").forEach((r) => {
        const d = s.scores[+r.dataset.i];
        const show = () => {
          const box = ch.getBoundingClientRect(),
            rb = r.getBoundingClientRect();
          tip.hidden = false;
          tip.textContent = `${d.id} · ${pct(d.sc)}${d.pl ? " · " + d.pl : ""}`;
          tip.style.left = rb.left - box.left + rb.width / 2 + "px";
          tip.style.top = rb.top - box.top + (1 - d.sc) * rb.height + "px";
        };
        r.addEventListener("mouseenter", show);
        r.addEventListener("mouseleave", () => (tip.hidden = true));
        r.addEventListener("click", () => (location.hash = "cm-" + d.id));
        r.style.cursor = "pointer";
      });
    bindImport();
    bindSchedule();
  }

  /* ---------- lista ---------- */
  let listQ = "",
    listF = "all";
  function viewList() {
    setNav("cms");
    const rows = CAT.cms.filter(
      (c) =>
        (listF === "all" || (listF === "loh") === c.id.startsWith("LOH")) &&
        (!listQ ||
          [c.id, c.sc, c.tr, c.su, dist(c.m), c.m]
            .join(" ")
            .toLowerCase()
            .includes(listQ.toLowerCase())),
    );
    $("#app").innerHTML = `
  ${importBanner()}
  <section class="lhead"><h1>PvP</h1>
    <div class="seg" role="group" aria-label="Tipo">${[
      ["all", "All"],
      ["cm", "CM"],
      ["loh", "LOH"],
    ]
      .map(
        ([k, t]) =>
          `<button type="button" class="tog" data-f="${k}" aria-pressed="${listF === k}">${t}</button>`,
      )
      .join("")}</div>
    <input class="search" id="lq" type="search" placeholder="Buscar por CM, cenário, pista, distância…" value="${esc(listQ)}"></section>
  <section class="tiles">${
    rows.length
      ? rows
          .map((c) => {
            const d = DATA[c.id];
            const team = d ? d.team.filter((t) => t.n) : [];
            const ph = phase(c.id);
            return `<a class="tile ${ph === "future" ? "future" : ""} ${ph === "current" ? "current" : ""}" href="#cm-${esc(c.id)}">
      <div class="top"><h2><span class="cmid ${c.id.startsWith("LOH") ? "loh" : ""}">${esc(c.id)}</span> <span class="sc">· ${esc(c.nm && c.nm !== "League of Heroes" ? c.nm : c.sc)}</span></h2>${ph === "current" ? `<span class="chip cur">Current${CONF.date ? " · final " + fmtDate(CONF.date).slice(0, 5) : ""}</span>` : ph === "future" ? '<span class="chip none">Not counted</span>' : ""}${d && d.pl ? `<span class="chip ${plClass(d.pl)}">${esc(d.pl)}</span>` : ph === "future" ? "" : `<span class="chip none">${d && d.team.some((t) => t.n) ? "No result" : "Empty"}</span>`}</div>
      <div class="ln num">${esc(c.tr)} · ${c.m || "?"}m · ${esc(c.su)} · ${esc(dist(c.m))}${c.dir ? " · " + esc(c.dir) : ""}</div>
      <div class="cond"><b>${esc(c.sc)}</b>${cond(c) ? " · " + cond(c) : ""}</div>
      <div class="faces">${team.map((t) => `<span class="face ${t.ro === "Debuffer" ? "debuff" : ""}" title="${esc(t.n)} · ${esc(t.ro || "")}">${charImg(t.n, true)}</span>`).join("")}</div>
    </a>`;
          })
          .join("")
      : '<p class="empty">Nenhum CM encontrado.</p>'
  }</section>`;
    const q = $("#lq");
    q.addEventListener("input", () => {
      listQ = q.value;
      const pos = q.selectionStart;
      viewList();
      const n = $("#lq");
      n.focus();
      n.setSelectionRange(pos, pos);
    });
    document.querySelectorAll("[data-f]").forEach((b) =>
      b.addEventListener("click", () => {
        listF = b.dataset.f;
        viewList();
      }),
    );
    bindImport();
  }

  /* ---------- detalhe ---------- */
  function viewCM(id) {
    setNav("cms");
    const cm = CAT.cms.find((c) => c.id === id);
    const i = CAT.cms.indexOf(cm);
    const d = get(id);
    const sc = ratingScore(d.rat);
    const prev = CAT.cms[i - 1],
      next = CAT.cms[i + 1];
    const ro = !canWrite ? "disabled" : "";
    $("#app").innerHTML = `
  <section class="cmhead">
    <div><div class="label">${esc(cm.sc)}${cm.nm ? " · " + esc(cm.nm) : ""}</div><h1 class="cmid ${id.startsWith("LOH") ? "loh" : ""}">${esc(id)}</h1></div>
    <div class="meta"><span class="chip">${esc(cm.tr)}</span><span class="chip">${cm.m || "?"}m</span><span class="chip">${esc(cm.su)}</span><span class="chip">${esc(dist(cm.m))}</span>${[
      cm.dir,
      cm.se,
      cm.we,
      cm.gr,
    ]
      .filter(Boolean)
      .map((x) => `<span class="chip">${esc(x)}</span>`)
      .join("")}</div>
    <div class="nav2">${prev ? `<a class="btn" href="#cm-${esc(prev.id)}">← ${esc(prev.id)}</a>` : ""}<a class="btn" href="#cms">All PvP</a>${next ? `<a class="btn" href="#cm-${esc(next.id)}">${esc(next.id)} →</a>` : ""}</div>
  </section>
  ${currentPanel(id)}
  <section class="result">
    <div class="panel"><div class="label">Final placement</div>
      <div class="places" role="group" aria-label="Final placement">${[...PLACES, ""].map((p) => `<button type="button" ${ro} class="p-${p ? p.replace(" ", "") : "none"}" data-pl="${p}" aria-pressed="${d.pl === p}">${p || "No result"}</button>`).join("")}</div>
    </div>
    <div class="panel"><div class="label">Round WR <span style="text-transform:none;letter-spacing:0;font-weight:500">· quatro números de 0 a 5, ex.: 4-5-4-4</span></div>
      <div class="rats">${d.rat.map((r, k) => `<input id="rat-${k}" ${ro} inputmode="numeric" placeholder="Round ${k + 1}" value="${esc(r)}" aria-label="Round ${k + 1}">`).join("")}</div>
      <div class="score"><b class="num" id="score">${sc ? pct(sc) : "–"}</b><span style="color:var(--muted)">WR</span></div>
    </div>
  </section>
  <section class="team">${d.team.map((t, k) => runnerHTML(t, k, ro)).join("")}</section>`;
    document.querySelectorAll("[data-pl]").forEach((b) =>
      b.addEventListener("click", () => {
        d.pl = b.dataset.pl;
        save(id);
        viewCM(id);
      }),
    );
    d.rat.forEach((_, k) => {
      const inp = $("#rat-" + k);
      inp.addEventListener("input", () => {
        const v = inp.value.trim();
        inp.classList.toggle("bad", !!v && !/^\d(-\d){0,3}$/.test(v));
        d.rat[k] = v;
        const s = ratingScore(d.rat);
        $("#score").textContent = s ? pct(s) : "–";
        save(id);
      });
    });
    d.team.forEach((t, k) => {
      const r = document.querySelector(`.runner[data-k="${k}"]`);
      const pickMain = () =>
        openPicker(
          "char",
          t.n,
          (v) => {
            t.n = v;
            save(id);
            viewCM(id);
          },
          `Uma ${k + 1}`,
        );
      r.querySelector(".main").addEventListener("click", pickMain);
      r.querySelector(".rname").addEventListener("click", pickMain);
      r.querySelector("[name=ro]").addEventListener("change", (e) => {
        t.ro = e.target.value;
        save(id);
        viewCM(id);
      });
      r.querySelector("[name=st]").addEventListener("change", (e) => {
        t.st = e.target.value || null;
        save(id);
      });
      const w = r.querySelector("[name=w]");
      w.addEventListener("input", () => {
        const v = parseInt(w.value, 10);
        t.w = isNaN(v) ? null : v;
        r.querySelector(".wrp").textContent = t.w != null ? pct(t.w / 80) : "";
        save(id);
      });
      r.querySelectorAll("[data-p]").forEach((b) =>
        b.addEventListener("click", () => {
          const j = +b.dataset.p;
          openPicker(
            "char",
            t.p[j],
            (v) => {
              t.p[j] = v;
              save(id);
              viewCM(id);
            },
            `${PAR[j]} · ${t.n || "Uma " + (k + 1)}`,
          );
        }),
      );
      r.querySelectorAll("[data-d]").forEach((b) =>
        b.addEventListener("click", () => {
          const j = +b.dataset.d;
          openPicker(
            "card",
            t.d[j],
            (v) => {
              t.d[j] = v;
              save(id);
              viewCM(id);
            },
            j === 5 ? "Borrowed card" : `Support card ${j + 1}`,
          );
        }),
      );
    });
    bindCurrent(id);
  }
  function runnerHTML(t, k, ro) {
    const slot = (cls, inner, attrs, label, empty, extra = "") =>
      `<button type="button" ${ro} class="slot ${cls} ${inner ? "filled" : ""}" ${attrs} aria-label="${esc(label)}" title="${esc(label)}">${inner || empty}${extra}</button>`;
    const ps = (j) =>
      slot(
        j === 0 || j === 3 ? "par" : "gp",
        t.p[j] ? charImg(t.p[j]) : "",
        `data-p="${j}"`,
        `${PAR[j]}: ${t.p[j] || "empty"}`,
        PAR[j],
      );
    return `<article class="panel runner ${t.ro === "Debuffer" ? "debuff" : ""}" data-k="${k}">
    <div class="rtop">${slot("main", t.n ? charImg(t.n, true) : "", "", t.n ? `Change ${t.n}` : "Choose Uma", '<span class="plus">+</span>')}
      <div><button type="button" class="rname" ${ro}>${t.n ? esc(t.n) : `<span style="color:var(--muted)">Uma ${k + 1}</span>`}</button>
        <div class="fields">
          <label class="nolab"><select name="ro" ${ro} aria-label="Ace ou Debuffer">${ROLES.map((r) => `<option ${t.ro === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
          <label class="nolab"><select name="st" ${ro} aria-label="Style"><option value="">Style —</option>${STYLES.map((s) => `<option ${t.st === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label>Wins<span class="wins"><input name="w" ${ro} type="number" min="0" max="80" inputmode="numeric" value="${t.w ?? ""}" aria-label="Wins (de 80)"><span class="num wrp" style="color:var(--muted)">${t.w != null ? pct(t.w / 80) : ""}</span></span></label>
        </div></div></div>
    <div class="lower">
      <div><div class="label">Parents</div>
        <div class="tree">
          <span class="apex">${t.n ? charImg(t.n) : '<span class="ph">?</span>'}</span>
          ${ps(0)}${ps(3)}
          ${ps(1)}${ps(2)}${ps(4)}${ps(5)}
        </div></div>
      <div><div class="label">Deck</div>
        <div class="deck">${t.d.map((c, j) => slot(j === 5 ? "borrow" : "", c ? cardImg(c) : "", `data-d="${j}"`, `${j === 5 ? "Borrowed card" : "Card " + (j + 1)}: ${c ? c.replace("\n", " ") : "empty"}`, j === 5 ? "" : "+", j === 5 ? '<span class="tag">BORROW</span>' : "")).join("")}</div></div>
    </div>
  </article>`;
  }

  /* ---------- seletor ---------- */
  let pk = null;
  const pkState = { q: "", rar: new Set(), ty: new Set() };
  function openPicker(kind, current, onPick, title) {
    pk = { kind, onPick };
    pkState.q = "";
    $("#pk-q").value = "";
    $("#pk-title").textContent = title;
    $("#pk-remove").hidden = !current;
    $("#pk-fil").innerHTML =
      kind === "card"
        ? ["SSR", "SR"]
            .map(
              (r) =>
                `<button type="button" class="tog" data-rar="${r}" aria-pressed="${pkState.rar.has(r)}">${r}</button>`,
            )
            .join("") +
          '<span style="width:8px"></span>' +
          TYPES.map(
            (t) =>
              `<button type="button" class="tog" data-ty="${t}" aria-pressed="${pkState.ty.has(t)}"><span class="ty" style="background:${typeVar(t)}"></span>${t}</button>`,
          ).join("")
        : "";
    $("#pk-fil").hidden = kind !== "card";
    $("#pk-fil")
      .querySelectorAll(".tog")
      .forEach((b) =>
        b.addEventListener("click", () => {
          const set = b.dataset.rar ? pkState.rar : pkState.ty;
          const v = b.dataset.rar || b.dataset.ty;
          set.has(v) ? set.delete(v) : set.add(v);
          b.setAttribute("aria-pressed", set.has(v));
          renderPick();
        }),
      );
    renderPick();
    $("#picker").showModal();
    $("#pk-q").focus();
  }
  function renderPick() {
    const q = pkState.q.toLowerCase();
    const L = $("#pk-list");
    L.classList.toggle("cards", pk.kind === "card");
    let items;
    if (pk.kind === "char")
      items = CAT.chars
        .filter((c) => !q || c.n.toLowerCase().includes(q))
        .map(
          (c) =>
            `<button type="button" data-v="${esc(c.n)}"><span class="im">${charImg(c.n)}</span><span>${esc(c.n)}</span></button>`,
        );
    else
      items = CAT.cards
        .filter(
          (c) =>
            (!q || (c.n + " " + c.t).toLowerCase().includes(q)) &&
            (!pkState.rar.size || pkState.rar.has(c.r)) &&
            (!pkState.ty.size || pkState.ty.has(c.ty)),
        )
        .map(
          (c) =>
            `<button type="button" data-v="${esc(c.k)}"><span class="im">${cardImg(c.k)}</span><span><b>${esc(c.n)}</b><br><small>${esc(c.t)}</small><br><small><span class="ty" style="background:${typeVar(c.ty)}"></span>${esc(c.ty)} · ${esc(c.r)}</small></span></button>`,
        );
    L.innerHTML = items.length
      ? items.join("")
      : '<p class="empty">Nada encontrado com esse filtro.</p>';
    L.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        const f = pk.onPick;
        $("#picker").close();
        f(b.dataset.v);
      }),
    );
  }
  $("#pk-q").addEventListener("input", (e) => {
    pkState.q = e.target.value;
    renderPick();
  });
  $("#pk-close").addEventListener("click", () => $("#picker").close());
  $("#pk-remove").addEventListener("click", () => {
    const f = pk.onPick;
    $("#picker").close();
    f(null);
  });
  $("#picker").addEventListener("click", (e) => {
    if (e.target === $("#picker")) $("#picker").close();
  });

  /* ---------- salvar ---------- */
  const LSKEY = "cmcomps:data:v1";
  const status = (t, err) => {
    const s = $("#status");
    s.textContent = t;
    s.classList.toggle("err", !!err);
  };
  function save(id) {
    if (!db || !uid || !canWrite) {
      status(
        !canWrite
          ? "Somente leitura"
          : "Sem conexão: as mudanças não estão sendo salvas",
        true,
      );
      return;
    }
    status("Salvando…");
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => flush(id), 700),
    );
  }
  const writing = new Map();
  async function flush(id) {
    timers.delete(id);
    const prev = writing.get(id) || Promise.resolve();
    const p = prev.then(async () => {
      try {
        localStorage.setItem(LSKEY, JSON.stringify(DATA));
        if (!timers.size) status("Salvo neste navegador");
      } catch (e) {
        status(
          "Este navegador não deixou salvar. Use “Baixar backup” para não perder seus dados.",
          true,
        );
      }
    });
    writing.set(id, p);
    await p;
  }

  /* ---------- importação (só o dono) ---------- */
  function bindImport() {
    const b = $("#do-import");
    if (!b) return;
    b.addEventListener("click", async () => {
      b.disabled = true;
      b.textContent = "Importando…";
      try {
        const seed = await (await fetch("seed.json")).json();
        const ids = Object.keys(seed);
        let n = 0;
        for (const id of ids) {
          DATA[id] = seed[id];
          await db
            .collection("data/users/" + uid)
            .doc("cm_" + id)
            .set(seed[id]);
          n++;
          b.textContent = `Importando… ${n}/${ids.length}`;
        }
        status("Planilha importada");
        route();
      } catch (e) {
        b.disabled = false;
        b.textContent = "Tentar de novo";
        status("A importação parou no meio. Clique em “Tentar de novo”.", true);
      }
    });
  }

  /* ---------- backup ---------- */
  $("#bk-down").addEventListener("click", () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { app: "cmcomps", v: 1, saved: new Date().toISOString(), data: DATA },
          null,
          1,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "cmcomps-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  });
  $("#bk-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const d = j && j.app === "cmcomps" ? j.data : null;
      if (!d || typeof d !== "object") throw 0;
      const n = Object.keys(d).length;
      if (
        Object.keys(DATA).length &&
        !confirm(
          `Carregar este backup (${n} PvPs)? Ele substitui o que está salvo neste navegador.`,
        )
      )
        return;
      DATA = d;
      localStorage.setItem(LSKEY, JSON.stringify(DATA));
      status(`Backup carregado: ${n} PvPs`);
      route();
    } catch (_) {
      status("Esse arquivo não é um backup do CM Comps.", true);
    }
  });

  /* ---------- início ---------- */
  const HIST = [];
  let lastHash = location.hash,
    skipPush = false;
  $("#back").addEventListener("click", () => {
    if (HIST.length) {
      skipPush = true;
      location.hash = HIST.pop() || "resumo";
    } else location.hash = location.hash.startsWith("#cm-") ? "cms" : "resumo";
  });
  window.addEventListener("hashchange", () => {
    if (!skipPush && lastHash !== location.hash) HIST.push(lastHash);
    skipPush = false;
    lastHash = location.hash;
    if ($("#picker").open) $("#picker").close();
    window.scrollTo(0, 0);
    route();
  });
  route();
  (() => {
    CONF = window.CM_CONFIG;
    try {
      const raw = localStorage.getItem(LSKEY);
      if (raw) DATA = JSON.parse(raw) || {};
    } catch (e) {
      status(
        "Este navegador está bloqueando o salvamento (aba anônima?)",
        true,
      );
    }
    db = "local";
    uid = "local";
    owner = false;
    status(Object.keys(DATA).length ? "Salvo neste navegador" : "Pronto");
    route();
  })();
})();
