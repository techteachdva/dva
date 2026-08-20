#!/usr/bin/env py
"""Simulate calibrated scoring against submission snapshot."""
import json
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "_submissions_snapshot.json"

STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "is", "was", "it", "i", "we", "they", "he", "she", "my", "our", "that",
    "this", "with", "as", "be", "had", "have", "has", "were", "are", "am",
    "so", "if", "not", "by", "from", "up", "out", "just", "like", "very",
}
COMMON_MISSPELLINGS = {
    "teh": "the", "recieve": "receive", "becuase": "because", "wierd": "weird",
    "freind": "friend", "definately": "definitely", "alot": "a lot", "seperate": "separate",
    "occured": "occurred", "thier": "their", "untill": "until", "realy": "really",
    "gonne": "gonna", "somthing": "something", "diffrent": "different", "beautifull": "beautiful",
    "happend": "happened", "finaly": "finally", "basicly": "basically", "writting": "writing",
    "swiming": "swimming", "runing": "running", "dont": "don't", "wont": "won't", "cant": "can't",
    "didnt": "didn't", "wasnt": "wasn't", "couldnt": "couldn't", "wouldnt": "wouldn't",
    "im": "I'm", "ive": "I've", "youre": "you're", "theyre": "they're", "weve": "we've",
}
SENSORY = re.compile(r"\b(saw|see|seen|heard|hear|felt|feel|smelled|smell|tasted|taste|touched|touch|bright|dark|loud|quiet|soft|rough|smooth|sweet|sour|cold|warm|hot|scary|exciting|beautiful|amazing|funny|nervous|happy|sad|angry|surprised|giggled|laughed|cried|shivered|gasped)\b", re.I)
SUBORD = re.compile(r"\b(because|although|though|while|when|if|since|unless|until|before|after|where|whereas|even though|so that|in order to|as soon as|whenever|wherever|as|but|and|or)\b", re.I)
TRANS = re.compile(r"\b(then|next|finally|suddenly|meanwhile|later|afterward|eventually|one day|that day|first|second|lastly|soon|before long|at first|in the end)\b", re.I)
CONCRETE = re.compile(r"\b(house|beach|pool|park|school|friend|mom|dad|brother|sister|dog|cat|bike|car|boat|lake|river|tree|food|pizza|ice cream|summer|morning|night)\b", re.I)
VOICE = re.compile(r"\b(i|me|my|mine|we|us|our|myself)\b", re.I)

VOLUME_BP = [[0,0],[20,15],[40,32],[55,45],[70,55],[85,64],[100,72],[115,78],[130,83],[150,88],[175,92],[200,95],[250,98],[320,100]]
WPM_BP = [[0,0],[6,25],[10,40],[14,52],[17,58],[20,65],[24,72],[28,79],[32,85],[38,91],[45,96],[55,100]]
VOICE_BP = [[0,35],[2,50],[5,65],[8,78],[12,88],[16,94],[20,100]]
DETAIL_BP = [[0,35],[1,50],[2,62],[3,72],[4,82],[6,90],[8,95],[11,100]]
STRUCT_BP = [[0,35],[1,55],[2,68],[3,78],[4,86],[5,92],[6,96],[8,100]]
LEX_BP = [[0,30],[0.25,45],[0.35,58],[0.45,70],[0.55,80],[0.65,88],[0.72,94],[0.78,100]]
SPEC_BP = [[0,30],[1,48],[3,62],[5,74],[8,84],[12,92],[16,100]]


def clamp(n, lo, hi):
    return max(lo, min(hi, n))


def score_from_range(value, bps):
    for i in range(len(bps) - 1):
        v0, s0 = bps[i]
        v1, s1 = bps[i + 1]
        if value <= v1:
            t = (value - v0) / (v1 - v0 or 1)
            return round(s0 + t * (s1 - s0))
    return bps[-1][1]


