// Testes das regras e cálculos (logic.js). Rodar: npm run test:unit
const { test } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logic.js");

const CMS = [{ id: "CM1" }, { id: "CM2" }, { id: "LOH1" }, { id: "CM3" }];
const day = (s) => new Date(s + "T12:00:00");

test("distância segue as faixas da planilha", () => {
  assert.equal(L.dist(1200), "Sprint");
  assert.equal(L.dist(1400), "Sprint");
  assert.equal(L.dist(1401), "Mile");
  assert.equal(L.dist(1999), "Mile");
  assert.equal(L.dist(2000), "Medium");
  assert.equal(L.dist(2400), "Medium");
  assert.equal(L.dist(2401), "Long");
  assert.equal(L.dist(null), "");
});

test("WR das rodadas: soma ÷ (rodadas preenchidas × 20)", () => {
  assert.equal(L.ratingScore(["4-5-4-4", "", "", ""]), 17 / 20);
  assert.equal(L.ratingScore(["5-5-5-5", "5-5-5-5"]), 1);
  // mesmos números do CM20 da planilha
  assert.equal(
    L.ratingScore(["4-4-5-4", "5-5-5-5", "4-5-4-5", "2-3-1-4"]),
    65 / 80,
  );
  assert.equal(L.ratingScore(["", "", "", ""]), 0);
  assert.equal(L.ratingScore(undefined), 0);
});

test("dia de round válido: tentativas (5-4-3-5) ou total do dia (17)", () => {
  for (const ok of [
    "",
    "4",
    "17",
    "20",
    "0",
    "4-5",
    "4-5-4-4",
    "0-0-0-0",
    "12/15",
    "0/5",
    "20/20",
  ])
    assert.ok(L.isValidRound(ok), ok);
  for (const bad of [
    "21",
    "6-5-4-4",
    "4-5-4-4-4",
    "4--5",
    "abc",
    "-3",
    "16/15",
    "5/0",
    "21/21",
  ])
    assert.ok(!L.isValidRound(bad), bad);
});

test("total do dia e tentativas dão o mesmo WR", () => {
  assert.equal(L.ratingScore(["17"]), L.ratingScore(["4-5-4-4"]));
  assert.equal(L.ratingScore(["17", "", "20", ""]), 37 / 40);
});

test("sem Current CM, todos os PvPs contam", () => {
  const conf = { cur: null, date: null };
  for (const c of CMS) assert.ok(L.counted(CMS, conf, c.id));
});

test("Current CM: anteriores contam, ele só depois da final, seguintes nunca", () => {
  const conf = { cur: "CM2", date: "2026-11-06" };
  const before = day("2026-11-06");
  const after = day("2026-11-07");
  assert.equal(L.phase(CMS, conf, "CM1"), "past");
  assert.equal(L.phase(CMS, conf, "CM2"), "current");
  assert.equal(L.phase(CMS, conf, "LOH1"), "future");

  assert.ok(L.counted(CMS, conf, "CM1", before));
  assert.ok(!L.counted(CMS, conf, "CM2", before), "atual antes da final");
  assert.ok(L.counted(CMS, conf, "CM2", after), "atual depois da final");
  assert.ok(!L.counted(CMS, conf, "LOH1", after), "seguinte nunca conta");
  assert.ok(!L.counted(CMS, conf, "CM3", after));
});

test("data inválida (ex.: ano 0002) nunca conta como final concluída", () => {
  const conf = { cur: "CM2", date: "0002-11-06" };
  assert.ok(!L.finalPassed(conf, day("2026-12-01")));
  assert.equal(L.daysToFinal(conf), null);
  assert.equal(
    L.daysToFinal({ cur: "CM2", date: "2026-11-06" }, day("2026-11-04")),
    3,
  );
});

function rec(over) {
  return { ...L.blankRecord(), ...over };
}
function uma(n, ro, st, deck) {
  return {
    n,
    ro,
    st,
    w: null,
    p: Array(6).fill(null),
    d: deck || Array(6).fill(null),
  };
}

