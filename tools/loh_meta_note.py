"""
Resumo "JP meta" dos LoHs que o BWIKI não tem (LOH9, LOH12), a partir das notas de
集計 do top 300 publicadas no note.com por shiny_broom942.

Entrada: parsed.json (texto das notas já separado em estilos, comps, Umas e, para as
Umas mais usadas, cartas e skills), cardmap.json ("título|personagem" → id da carta),
skj.json (nome da skill no JP → nome em inglês). Saída: JSON com as entradas de meta.js
(o tools/loh_meta.py junta com as do BWIKI).

Uso: python3 tools/loh_meta_note.py parsed.json cardmap.json skj.json > note_meta.json
"""
import collections as C
import json
import sys

parsed, cardmap, skj = (json.load(open(f)) for f in sys.argv[1:4])

# Apelidos usados nas notas → nome no site
NICK = {
    "白キタ": "Kitasan Black (New Year)", "赤キタ": "Kitasan Black (Anime Collab)",
    "ハロマヤ": "Mayano Top Gun (Halloween)", "チョコネス": "Ines Fujin (Valentine)",
    "クリオグリ": "Oguri Cap (Christmas)", "ジェンティル": "Gentildonna",
    "エアメサイア": "Air Messiah", "嫁スイーピー": "Sweep Tosho (Wedding)",
    "チョコボン": "Mihono Bourbon (Valentine)", "水タキオン": "Agnes Tachyon (Summer)",
    "水シュヴァち": "Cheval Grand (Summer)", "オルフェ": "Orfevre",
    "メカハヤヒデ": "Biwa Hayahide (Mecha)",
}
INFO = {
    "LOH9": {"date": "2024-11-30", "url": "https://note.com/shiny_broom942/n/n7670f6738cf6"},
    "LOH12": {"date": "2025-08-24", "url": "https://note.com/shiny_broom942/n/n42bbe1b92aa0"},
}
ORDER = ["Front Runner", "Pace Chaser", "Late Surger", "End Closer", "Runaway"]
r1 = lambda x: round(x, 1)


def skill_en(jp):
    inh = jp.endswith("(継承)")
    base = jp.replace("(継承)", "")
    en = skj.get(base)
    return en and (en + (" (inherited)" if inh else ""))


def build(pvp, d):
    N = sum(d["styles"].values())  # 900 Umas
    rows = d["umas"]
    styles = []
    for st in ORDER:
        n = d["styles"].get(st)
        if not n:
            continue
        rs = [u for u in rows if u["st"] == st]
        w = sum(u["n"] for u in rs)
        styles.append({"st": st, "use": r1(100 * n / N),
                       "win": r1(sum(u["n"] * u["win"] for u in rs) / w) if w else 0})
    combos = [{"st": sorted(c["st"], key=ORDER.index), "use": c["use"]} for c in d["combos"][:5]]

    agg = C.defaultdict(lambda: {"n": 0, "w": 0.0, "st": C.Counter()})
    for u in rows:
        name = NICK.get(u["nick"])
        if not name:
            continue
        a = agg[name]
        a["n"] += u["n"]
        a["w"] += u["n"] * u["win"]
        a["st"][u["st"]] += u["n"]
    umas = [{"n": k, "site": True, "st": a["st"].most_common(1)[0][0], "use": r1(100 * a["n"] / N),
             "win": r1(a["w"] / a["n"])}
            for k, a in sorted(agg.items(), key=lambda x: -x[1]["n"]) if 100 * a["n"] / N >= 1][:10]

    decks = {}
    for st in ORDER:
        secs = [p for p in d["per"] if p["st"] == st]
        if not secs:
            continue
        W = sum(p["n"] for p in secs)
        cards = C.Counter()
        for p in secs:
            for typ, rar, title, char, pct in p["cards"]:
                cid = cardmap.get(f"{title}|{char}")
                if cid:
                    cards[str(cid)] += p["n"] * pct / W
        stats = None
        if all(p["stats"] for p in secs):
            stats = {k: round(sum(p["n"] * p["stats"][k] for p in secs) / W) for k in ["spd", "sta", "pow", "gut", "wiz"]}
        decks[st] = {"n": d["styles"][st], "structs": [],
                     "cards": [{"id": c, "use": r1(v)} for c, v in cards.most_common(10)],
                     "stats": stats}

    W = sum(p["n"] for p in d["per"])
    sk = C.Counter()
    for p in d["per"]:
        for name, pct in p["skills"]:
            sk[name] += p["n"] * pct / W
    skills = []
    for name, v in sk.most_common():
        en = skill_en(name)
        if en:
            skills.append({"n": en, "use": r1(v)})
        if len(skills) == 12:
            break

    return {"src": "note", "url": INFO[pvp]["url"], "date": INFO[pvp]["date"], "teams": N // 3,
            "styles": styles, "combos": combos, "umas": umas, "decks": decks, "skills": skills,
            "partial": True}


print(json.dumps({k: build(k, v) for k, v in parsed.items()}, ensure_ascii=False))
