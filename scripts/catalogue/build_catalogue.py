#!/usr/bin/env python3
"""
Build the master product catalogue for the WooCommerce import.

Inputs
  - Xero items export (CSV)            source of truth for SKU, price, stock, status
  - Zen Cart MySQL dump (SQL)          source of names, descriptions, images, old categories
  - Zen -> Woo category map (CSV)      the hand-reviewed Google Sheet export
  - Woo category tree (JSON)           `wp term list product_cat --format=json`
  - Xero prefix -> Woo category (CSV)  generated on first run, editable, used for items with no Zen match
  - overrides (CSV)                    manual decisions that survive reruns

Outputs (in --out)
  - products.csv        one row per Woo product / variation, ready for `wp rural import`
  - review.csv          rows carrying a flag that deserves a human look
  - unmatched_zen.csv   enabled Zen products that no active Xero item points at
  - summary.txt         counts

Everything is deterministic and rerunnable. Edit the prefix map or the overrides file and run again.
"""

from __future__ import annotations

import argparse
import collections
import csv
import html
import json
import os
import re
import sys

csv.field_size_limit(1 << 30)

SKU_IN_NAME = re.compile(r"\(([^()]*)\)\s*$")
UNCATEGORIZED_NAME = "Uncategorized"


# --------------------------------------------------------------------------- helpers