test("estatísticas: colocações, WR, Aces e cartas (Debuffers ficam de fora)", () => {
  const data = {
    CM1: rec({
      pl: "1st",
      rat: ["5-5-5-5", "", "", ""],
      team: [
        uma("Oguri Cap", "Ace", "Pace Chaser", ["A", "B", "C", "D", "E", "X"]),
        uma("Nice Nature", "Debuffer", "Late Surger", [
          "A",
          "A",
          "A",
          "A",
          "A",
          "Y",
        ]),
        uma(null, "Ace", null),
      ],
    }),
    CM2: rec({
      pl: "2nd",
      rat: ["2-2-2-2", "", "", ""],
      team: [
        uma("Oguri Cap", "Ace", "Pace Chaser", [
          "A",
          "B",
          null,
          null,
          null,
          "X",
        ]),
        uma("Gold Ship", "Ace", "End Closer"),
        uma(null, "Ace", null),
      ],
    }),
  };
  const s = L.computeStats(CMS, data);
  assert.equal(s.tot, 2);
  assert.equal(s.wr, 0.5);
  assert.deepEqual(s.pl, { "1st": 1, "2nd": 1, "3rd": 0, "B 1st": 0 });
  assert.deepEqual(s.aces, [
    ["Oguri Cap", 2],
    ["Gold Ship", 1],
  ]);
  assert.deepEqual(s.styles, { "Pace Chaser": 2, "End Closer": 1 });
  assert.deepEqual(s.cards.slice(0, 2), [
    ["A", 2],
    ["B", 2],
  ]);
  assert.deepEqual(s.borrow, [["X", 2]], "só o 6º slot conta como emprestada");
  assert.equal(s.best.id, "CM1");
  assert.equal(s.worst.id, "CM2");
  assert.equal(s.avg, (1 + 0.4) / 2);
});

test("lista de Aces mostra todas, não só as 10 mais usadas", () => {
  const data = {};
  for (let i = 0; i < 15; i++)
    data["CM" + i] = rec({
      team: [
        uma("Uma " + i, "Ace", null),
        uma(null, "Ace", null),
        uma(null, "Ace", null),
      ],
    });
  const cms = Object.keys(data).map((id) => ({ id }));
  assert.equal(L.computeStats(cms, data).aces.length, 15);
});

test("estatísticas respeitam o que não conta", () => {
  const data = { CM1: rec({ pl: "1st" }), CM2: rec({ pl: "1st" }) };
  const s = L.computeStats(CMS, data, (id) => id !== "CM2");
  assert.equal(s.tot, 1);
});

test("migração: mapa antigo sem versão vira o formato atual, completo", () => {
  const old = {
    CM1: { pl: "1st", rat: ["4-5-4-4"], team: [{ n: "Oguri Cap", d: ["A"] }] },
  };
  const out = L.migrate(old);
  assert.equal(out.CM1.pl, "1st");
  assert.equal(out.CM1.rat.length, 4);
  assert.equal(out.CM1.team.length, 3);
  assert.equal(out.CM1.team[0].d.length, 6);
  assert.equal(out.CM1.team[0].d[0], "A");
  assert.equal(out.CM1.team[0].ro, "Ace");
  assert.equal(out.CM1.team[1].n, null);
});

test("migração: corrige valores estranhos em vez de quebrar", () => {
  const out = L.migrate({
    v: 1,
    data: { CM1: { pl: "1º lugar", rat: "x", team: "x" }, "../ruim": {} },
  });
  assert.equal(out.CM1.pl, "");
  assert.equal(out.CM1.team.length, 3);
  assert.ok(!("../ruim" in out), "ids estranhos são ignorados");
});

test("migração recusa dados de uma versão mais nova", () => {
  assert.throws(
    () => L.migrate({ v: L.SCHEMA + 1, data: {} }),
    /newer version/,
  );
});

test("backup: ida e volta preserva os dados e ignora PvPs vazios", () => {
  const data = {
    CM1: rec({ pl: "1st", rat: ["4-5-4-4", "", "", ""] }),
    CM2: L.blankRecord(),
  };
  const backup = L.makeBackup(data, new Date("2026-10-27T12:00:00Z"));
  assert.equal(backup.app, "cmcomps");
  assert.equal(backup.v, L.SCHEMA);
  assert.deepEqual(Object.keys(backup.data), ["CM1"]);
  const back = L.parseBackup(JSON.stringify(backup));
  assert.deepEqual(back.CM1, data.CM1);
});

test("backup: arquivo que não é do CM Comps é recusado", () => {
  assert.throws(() => L.parseBackup("não é json"), /not a Comps backup/);
  assert.throws(
    () => L.parseBackup('{"app":"outro","data":{}}'),
    /not a Comps backup/,
  );
});