def analyze(text, duration=300):
    words = text.strip().split() if text.strip() else []
    wc = len(words)
    wpm = wc / (duration / 60) if duration else 0
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    sc = len(sentences) or 1

    miss = sum(1 for w in words if w.lower().replace("'", "") in COMMON_MISSPELLINGS or w.lower() in COMMON_MISSPELLINGS)
    miss += len(re.findall(r"\b(\w{3,})\1{2,}\b", text, re.I))
    i_err = len(re.findall(r"\bi\b", text))
    spell = clamp(round(100 - (miss / max(wc, 1)) * 220 - i_err * 1.5), 0, 100)

    err = sum(1 for s in sentences if s and s[0].islower())
    if text.strip() and not re.search(r"[.!?][\"']?\s*$", text.strip()):
        err += 1
    err += len(re.findall(r"  +", text))
    gram = clamp(round(100 - (err / max(sc, 1)) * 18), 0, 100)

    lens = [len(s.split()) for s in sentences if s]
    avg = sum(lens) / max(len(lens), 1)
    var = (sum((l - avg) ** 2 for l in lens) / max(len(lens), 1)) ** 0.5
    cm = len(SUBORD.findall(text)) + text.count(";") + len(re.findall(r"—|–", text))
    frag = sum(1 for l in lens if 0 < l < 4)
    run = sum(1 for l in lens if l > 35)
    syn = clamp(round(
        score_from_range(var, [[0,25],[2,45],[5,68],[8,82],[12,94]]) * 0.2 +
        score_from_range(avg, [[0,25],[6,48],[10,68],[14,82],[20,94]]) * 0.2 +
        score_from_range(cm, [[0,35],[2,55],[5,72],[8,86],[12,96],[16,100]]) * 0.6 -
        frag * 2 - run * 4
    ), 0, 100)

    lower = [re.sub(r"[^\w']", "", w.lower()) for w in words]
    content = [w for w in lower if len(w) > 1 and w not in STOP_WORDS]
    uniq = len(set(content))
    lex = uniq / len(content) if content else 0
    spec = len(CONCRETE.findall(text)) + len(re.findall(r"\b[A-Z][a-z]+", text)) + len(re.findall(r"\b\d+\b", text))
    freq = {}
    for w in content:
        freq[w] = freq.get(w, 0) + 1
    rep = max(freq.values(), default=0) / max(wc, 1)
    sem = clamp(round(
        score_from_range(lex, LEX_BP) * 0.5 +
        score_from_range(spec, SPEC_BP) * 0.35 -
        rep * 35
    ), 0, 100)

    sensory = len(SENSORY.findall(text))
    trans = len(TRANS.findall(text))
    voice = len(VOICE.findall(text))
    conflict = len(re.findall(r"\b(but|however|problem|stuck|lost|scared|worried|until|finally)\b", text, re.I))
    dialogue = round(len(re.findall(r'["\']', text)) / 2)

    vol = score_from_range(wc, VOLUME_BP)
    wpm_s = score_from_range(wpm, WPM_BP)
    typing = clamp(round(wpm_s * 0.55 + vol * 0.45), 0, 100)
    detail_base = score_from_range(sensory + dialogue * 1.5, DETAIL_BP)
    detail_bonus = score_from_range(wc, [[0,0],[60,4],[90,10],[130,16],[180,22],[250,28]])
    subs = {
        "voice": score_from_range(voice, VOICE_BP),
        "detail": clamp(detail_base + detail_bonus, 0, 100),
        "structure": score_from_range(trans + conflict, STRUCT_BP),
        "wordChoice": sem,
    }
    story = clamp(round(subs["voice"]*0.2 + subs["detail"]*0.25 + subs["structure"]*0.25 + subs["wordChoice"]*0.3), 0, 100)
    floors = [
        (45,1,2,None,45),(70,3,None,None,55),(100,5,None,1,65),(180,10,None,2,88),(280,16,None,3,100)
    ]
    for mw,mv,ms,msen,fl in floors:
        if wc>=mw and voice>=mv and sc>=(ms or 0) and (msen is None or sensory>=msen):
            story=max(story,fl)
    mech = clamp(round(spell * 0.45 + gram * 0.35 + syn * 0.2), 0, 100)
    if wc>=240 and spell>=98 and gram>=94: mech=max(mech,99)
    overall = round((typing + mech + story) / 3)
    return {"typing": typing, "mechanics": mech, "story": story, "overall": overall, "wc": wc, "wpm": round(wpm,1)}


def main():
    subs = json.loads(DATA.read_text(encoding="utf-8"))["submissions"]
    cec = next(s for s in subs if "cecel" in (s.get("name") or "").lower())
    print("Cecelia recalc:", analyze(cec["text"]), "name", cec["name"])

    grades = {6: [], 7: [], 8: []}
    for s in subs:
        c = s.get("classroom") or ""
        if "lounge" in c.lower() or c in {"Tech: Media Arts", "Tech: Game Design", "Tech: Video Production"}:
            continue
        g = 6 if re.search(r"6", c) else 7 if re.search(r"7", c) else 8 if re.search(r"8", c) else None
        if not g:
            continue
        r = analyze(s.get("text") or "")
        grades[g].append(r)

    for g, rows in grades.items():
        ov = [r["overall"] for r in rows]
        print(f"G{g} n={len(rows)} overall mean={statistics.mean(ov):.1f} med={statistics.median(ov):.1f} p90={sorted(ov)[int(len(ov)*0.9)-1]}")

if __name__ == "__main__":
    main()
