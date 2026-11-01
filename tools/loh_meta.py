"""
Gera meta.js: resumo "JP meta" de cada LoH a partir dos dados do BWIKI (top 300 times).

Entradas:
  all_loh.json  {"LOH1": {"rows": [[rank, card_id, estilo, 1st, total, [cartas], spd, sta, pow, wiz, guts], ...],
                          "sk": [[skill_id, nº de Umas], ...]}, ...}
                (montado das páginas Data:LOH/<data>.json do BWIKI; LoHs divididos em -1/-2 já juntos)
  charmap.json  {nome da Uma no site: card_id do JP} (GameTora: costume → ícone do site)
  skn.json      {skill_id: [nome, ...]} (GameTora)
  data.js       catálogo do site (tipo das cartas)

Uso: python3 tools/loh_meta.py all_loh.json charmap.json skn.json data.js [note_meta.json] > meta.js
(note_meta.json: LoHs que o BWIKI não tem, gerados por tools/loh_meta_note.py)
"""
import collections as C
import json
import re
import sys

loh_f, charmap_f, skn_f, data_f = sys.argv[1:5]
ALL = json.load(open(loh_f))
JP2SITE = {str(v): k for k, v in json.load(open(charmap_f)).items()}
SKN = json.load(open(skn_f))
cat = json.loads(re.search(r"^window\.CM_CATALOG = (.*);$", open(data_f).read(), re.M).group(1))
CTYPE = {c["id"]: c["ty"] for c in cat["cards"]}

# Data das páginas do BWIKI (dados publicados depois de cada LoH)
DATES = {"LOH1": "2023-05-26", "LOH2": "2023-07-20", "LOH3": "2023-09-19", "LOH4": "2023-11-18",
         "LOH5": "2024-01-19", "LOH6": "2024-05-20", "LOH7": "2024-07-28", "LOH8": "2024-09-29",
         "LOH10": "2025-02-22", "LOH11": "2025-06-01", "LOH13": "2025-11-27", "LOH14": "2026-02-22",
         "LOH15": "2026-05-30", "LOH16": "2026-08-21"}
ST = {1: "Front Runner", 2: "Pace Chaser", 3: "Late Surger", 4: "End Closer", 5: "Runaway"}
ORDER = ["Speed", "Stamina", "Power", "Guts", "Wit", "Pal", "Group"]
pct = lambda a, b: round(100 * a / b, 1) if b else 0
missing = set()


def sname(i):
    s = SKN.get(str(i))
    if s:
        return s[0]
    if 900000 <= i < 1000000:  # versão herdada (inherited) de uma skill única
        b = SKN.get(str(i - 800000))
        if b:
            return b[0] + " (inherited)"
    return None


def summary(pvp, d):
    R = [dict(rank=r[0], card=str(r[1]), st=ST[r[2]], w1=r[3], tot=r[4], sup=[str(c) for c in r[5]],
              spd=r[6], sta=r[7], pow=r[8], wiz=r[9], gut=r[10]) for r in d["rows"]]
    N = len(R)
    teams = C.defaultdict(list)
    for r in R:
        teams[r["rank"]].append(r)

    styles = []
    for s in ST.values():
        rs = [r for r in R if r["st"] == s]
        if rs:
            styles.append({"st": s, "use": pct(len(rs), N),
                           "win": pct(sum(r["w1"] for r in rs), sum(r["tot"] for r in rs))})

    combos = [{"st": list(k), "use": pct(v, len(teams))}
              for k, v in C.Counter(tuple(sorted((x["st"] for x in t), key=list(ST.values()).index))
                                    for t in teams.values()).most_common(5)]

    umas = []
    for cid, n in C.Counter(r["card"] for r in R).most_common(10):
        if pct(n, N) < 1:  # menos de 1% das Umas do top: não entra
            continue
        rs = [r for r in R if r["card"] == cid]
        name = JP2SITE.get(cid)
        if not name:
            missing.add(cid)
        umas.append({
            "n": name or cid,
            "site": bool(name),  # False = roupa que o site ainda não tem (só no JP)
            "st": C.Counter(r["st"] for r in rs).most_common(1)[0][0],
            "use": pct(n, N),
            "win": pct(sum(r["w1"] for r in rs), sum(r["tot"] for r in rs)),
        })

    decks = {}
    for s in ST.values():
        rs = [r for r in R if r["st"] == s]
        if len(rs) < max(10, N * 0.05):
            continue
        structs = C.Counter(
            tuple(sorted(C.Counter(CTYPE.get(c, "?") for c in r["sup"]).items(),
                         key=lambda x: (-x[1], ORDER.index(x[0]) if x[0] in ORDER else 9)))
            for r in rs)
        cards = C.Counter(c for r in rs for c in set(r["sup"]))
        decks[s] = {
            "n": len(rs),
            "structs": [{"t": [[t, k] for t, k in st], "use": pct(v, len(rs))} for st, v in structs.most_common(3)],
            "cards": [{"id": c, "use": pct(v, len(rs))} for c, v in cards.most_common(10) if c in CTYPE],
            "stats": {k: round(sum(r[k] for r in rs) / len(rs)) for k in ["spd", "sta", "pow", "gut", "wiz"]},
        }

    skl = []
    for i, v in d["sk"]:
        n = sname(int(i))
        if n:
            skl.append({"n": n, "use": pct(v, N)})
        if len(skl) == 12:
            break

    return {"src": "BWIKI", "date": DATES[pvp], "teams": len(teams), "styles": styles,
            "combos": combos, "umas": umas, "decks": decks, "skills": skl}


out = {k: summary(k, v) for k, v in ALL.items()}
if len(sys.argv) > 5:
    out.update(json.load(open(sys.argv[5])))
out = {k: out[k] for k in sorted(out, key=lambda k: int(k[3:]))}
print('// "JP meta": resumo do top 300 do ranking do JP para cada LoH (fonte: BWIKI).')
print("// Gerado por tools/loh_meta.py; não editar à mão.")
print("window.CM_META = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";")
if missing:
    print("Roupas do JP sem nome no site:", sorted(missing), file=sys.stderr)