/* ---------- Current PvP automático pelas datas ---------- */
const SCHED_CMS = [
  { id: "CM20" },
  { id: "CM21" },
  { id: "CM22" },
  { id: "LOH1" },
];
const SCHED = {
  CM20: { end: "2026-10-16" },
  CM21: { end: "2026-11-06", est: true },
};

test("datas: soma de dias atravessa mês e ano", () => {
  assert.equal(L.addDays("2026-10-16", 21), "2026-11-06");
  assert.equal(L.addDays("2026-12-25", 10), "2027-01-04");
});

test("PvPs sem data são estimados a partir da final anterior + 21 dias", () => {
  const full = L.fillSchedule(SCHED_CMS, SCHED);
  assert.deepEqual(full.CM22, { end: "2026-11-27", est: true, auto: true });
  assert.deepEqual(full.LOH1, { end: "2026-12-18", est: true, auto: true });
  assert.equal(full.CM20.est, false);
});

test("Current PvP é o primeiro cuja final ainda não passou", () => {
  const cur = L.resolveCurrent(SCHED_CMS, SCHED, {}, day("2026-10-27"));
  assert.equal(cur.cur, "CM21");
  assert.equal(cur.date, "2026-11-06");
  assert.equal(cur.est, true);
  // no dia seguinte à final do CM20, ele já não é mais o atual
  assert.equal(
    L.resolveCurrent(SCHED_CMS, SCHED, {}, day("2026-10-17")).cur,
    "CM21",
  );
  assert.equal(
    L.resolveCurrent(SCHED_CMS, SCHED, {}, day("2026-10-16")).cur,
    "CM20",
  );
});

test("opção A: com final estimada, o PvP só conta 3 dias depois", () => {
  const est = { date: "2026-11-06", est: true };
  assert.ok(!L.finalPassed(est, day("2026-11-07")));
  assert.ok(!L.finalPassed(est, day("2026-11-09")));
  assert.ok(L.finalPassed(est, day("2026-11-10")));
  // com data oficial, conta logo após a final
  assert.ok(L.finalPassed({ date: "2026-11-06" }, day("2026-11-07")));
  // e o Current PvP só troca depois da folga
  assert.equal(
    L.resolveCurrent(SCHED_CMS, SCHED, {}, day("2026-11-09")).cur,
    "CM21",
  );
  assert.equal(
    L.resolveCurrent(SCHED_CMS, SCHED, {}, day("2026-11-10")).cur,
    "CM22",
  );
});

test("Current PvP pode ser forçado manualmente", () => {
  const cur = L.resolveCurrent(
    SCHED_CMS,
    SCHED,
    { cur: "CM22", date: "2026-11-30" },
    day("2026-10-27"),
  );
  assert.deepEqual(cur, {
    cur: "CM22",
    date: "2026-11-30",
    est: false,
    manual: true,
  });
  // config inválida é ignorada
  assert.equal(
    L.resolveCurrent(SCHED_CMS, SCHED, { cur: "XYZ" }, day("2026-10-27")).cur,
    "CM21",
  );
});

test("limit break: 0 a 4 (MLB); dados antigos sem LB continuam válidos", () => {
  assert.equal(L.lbValue("0"), 0);
  assert.equal(L.lbValue("4"), 4);
  assert.equal(L.lbValue(""), null);
  assert.equal(L.lbValue("5"), null);
  assert.equal(L.LB_LABELS[4], "MLB");
  const old = L.migrate({ CM1: { team: [{ n: "Oguri Cap", d: ["A"] }] } });
  assert.deepEqual(old.CM1.team[0].lb, [null, null, null, null, null, null]);
  const rec = L.blankRecord();
  rec.team[0].lb[2] = 3;
  assert.ok(!L.isEmptyRecord(rec), "LB preenchido conta como dado salvo");
});

/* ---------- Affinity ---------- */
global.window = global.window || {};
require("../affinity.js");
const AFF = global.window.CM_AFFINITY;

test("id do personagem sai do nome do ícone", () => {
  assert.equal(L.charaId("chr_icon_1006_100646_01.webp"), "1006");
  assert.equal(L.charaId(""), null);
});

test("affinity base bate com a calculadora da GameTora (120)", () => {
  // Uma: Oguri Cap · P1: Biwa Hayahide (Fuji Kiseki, Taiki Shuttle)
  // P2: TM Opera O (Smart Falcon, Sakura Bakushin O)
  const a = L.affinity(
    "1006",
    ["1023", "1005", "1010", "1015", "1046", "1041"],
    AFF,
  );
  assert.deepEqual(
    a.parts.map((p) => p.value),
    [20, 22, 40, 10, 9, 10, 9],
  );
  assert.equal(a.total, 120);
  assert.equal(a.mark, "○");
});