def norm(s: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def num(s) -> float:
    try:
        return float(str(s or "").replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


_HIGH_RUN = re.compile(r"[\x80-\xff]+")


def fix_mojibake(s: str | None) -> str:
    """The dump is latin1 but mostly holds UTF-8 bytes. Repair each high-byte run independently
    so a string mixing real latin1 and UTF-8 sequences still comes out right."""
    if not s:
        return ""

    def repair(m: re.Match) -> str:
        run = m.group(0)
        try:
            return run.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return run

    for _ in range(3):
        fixed = _HIGH_RUN.sub(repair, s)
        if fixed == s:
            break
        s = fixed
    return s


def clean_text(s: str) -> str:
    s = html.unescape(fix_mojibake(s))
    s = s.replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def smart_title(s: str) -> str:
    """Title-case shouty warehouse text but leave codes, sizes and units alone."""
    letters = [c for c in s if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) / len(letters) < 0.8:
        return s
    out = []
    for word in s.split(" "):
        if not word:
            continue
        if any(ch.isdigit() for ch in word) or "/" in word:
            out.append(word)
        elif len(word) <= 2 and word.isalpha():
            out.append(word.lower() if out else word.capitalize())
        else:
            out.append(word[0].upper() + word[1:].lower())
    return " ".join(out)


def strip_sku_suffix(name: str) -> str:
    return SKU_IN_NAME.sub("", name).strip()


# --------------------------------------------------------------------------- SQL dump parsing

_ESC = {"n": "\n", "r": "\r", "t": "\t", "0": "\0", "Z": "\x1a", "\\": "\\", "'": "'", '"': '"'}


def parse_dump(path: str, wanted: set[str]) -> dict[str, list[dict]]:
    text = open(path, "rb").read().decode("latin-1")
    rows: dict[str, list[dict]] = {t: [] for t in wanted}
    head = re.compile(r"INSERT INTO `(\w+)` \(([^)]*)\) VALUES\s*")
    ws = " \n\r\t"
    for m in head.finditer(text):
        table = m.group(1)
        if table not in wanted:
            continue
        cols = [c.strip("` ") for c in m.group(2).split(",")]
        i = m.end()
        n = len(text)
        while i < n:
            while text[i] in ws:
                i += 1
            if text[i] == ";":
                break
            if text[i] == ",":
                i += 1
                continue
            if text[i] != "(":
                raise ValueError(f"unexpected {text[i]!r} in {table} at {i}")
            i += 1
            vals: list = []
            while True:
                while text[i] in ws:
                    i += 1
                c = text[i]
                if c == "'":
                    i += 1
                    buf = []
                    while True:
                        c = text[i]
                        if c == "\\":
                            buf.append(_ESC.get(text[i + 1], text[i + 1]))
                            i += 2
                            continue
                        if c == "'":
                            if text[i + 1] == "'":
                                buf.append("'")
                                i += 2
                                continue
                            i += 1
                            break
                        buf.append(c)
                        i += 1
                    vals.append("".join(buf))
                elif text.startswith("NULL", i):
                    vals.append(None)
                    i += 4
                else:
                    j = i
                    while text[j] not in ",)":
                        j += 1
                    vals.append(text[i:j].strip())
                    i = j
                while text[i] in ws:
                    i += 1
                if text[i] == ",":
                    i += 1
                    continue
                if text[i] == ")":
                    i += 1
                    break
            rows[table].append(dict(zip(cols, vals)))
    return rows


# --------------------------------------------------------------------------- category guessing

# whole-name match only: an item *is* a fee or service, not a product that merely mentions one
SERVICE_RULES = re.compile(r"^\s*(?:[A-Z ]*\bFEES?\b[A-Z ]*|LABOUR|DELIVERY|PACKAGING\.?|POWDER COATING|CUSTOM BUILT?|TEST|MISC|MISCELLANEOUS|INTEREST CHARGES|PALLET SUPPLY|ENTER ITEM TO BE PRE-PAID|PREORDER|FREIGHT|SURCHARGE)\s*$")

KEYWORD_RULES = [
    # (regex on the prefix / item text, woo category name)
    (r"STRUT|STRAINER|S/A |GALMAX|FIELD FENCE|HORSE FENCE|LIVESTOCK|F/FENCE|BARB", "Fencing – Rural"),
    (r"CHOWCAM|CAMERA", "Automatic Gates"),
    (r"PVC FENCING|POST & RAIL|POST AND RAIL", "Fencing – Panels & Gates"),
    (r"NOTCHKA|PADBOLT|PAD BOLT|BOLTS NUTS|SCREW|DRILL|CHEMSET|RAT TRAP|KEY TAG|NUT INSERT|ROD ", "Hardware & Garden"),
    (r"AUTO GATE|AUTO COMP|AUTOKIT|GATEMASTER|INTERCOM|SOLAR|SLR PAN|BATTERY BOX|PHOTO CELL|KEY ?PAD|RECEIVER|REMOTE", "Automatic Gates"),
    (r"CATTLE RAIL", "Cattle Rail"),
    (r"ELECT|GALLAGHER|THUNDERBIRD|ENERGISER|ENERGIZER", "Electric Fencing"),
    (r"ALU POOL|POOL", "Aluminium Pool Fencing"),
    (r"PICKET", "Aluminium Picket Fencing"),
    (r"GARRISON", "Garrison Fencing"),
    (r"ALU .*GATE|ALU GATE|SWG GATE|SLD GATE", "Boundary Gates"),
    (r"ALU GATE POSTS|ALU .*POST", "Boundary Posts"),
    (r"ALU PAN|ALU PANEL|PANEL COMP", "Boundary Accessories"),
    (r"^ALU", "Aluminium Boundary Fencing"),
    (r"GABION", "Gabion Cages"),
    (r"PINE POLE|PINE|BOLLARD", "Treated Pine Poles"),
    (r"WATER TANK|TANK", "Water Tanks"),
    (r"PUMP", "Pumps"),
    (r"IRRIG|HOSE|SPRINKLER|POLY|VALVE", "Irrigation"),
    (r"WELDED MESH|MESH|HANDY PANEL", "Welded Mesh"),
    (r"NETTING|WIRE NET|AVIARY|BIRD", "Wire Netting"),
    (r"SHADE|CROP NET|FRUIT|TARP", "Shade Cloth & Fruit Tree Netting"),
    (r"Y POST|STAR POST|PICKET/POST|STEEL POST", "Steel ‘Y’ Posts"),
    (r"PET|DOG|KENNEL|CHOOK", "Pet Enclosures"),
    (r"GATE ACC|LATCH|HINGE", "Safety Gate Latches & Hinges"),
    (r"GATE", "Gates"),
    (r"SEC FENCE|CHAINWIRE|C/WIRE|STEEL|TUBE|PIPE|POST|ANGLE|STARALUM|FLAT BAR|FLAT STRIP|BRACKET|BASE PLATE|CLAMP|CAP ", "Fencing – Security"),
    (r"WIRE|FENCE ACC|STAPLE|STRAINER|WARATAH|FENCE IMPORT|RING FAST", "Fencing – Rural"),
    (r"CHEMICAL|SPRAY PAINT|CEMENT|CHAIN|TOOL|HARDWARE|GARDEN|KNIFE|RATCHET|CASTOR|FLYWIRE", "Hardware & Garden"),
]


def guess_category(text: str, name_to_id: dict[str, int]) -> int | None:
    up = text.upper()
    for pattern, cat_name in KEYWORD_RULES:
        if re.search(pattern, up):
            cid = name_to_id.get(cat_name)
            if cid:
                return cid
    return None


# --------------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    ign = os.path.join(root, "ignore")
    ap.add_argument("--xero", default=os.path.join(ign, "xero_export_products.csv"))
    ap.add_argument("--zen-sql", default=os.path.join(ign, "ruralfen_14RTS.sql"))
    ap.add_argument("--images", default=os.path.join(ign, "images"))
    ap.add_argument("--category-map", default=os.path.join(ign, "Rural Data Migration - Zen to Woo Categories MAP.csv"))
    ap.add_argument("--woo-categories", default=os.path.join(ign, "catalogue", "woo_categories.json"))
    ap.add_argument("--prefix-map", default=os.path.join(ign, "catalogue", "xero_prefix_category_map.csv"))
    ap.add_argument("--overrides", default=os.path.join(ign, "catalogue", "overrides.csv"))
    ap.add_argument("--out", default=os.path.join(ign, "catalogue"))
    ap.add_argument("--regen-prefix-map", action="store_true", help="rebuild the prefix map even if it exists (rows whose source column says manual keep their woo_id)")
    ap.add_argument("--min-prefix-len", type=int, default=4)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    # ---------------- Woo categories
    woo = {int(t["term_id"]): t for t in json.load(open(args.woo_categories))}
    for t in woo.values():
        t["name"] = html.unescape(t["name"])
    woo_name_to_id = {t["name"]: tid for tid, t in woo.items()}
    uncategorized_id = woo_name_to_id.get(UNCATEGORIZED_NAME)

    def ancestors(tid: int) -> list[int]:
        out = []
        cur = woo.get(tid)
        while cur and int(cur["parent"]):
            out.append(int(cur["parent"]))
            cur = woo.get(int(cur["parent"]))
        return out

    def expand(ids) -> list[int]:
        full: set[int] = set()
        for i in ids:
            if i in woo:
                full.add(i)
                full.update(ancestors(i))
        if len(full) > 1 and uncategorized_id in full:
            full.discard(uncategorized_id)
        return sorted(full)

    def woo_path(tid: int) -> str:
        chain = [tid] + ancestors(tid)
        return " > ".join(woo[i]["name"] for i in reversed(chain) if i in woo)

    # ---------------- Zen Cart
    dump = parse_dump(args.zen_sql, {"products", "products_description", "products_to_categories", "categories", "categories_description"})
    zen_products: dict[int, dict] = {}
    for r in dump["products"]:
        pid = int(r["products_id"])
        zen_products[pid] = {
            "id": pid,
            "status": int(r["products_status"] or 0),
            "image": (r["products_image"] or "").strip(),
            "price": num(r["products_price"]),
            "master_cat": int(r["master_categories_id"] or 0),
            "name": "",
            "description": "",
            "cats": set(),
        }
    for r in dump["products_description"]:
        pid = int(r["products_id"])
        if pid in zen_products and int(r["language_id"] or 1) == 1:
            zen_products[pid]["name"] = clean_text(r["products_name"] or "")
            zen_products[pid]["description"] = fix_mojibake(r["products_description"] or "").strip()
    for r in dump["products_to_categories"]:
        pid = int(r["products_id"])
        if pid in zen_products:
            zen_products[pid]["cats"].add(int(r["categories_id"]))
    for p in zen_products.values():
        if p["master_cat"]:
            p["cats"].add(p["master_cat"])
        p["sku"] = ""
        m = SKU_IN_NAME.search(p["name"])
        if m:
            p["sku"] = m.group(1).strip().upper()
        p["display_name"] = strip_sku_suffix(p["name"])
    zen_cat_parent: dict[int, int] = {}
    zen_cat_name: dict[int, str] = {}
    for r in dump["categories"]:
        zen_cat_parent[int(r["categories_id"])] = int(r["parent_id"] or 0)
    for r in dump["categories_description"]:
        zen_cat_name[int(r["categories_id"])] = clean_text(r["categories_name"] or "")

    # image lookup, case-insensitive, also allowing subfolder references like products/x.jpg
    image_files: dict[str, str] = {}
    for dirpath, _, files in os.walk(args.images):
        rel_dir = os.path.relpath(dirpath, args.images)
        for f in files:
            if f.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                rel = f if rel_dir == "." else os.path.join(rel_dir, f)
                image_files.setdefault(rel.lower(), rel)
                image_files.setdefault(f.lower(), rel)

    def find_image(ref: str) -> str:
        ref = (ref or "").strip()
        if not ref:
            return ""
        return image_files.get(ref.lower()) or image_files.get(os.path.basename(ref).lower()) or ""

    # Zen SKU indexes. Prefer enabled products when a SKU is shared.
    by_sku: dict[str, list[int]] = collections.defaultdict(list)
    by_norm: dict[str, list[int]] = collections.defaultdict(list)
    for p in sorted(zen_products.values(), key=lambda x: (-x["status"], x["id"])):
        if p["sku"]:
            by_sku[p["sku"]].append(p["id"])
            by_norm[norm(p["sku"])].append(p["id"])
    prefix_skus = sorted((s for s in by_sku if len(s) >= args.min_prefix_len), key=len, reverse=True)

    # ---------------- Zen -> Woo category sheet
    zen_cat_to_woo: dict[int, int] = {}
    with open(args.category_map, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            try:
                zc, wid = int(r["categories_id"]), int(r["woo_id"])
            except (TypeError, ValueError):
                continue
            zen_cat_to_woo.setdefault(zc, wid)

    def zen_cat_woo(zc: int) -> int | None:
        seen = set()
        while zc and zc not in seen:
            seen.add(zc)
            if zc in zen_cat_to_woo:
                return zen_cat_to_woo[zc]
            zc = zen_cat_parent.get(zc, 0)
        return None

    def zen_product_woo_cats(p: dict) -> list[int]:
        ids = set()
        for zc in p["cats"]:
            w = zen_cat_woo(zc)
            if w:
                ids.add(w)
        return sorted(ids)

    # ---------------- overrides
    override_cols = ["xero_sku", "zen_product_id", "woo_category_ids", "parent_sku", "name", "skip", "note"]
    overrides: dict[str, dict] = {}
    if os.path.exists(args.overrides):
        with open(args.overrides, encoding="utf-8-sig") as fh:
            for r in csv.DictReader(fh):
                if (r.get("xero_sku") or "").strip():
                    overrides[r["xero_sku"].strip().upper()] = r
    else:
        with open(args.overrides, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(override_cols)
            w.writerow(["EXAMPLE-SKU", "1234", "24|37", "", "Nicer product name", "", "zen_product_id 'none' forces no Zen match; skip=1 drops the item; category ids are | separated"])

    # ---------------- Xero
    with open(args.xero, encoding="utf-8-sig") as fh:
        xero_all = list(csv.DictReader(fh))
    code_col = next(c for c in xero_all[0] if c.endswith("ItemCode"))
    xero = [r for r in xero_all if (r.get("Status") or "").strip() == "Active"]
    archived_codes = {norm(r[code_col]) for r in xero_all if (r.get("Status") or "").strip() != "Active"}

    def segments(r) -> list[str]:
        return [s.strip() for s in (r.get("ItemName") or "").split(":") if s.strip()]

    STOP = {"THE", "AND", "FOR", "WITH", "PER", "EACH", "PACK", "ROLL", "MTR", "MM", "GALV", "BLACK", "WHITE"}

    def tokens(s: str) -> set[str]:
        return {t for t in re.split(r"[^A-Z0-9]+", (s or "").upper()) if len(t) >= 3 and t not in STOP and not t.isdigit()}

    def match_zen(r) -> tuple[int | None, str, str]:
        """Return (zen_product_id, tier, remainder_hint)."""
        code = r[code_col].strip().upper()
        ov = overrides.get(code)
        if ov and (ov.get("zen_product_id") or "").strip():
            v = ov["zen_product_id"].strip().lower()
            if v == "none":
                return None, "override_none", ""
            return int(v), "override", ""
        segs = [s.upper() for s in segments(r)]
        last = segs[-1] if segs else ""
        for cand, label in ((code, "code"), (last, "name_last")):
            if cand and cand in by_sku:
                return by_sku[cand][0], label + "_exact", ""
            if cand and norm(cand) in by_norm:
                return by_norm[norm(cand)][0], label + "_norm", ""
        for s in segs[1:-1]:
            if s in by_sku:
                return by_sku[s][0], "name_segment", ""
        for s in prefix_skus:
            if re.match(re.escape(s) + r"[ .\-/_]", code):
                return by_sku[s][0], "code_prefix", code[len(s):]
        for s in prefix_skus:
            if last.startswith(s + " "):
                return by_sku[s][0], "name_last_prefix", last[len(s):]
        return None, "", ""

    # first pass: match everything
    items = []
    for r in xero:
        code = r[code_col].strip()
        ov = overrides.get(code.upper(), {})
        if (ov.get("skip") or "").strip() in ("1", "yes", "true"):
            continue
        zid, tier, remainder = match_zen(r)
        items.append({"xero": r, "code": code, "zen_id": zid, "tier": tier, "remainder": remainder, "override": ov, "image_source": ""})

    # conservative fuzzy tier: only unmatched Xero items against enabled Zen products nobody else claimed.
    # Requires every number in the Zen SKU to appear in the Xero code/name and at least two shared words.
    claimed = {it["zen_id"] for it in items if it["zen_id"]}
    free_zen = [p for p in zen_products.values() if p["status"] == 1 and p["id"] not in claimed and p["sku"]]

    def numbers(s: str) -> set[str]:
        return {n.lstrip("0") or "0" for n in re.findall(r"\d+(?:\.\d+)?", (s or "").upper())}

    COLOURS = {"BLACK", "GREEN", "WHITE", "CREAM", "BLUE", "RED", "YELLOW", "GREY", "GRAY", "BROWN"}

    def word_tokens(s: str) -> set[str]:
        return {t for t in tokens(s) if t.isalpha()}

    def alpha_overlap(zen_words: set[str], xero_words: set[str]) -> int:
        n = 0
        for z in zen_words:
            if any(z == x or (len(z) >= 4 and len(x) >= 4 and (z.startswith(x) or x.startswith(z))) for x in xero_words):
                n += 1
        return n

    fuzzy_suggestions = []
    for it in items:
        if it["zen_id"] or it["tier"] == "override_none":
            continue
        r = it["xero"]
        xtext = " ".join([it["code"], r.get("ItemName") or "", r.get("SalesDescription") or ""])
        xnums = numbers(xtext)
        code_nums = numbers(it["code"])
        xwords = word_tokens(xtext)
        xcol = {w for w in re.split(r"[^A-Z]+", xtext.upper()) if w in COLOURS}
        best = None
        for p in free_zen:
            znums = numbers(p["sku"])
            if not znums or not znums <= xnums:
                continue
            # every number in the Xero code must exist somewhere on the Zen side too
            if not code_nums <= (znums | numbers(p["display_name"])):
                continue
            zwords = word_tokens(p["display_name"] + " " + p["sku"])
            zcol = {w for w in re.split(r"[^A-Z]+", (p["display_name"] + " " + p["sku"]).upper()) if w in COLOURS}
            if zcol and xcol and not (zcol & xcol):
                continue
            shared = alpha_overlap(zwords, xwords)
            if shared < 2 or shared < 0.6 * len(zwords):
                continue
            score = shared + len(znums)
            if best is None or score > best[0]:
                best = (score, p, 1)
            elif score == best[0]:
                best = (best[0], best[1], best[2] + 1)
        if best and best[2] == 1:
            it["zen_id"], it["tier"] = best[1]["id"], "fuzzy"
            claimed.add(best[1]["id"])
            free_zen = [p for p in free_zen if p["id"] != best[1]["id"]]

    # ---------------- prefix map (for items without a Zen category)
    evidence_top: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    evidence_second: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    count_top: collections.Counter = collections.Counter()
    count_second: collections.Counter = collections.Counter()
    unmatched_top: collections.Counter = collections.Counter()
    unmatched_second: collections.Counter = collections.Counter()
    for it in items:
        segs = segments(it["xero"])
        if not segs:
            continue
        top = segs[0].upper()
        second = ":".join(s.upper() for s in segs[:2]) if len(segs) > 1 else None
        count_top[top] += 1
        if second:
            count_second[second] += 1
        cats = zen_product_woo_cats(zen_products[it["zen_id"]]) if it["zen_id"] else []
        if cats:
            for c in cats:
                evidence_top[top][c] += 1
                if second:
                    evidence_second[second][c] += 1
        else:
            unmatched_top[top] += 1
            if second:
                unmatched_second[second] += 1

    existing_prefix: dict[str, dict] = {}
    if os.path.exists(args.prefix_map):
        with open(args.prefix_map, encoding="utf-8-sig") as fh:
            for r in csv.DictReader(fh):
                existing_prefix[r["key"]] = r

    NOT_FOR_NEW_ITEMS = {woo_name_to_id.get(n) for n in ("Clearance", "Specials", "New Products", "Featured", UNCATEGORIZED_NAME)}

    def suggest(key: str, ev: collections.Counter, total: int, fallback_text: str, allow_guess: bool = True) -> tuple[int | None, str]:
        usable = collections.Counter({c: n for c, n in ev.items() if c not in NOT_FOR_NEW_ITEMS})
        if usable:
            best, n = usable.most_common(1)[0]
            if n >= 3 and n >= 0.1 * total:
                return best, "evidence"
        if allow_guess:
            g = guess_category(fallback_text, woo_name_to_id)
            return (g, "guess") if g else (None, "none")
        return None, "inherit"

    if args.regen_prefix_map or not existing_prefix:
        rows = []
        for top, total in count_top.most_common():
            if unmatched_top[top] == 0:
                continue
            sid, src = suggest(top, evidence_top[top], total, top)
            prev = existing_prefix.get(top)
            if prev and prev.get("source") == "manual":
                sid, src = (int(prev["woo_id"]) if str(prev.get("woo_id") or "").isdigit() else None), "manual"
            rows.append({"key": top, "level": 1, "item_count": total, "unmatched_count": unmatched_top[top],
                         "evidence": "; ".join(f"{woo[c]['name']}={n}" for c, n in evidence_top[top].most_common(3) if c in woo),
                         "woo_id": sid or "", "woo_name": woo_path(sid) if sid else "", "source": src})
            top_sid = sid
            for second, stotal in count_second.most_common():
                if not second.startswith(top + ":") or unmatched_second[second] == 0 or stotal < 2:
                    continue
                ssid, ssrc = suggest(second, evidence_second[second], stotal, second, allow_guess=False)
                prev = existing_prefix.get(second)
                if prev and prev.get("source") == "manual":
                    ssid, ssrc = (int(prev["woo_id"]) if str(prev.get("woo_id") or "").isdigit() else None), "manual"
                elif ssid == top_sid:
                    ssid, ssrc = None, "inherit"  # blank means: use the level-1 row
                rows.append({"key": second, "level": 2, "item_count": stotal, "unmatched_count": unmatched_second[second],
                             "evidence": "; ".join(f"{woo[c]['name']}={n}" for c, n in evidence_second[second].most_common(3) if c in woo),
                             "woo_id": ssid or "", "woo_name": woo_path(ssid) if ssid else "", "source": ssrc})
        with open(args.prefix_map, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=["key", "level", "item_count", "unmatched_count", "evidence", "woo_id", "woo_name", "source"])
            w.writeheader()
            w.writerows(rows)
        existing_prefix = {r["key"]: r for r in rows}
    prefix_map = {k: int(r["woo_id"]) for k, r in existing_prefix.items() if str(r.get("woo_id") or "").strip().isdigit()}
    prefix_source = {k: r.get("source", "") for k, r in existing_prefix.items()}

    def prefix_category(r) -> tuple[list[int], str]:
        segs = [s.upper() for s in segments(r)]
        if len(segs) > 1:
            k2 = ":".join(segs[:2])
            if k2 in prefix_map:
                return [prefix_map[k2]], "xero_prefix:" + prefix_source.get(k2, "")
        if segs and segs[0] in prefix_map:
            return [prefix_map[segs[0]]], "xero_prefix:" + prefix_source.get(segs[0], "")
        g = guess_category(" ".join([r.get("ItemName") or "", r.get("SalesDescription") or ""]), woo_name_to_id)
        if g:
            return [g], "keyword_guess"
        return [], "none"

    # ---------------- sibling images for items with no Zen product
    # key = every ItemName segment except the last (the "folder" the item sits in), so a fitting
    # borrows from fittings in the same folder, never from the whole supplier bucket.
    sibling_images: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)

    def folder_key(r) -> str | None:
        segs = segments(r)
        return ":".join(s.upper() for s in segs[:-1]) if len(segs) >= 3 else None

    for it in items:
        if not it["zen_id"]:
            continue
        key = folder_key(it["xero"])
        img = find_image(zen_products[it["zen_id"]]["image"]) if key else ""
        if img:
            sibling_images[key][img] += 1
    for it in items:
        if it["zen_id"]:
            continue
        key = folder_key(it["xero"])
        cnt = sibling_images.get(key) if key else None
        if cnt:
            it["sibling_image"] = cnt.most_common(1)[0][0]
            it["image_source"] = "sibling"

    # ---------------- build product rows
    groups: dict[int, list[dict]] = collections.defaultdict(list)
    for it in items:
        if it["zen_id"]:
            groups[it["zen_id"]].append(it)

    out_cols = [
        "row_type", "sku", "parent_sku", "name", "variation_label", "description", "short_description",
        "regular_price", "tax_status", "manage_stock", "stock_qty", "stock_status", "enquire_only", "visibility",
        "image_file", "category_ids", "category_slugs", "category_path", "category_source",
        "zen_product_id", "zen_sku", "match_tier", "confidence", "flags",
        "xero_item_name", "xero_sales_description", "xero_inventory_type", "xero_quantity", "xero_sales_account", "xero_tax_rate",
    ]
    rows_out: list[dict] = []
    review: list[dict] = []
    zen_used: set[int] = set()

    def product_fields(it: dict, zp: dict | None) -> dict:
        r = it["xero"]
        ov = it["override"]
        qty = num(r.get("Quantity"))
        tracked = (r.get("InventoryType") or "").strip() == "Tracked"
        price = num(r.get("SalesUnitPrice"))
        tax = (r.get("SalesTaxRate") or "").strip().upper()
        flags = []
        if zp:
            name = zp["display_name"] or clean_text(r.get("SalesDescription") or "")
            description = zp["description"]
            short = ""
            image = find_image(zp["image"])
            if zp["image"] and not image:
                flags.append("zen_image_missing_on_disk")
            if not zp["image"]:
                flags.append("zen_product_has_no_image")
            cats = zen_product_woo_cats(zp)
            source = "zen_category_map"
            if not cats:
                cats, source = prefix_category(r)
                flags.append("zen_category_unmapped")
            if zp["status"] != 1:
                flags.append("zen_product_disabled")
        else:
            desc_src = clean_text(r.get("SalesDescription") or "")
            if desc_src.upper() in ("", ".", "NAN", "NO LONGER REQUIRED"):
                desc_src = ""
            segs = segments(r)
            name = smart_title(desc_src) if desc_src else smart_title(segs[-1] if segs else it["code"])
            name = re.sub(r"\((?:NO FURTHER DISCOUNT|IMP|LOCAL|MISC)\)|\bDNRO\b|\bNAN\b", "", name, flags=re.I)
            name = re.sub(r"\s+", " ", name).strip(" -,")
            description = ""
            short = ""
            image = it.get("sibling_image", "")
            cats, source = prefix_category(r)
            flags.append("no_zen_match")
            flags.append("name_from_xero")
        if ov.get("name"):
            name = ov["name"].strip()
        if (ov.get("woo_category_ids") or "").strip():
            cats = [int(x) for x in re.split(r"[|,; ]+", ov["woo_category_ids"].strip()) if x.strip().isdigit()]
            source = "override"
        service = not zp and (bool(SERVICE_RULES.match((r.get("ItemName") or "").upper())) or bool(SERVICE_RULES.match(it["code"].upper())))
        if service:
            flags.append("service_item")
        if not cats:
            if not service:
                flags.append("no_category")
            if uncategorized_id:
                cats = [uncategorized_id]
        elif source.startswith("xero_prefix:guess") or source == "keyword_guess":
            flags.append("category_guessed")
        if source == "xero_prefix:none":
            flags.append("category_prefix_blank")
        if not image:
            flags.append("no_image")
        if price <= 0:
            flags.append("zero_price")
        if not tracked:
            flags.append("untracked")
        if it["tier"] in ("code_prefix", "name_last_prefix"):
            flags.append("prefix_match")
        if it["tier"] == "fuzzy":
            flags.append("fuzzy_match")
        if it.get("image_source") == "sibling":
            flags.append("image_from_sibling")
        if "PRE" in it["code"].upper().split() or "PRE ORDER" in (r.get("ItemName") or "").upper():
            flags.append("pre_order")
        if norm(it["code"]) in archived_codes:
            flags.append("also_exists_archived")
        confidence = "high"
        if it["tier"] in ("code_prefix", "name_last_prefix", "fuzzy", "name_segment"):
            confidence = "medium"
        if not zp or "category_guessed" in flags or "no_category" in flags:
            confidence = "low" if not zp else confidence
        full_cats = expand(cats)
        return {
            "name": name,
            "description": description,
            "short_description": short,
            "regular_price": f"{price:.2f}" if price > 0 else "",
            "tax_status": "taxable" if tax.startswith("GST") and "FREE" not in tax else "none",
            "manage_stock": "yes" if tracked else "no",
            "stock_qty": str(int(qty)) if tracked else "",
            "stock_status": ("instock" if qty > 0 else "outofstock") if tracked else "instock",
            "enquire_only": "yes" if price <= 0 else "no",
            "visibility": "hidden" if service else "visible",
            "image_file": image,
            "category_ids": "|".join(str(c) for c in full_cats),
            "category_slugs": "|".join(woo[c]["slug"] for c in full_cats if c in woo),
            "category_path": " || ".join(woo_path(c) for c in cats if c in woo),
            "category_source": source,
            "zen_product_id": zp["id"] if zp else "",
            "zen_sku": zp["sku"] if zp else "",
            "match_tier": it["tier"],
            "confidence": confidence,
            "flags": ";".join(flags),
            "xero_item_name": r.get("ItemName") or "",
            "xero_sales_description": r.get("SalesDescription") or "",
            "xero_inventory_type": r.get("InventoryType") or "",
            "xero_quantity": r.get("Quantity") or "",
            "xero_sales_account": r.get("SalesAccount") or "",
            "xero_tax_rate": r.get("SalesTaxRate") or "",
        }

    def variation_label(it: dict, zp: dict) -> str:
        code = it["code"].upper()
        segs = [s.upper() for s in segments(it["xero"])]
        last = segs[-1] if segs else ""
        cand = it.get("remainder") or ""
        for base in (code, last):
            if cand:
                break
            if base.startswith(zp["sku"]) and len(base) > len(zp["sku"]):
                cand = base[len(zp["sku"]):]
        if not cand:
            if norm(code) == norm(zp["sku"]) or norm(last) == norm(zp["sku"]):
                cand = "Standard"
            else:
                cand = last if last and last != code else code
        cand = re.sub(r"^[\s._\-/]+", "", cand)
        cand = re.sub(r"^X\s*(?=\d)", "", cand)
        cand = re.sub(r"\s+", " ", cand).strip().replace("|", "/")
        cand = smart_title(cand) if cand else "Standard"
        cand = re.sub(r"\bPre\s*Order\b|\bPRE\s*ORDER\b|\bPre\b$|\bPRE\b$|\bPre\s|\bPRE\s", "Pre Order ", cand).strip()
        return re.sub(r"\s+", " ", cand) or "Standard"

    for zid, members in groups.items():
        zp = zen_products[zid]
        zen_used.add(zid)
        if len(members) == 1:
            it = members[0]
            row = {"row_type": "simple", "sku": it["code"], "parent_sku": "", "variation_label": ""}
            row.update(product_fields(it, zp))
            rows_out.append(row)
            continue
        parent_sku = f"ZEN-{zid}"
        first = members[0]
        pf = product_fields(first, zp)
        parent = {"row_type": "variable", "sku": parent_sku, "parent_sku": "", "variation_label": ""}
        parent.update(pf)
        parent.update({"regular_price": "", "manage_stock": "no", "stock_qty": "", "stock_status": "instock",
                       "enquire_only": "no", "visibility": "visible", "match_tier": "group", "xero_item_name": "", "xero_sales_description": "",
                       "xero_inventory_type": "", "xero_quantity": "", "xero_sales_account": "", "xero_tax_rate": ""})
        pflags = [f for f in pf["flags"].split(";") if f and f not in ("zero_price", "untracked", "prefix_match", "pre_order", "also_exists_archived")]
        pflags.append(f"variable_{len(members)}")
        parent["flags"] = ";".join(pflags)
        rows_out.append(parent)
        labels_seen: collections.Counter = collections.Counter()
        for it in sorted(members, key=lambda m: m["code"]):
            vf = product_fields(it, zp)
            label = variation_label(it, zp)
            labels_seen[label] += 1
            if labels_seen[label] > 1:
                label = smart_title(it["code"]).replace("|", "/") if norm(it["code"]) != norm(zp["sku"]) else f"{label} {labels_seen[label]}"
            row = {"row_type": "variation", "sku": it["code"], "parent_sku": parent_sku, "variation_label": label}
            row.update(vf)
            row.update({"name": f"{pf['name']} - {label}", "description": "", "image_file": "",
                        "category_ids": "", "category_slugs": "", "category_path": "", "category_source": ""})
            row["flags"] = ";".join(f for f in vf["flags"].split(";") if f and f not in ("no_image", "no_category", "category_guessed", "zen_product_has_no_image", "zen_image_missing_on_disk"))
            rows_out.append(row)

    for it in items:
        if it["zen_id"]:
            continue
        row = {"row_type": "simple", "sku": it["code"], "parent_sku": "", "variation_label": ""}
        row.update(product_fields(it, None))
        rows_out.append(row)

    rows_out.sort(key=lambda r: (r["parent_sku"] or r["sku"], r["row_type"] != "variable", r["sku"]))

    review_flags = {"prefix_match", "fuzzy_match", "image_from_sibling", "category_guessed", "no_category", "service_item",
                    "zen_category_unmapped", "zen_image_missing_on_disk", "category_prefix_blank", "zen_product_disabled"}
    for r in rows_out:
        if set(r["flags"].split(";")) & review_flags:
            review.append(r)

    with open(os.path.join(args.out, "products.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=out_cols)
        w.writeheader()
        w.writerows(rows_out)
    with open(os.path.join(args.out, "review.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=out_cols)
        w.writeheader()
        w.writerows(review)

    # enabled Zen products no active Xero item points at
    with open(os.path.join(args.out, "unmatched_zen.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["zen_product_id", "zen_sku", "zen_name", "zen_price", "zen_image", "matches_archived_xero", "zen_categories"])
        n_unmatched_zen = 0
        for p in sorted(zen_products.values(), key=lambda x: x["id"]):
            if p["status"] != 1 or p["id"] in zen_used:
                continue
            n_unmatched_zen += 1
            w.writerow([p["id"], p["sku"], p["display_name"], p["price"], p["image"],
                        "yes" if norm(p["sku"]) in archived_codes else "",
                        " | ".join(zen_cat_name.get(c, str(c)) for c in sorted(p["cats"]))])

    # images manifest so only the needed files travel to the server
    needed = sorted({r["image_file"] for r in rows_out if r["image_file"]})
    with open(os.path.join(args.out, "images_manifest.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(needed) + "\n")

    # ---------------- summary
    c = collections.Counter()
    tiers = collections.Counter()
    flag_counts = collections.Counter()
    for r in rows_out:
        c[r["row_type"]] += 1
        tiers[r["match_tier"]] += 1
        for f in r["flags"].split(";"):
            if f:
                flag_counts[f] += 1
    products = [r for r in rows_out if r["row_type"] != "variation"]
    lines = [
        f"Active Xero items considered: {len(items)} (skipped by overrides: {len(xero) - len(items)})",
        f"Woo products to create: {len(products)}  (simple={c['simple']}, variable={c['variable']}, variations={c['variation']})",
        f"Products with a Zen match: {sum(1 for r in products if r['zen_product_id'])}",
        f"Products with an image: {sum(1 for r in products if r['image_file'])}",
        f"Products with a real category: {sum(1 for r in products if r['category_ids'] and r['category_ids'] != str(uncategorized_id))}",
        f"Enabled Zen products with no active Xero item: {n_unmatched_zen}",
        "",
        "Match tiers: " + ", ".join(f"{k or 'none'}={v}" for k, v in tiers.most_common()),
        "Flags: " + ", ".join(f"{k}={v}" for k, v in flag_counts.most_common()),
        "Category sources: " + ", ".join(f"{k}={v}" for k, v in collections.Counter(r["category_source"] for r in products).most_common()),
        f"Rows in review.csv: {len(review)}",
        f"Image files needed: {len(needed)}",
    ]
    with open(os.path.join(args.out, "summary.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
