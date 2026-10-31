"""
Gera o resumo "JP meta" de um LoH a partir dos dados do BWIKI (top 300 times).

Entrada: rows.json com uma linha por Uma:
  [rank, membro, card_id, estilo, nota, pontos, spd, sta, pow, wiz, guts,
   1st, 2nd, 3rd, fora, total, [cartas], carta_emprestada, [skills]]
Saída: o objeto daquele PvP em meta.js (impresso em JSON).

Uso: python3 tools/loh_meta.py rows.json LOH1 2023-05-26 cat.json skills.json
"""
import collections as C
import json
import sys

rows_f, pvp, date, cat_f, skills_f = sys.argv[1:6]
rows = json.load(open(rows_f))
cat = json.load(open(cat_f))  # {"chars": {card_id: nome}, "cards": {id: [...]}}
skills = json.load(open(skills_f))["out"]
extra = json.loads(sys.argv[6]) if len(sys.argv) > 6 else {}  # nomes de roupas que não estão no site

ST = {1: "Front Runner", 2: "Pace Chaser", 3: "Late Surger", 4: "End Closer", 5: "Runaway"}
R = [
    dict(rank=r[0], card=r[2], st=ST[r[3]], spd=r[6], sta=r[7], pow=r[8], wiz=r[9], gut=r[10],
         w1=r[11], tot=r[15], sup=[str(c) for c in r[16]], sk=r[18])
    for r in rows
]
N = len(R)
teams = C.defaultdict(list)
for r in R:
    teams[r["rank"]].append(r)

pct = lambda a, b: round(100 * a / b, 1) if b else 0

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
    rs = [r for r in R if r["card"] == cid]
    name = cat["chars"].get(str(cid))
    umas.append({
        "n": name or extra.get(str(cid), str(cid)),
        "site": bool(name),  # False = roupa que o site ainda não tem (só no JP)
        "st": C.Counter(r["st"] for r in rs).most_common(1)[0][0],
        "use": pct(n, N),
        "win": pct(sum(r["w1"] for r in rs), sum(r["tot"] for r in rs)),
    })

def ctype(c):
    v = cat["cards"].get(c)
    return v[2] if v else "?"

order = ["Speed", "Stamina", "Power", "Guts", "Wit", "Pal", "Group"]
decks = {}
for s in ST.values():
    rs = [r for r in R if r["st"] == s]
    if len(rs) < max(10, N * 0.05):
        continue
    structs = C.Counter(
        tuple(sorted(C.Counter(ctype(c) for c in r["sup"]).items(),
                     key=lambda x: (-x[1], order.index(x[0]) if x[0] in order else 9)))
        for r in rs)
    cards = C.Counter(c for r in rs for c in set(r["sup"]))
    decks[s] = {
        "n": len(rs),
        "structs": [{"t": [[t, k] for t, k in st], "use": pct(v, len(rs))} for st, v in structs.most_common(3)],
        "cards": [{"id": c, "use": pct(v, len(rs))} for c, v in cards.most_common(10)],
        "stats": {k: round(sum(r[k] for r in rs) / len(rs)) for k in ["spd", "sta", "pow", "gut", "wiz"]},
    }

def sname(i):
    s = skills.get(str(i))
    if s:
        return s[0]
    if 900000 <= i < 1000000:
        b = skills.get(str(i - 800000))
        if b:
            return b[0] + " (inherited)"
    return None

skl = []
for i, v in C.Counter(i for r in R for i in set(r["sk"])).most_common(40):
    n = sname(i)
    if n:
        skl.append({"n": n, "use": pct(v, N)})
    if len(skl) == 12:
        break

print(json.dumps({pvp: {"src": "BWIKI", "date": date, "teams": len(teams), "styles": styles,
                        "combos": combos, "umas": umas, "decks": decks, "skills": skl}},
                 ensure_ascii=False, separators=(",", ":")))