test("affinity: segmentos com alguém faltando ficam vazios e não somam", () => {
  const a = L.affinity("1006", ["1023", null, null, null, null, null], AFF);
  assert.equal(a.parts[0].value, 20);
  assert.ok(a.parts.slice(1).every((p) => p.value === null));
  assert.equal(a.total, 20);
  assert.equal(a.mark, "△");
  assert.equal(L.affinityMark(151), "◎");
  assert.equal(L.affinityOf(["1006", "1006"], AFF), 0, "mesma personagem");
});

test("affinity: Umas ainda incompletas no global usam os números do JP", () => {
  // Fuji Kiseki × Daitaku Helios: 1 nos dados do global, 29 no JP
  assert.equal(L.affinityOf(["1005", "1065"], AFF), 29);
  // Satono Diamond × Kitasan Black continua pelo global (33; no JP é 34)
  assert.equal(L.affinityOf(["1067", "1068"], AFF), 33);
});

test("rounds: WR usa as corridas realmente feitas", () => {
  assert.deepEqual(L.parseRound("5-4-3"), { wins: 12, races: 15 });
  assert.deepEqual(L.parseRound("12/15"), { wins: 12, races: 15 });
  assert.deepEqual(L.parseRound("17"), { wins: 17, races: 20 });
  assert.equal(L.ratingScore(["5-4-3"]), 12 / 15);
  assert.equal(L.ratingScore(["12/15", "17", "", ""]), 29 / 35);
  assert.equal(L.ratingScore(["17/20"]), L.ratingScore(["4-5-4-4"]));
});

test("Wins da Uma: total = corridas dos rounds preenchidos, ou 80", () => {
  assert.equal(L.winsTotal(["", "", "", ""]), 80);
  assert.equal(L.winsTotal(undefined), 80);
  assert.equal(L.winsTotal(["5-4-3", "12/15", "17", "x"]), 50);
});

test("estatísticas novas: WR por distância e cenário; parents e avós", () => {
  const cms = [
    { id: "A", sc: "URA Finale", su: "Turf", m: 1200 },
    { id: "B", sc: "URA Finale", su: "Dirt", m: 1600 },
    { id: "C", sc: "Unity Cup", su: "Turf", m: 2500 },
  ];
  const u = (n, ro, st, w, p, d) => ({
    n,
    ro,
    st,
    w,
    p: p || Array(6).fill(null),
    d: d || Array(6).fill(null),
    lb: Array(6).fill(null),
  });
  const data = {
    A: rec({
      pl: "1st",
      rat: ["17", "", "", ""], // 20 corridas
      team: [
        u(
          "Oguri Cap",
          "Ace",
          "Pace Chaser",
          15,
          ["Gold Ship", "Vodka", null, "Gold Ship", null, null],
          ["X", "Y", null, null, null, "Z"],
        ),
        u(
          "Nice Nature",
          "Debuffer",
          "Late Surger",
          2,
          ["Gold Ship", null, null, null, null, null],
          ["W"],
        ),
        u(null, "Ace", null, null),
      ],
    }),
    B: rec({
      pl: "2nd",
      rat: ["10/20", "", "", ""],
      team: [
        u("Oguri Cap", "Ace", "Pace Chaser", 10, null, ["X"]),
        u(null, "Ace", null, null),
        u(null, "Ace", null, null),
      ],
    }),
    C: rec({
      pl: "3rd",
      rat: ["5-5-5-5"],
      team: [
        u(null, "Ace", null, null),
        u(null, "Ace", null, null),
        u(null, "Ace", null, null),
      ],
    }),
  };
  const s = L.computeStats(cms, data);
  assert.deepEqual(s.byDist.Sprint, { sum: 0.85, n: 1 });
  assert.deepEqual(s.byDist.Dirt, { sum: 0.5, n: 1 });
  assert.deepEqual(s.byDist.Long, { sum: 1, n: 1 });
  assert.deepEqual(
    s.byScenario.map((r) => [r.sc, r.n]),
    [
      ["URA Finale", 2],
      ["Unity Cup", 1],
    ],
  );
  assert.equal(s.byScenario[0].avg, (0.85 + 0.5) / 2);
  assert.deepEqual(s.parents, [["Gold Ship", 3]]);
  assert.deepEqual(s.grandparents, [["Vodka", 1]]);
});
