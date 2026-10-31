"""Generate the Arena dataset: financial QA with programmatically known answers.

Synthetic income statements for fictional companies; question templates whose
ground truth is computed, not guessed. Every case carries the exact answer and
a tolerance, so "verified accuracy" is actual verification.

Output: arena/data/questions.jsonl  (context, question, answer, tolerance, meta)
"""
import json
import random
from pathlib import Path

random.seed(2026)

COMPANIES = [
    "Meridian Logistics", "Calderon Foods", "Aster Textiles", "Nobal Tools",
    "Kestrel Electronics", "Harborline Shipping", "Verano Chemicals",
    "Brightpath Media", "Juniper Robotics", "Talon Steel",
]
YEARS = [2022, 2023, 2024]

TEMPLATES = [
    # (question template, compute fn -> value, unit, decimals)
    ("Using {company}'s {year} figures: revenue of ${rev:,.0f}M and operating income of ${op:,.0f}M, what is the operating margin (in %)?",
     lambda f: f["op"] / f["rev"] * 100, "percent", 1),
    ("From {company}'s {year} statement: revenue ${rev:,.0f}M, cost of revenue ${cogs:,.0f}M. What is the gross margin (in %)?",
     lambda f: (f["rev"] - f["cogs"]) / f["rev"] * 100, "percent", 1),
    ("{company} reported {year} net income of ${ni:,.0f}M on revenue of ${rev:,.0f}M. What is the net margin (in %)?",
     lambda f: f["ni"] / f["rev"] * 100, "percent", 1),
    ("{company}'s revenue grew from ${rev_prev:,.0f}M in {year_prev} to ${rev:,.0f}M in {year}. What was the YoY growth rate (in %)?",
     lambda f: (f["rev"] - f["rev_prev"]) / f["rev_prev"] * 100, "percent", 1),
    ("Using {company}'s {year} figures: operating income of ${op:,.0f}M and revenue of ${rev:,.0f}M, what was operating income in $M?",
     lambda f: f["op"], "$M", 0),
    ("{company}'s {year} opex (SG&A + R&D) was ${opex:,.0f}M on revenue of ${rev:,.0f}M. What is the opex ratio (in %)?",
     lambda f: f["opex"] / f["rev"] * 100, "percent", 1),
]


def statement(year: int) -> dict:
    rev = random.choice([random.uniform(400, 2000), random.uniform(2000, 8000)])
    f = {
        "rev": rev,
        "cogs": rev * random.uniform(0.4, 0.72),
        "opex": rev * random.uniform(0.12, 0.3),
    }
    f["gross"] = f["rev"] - f["cogs"]
    f["op"] = f["gross"] - f["opex"] * random.uniform(0.55, 0.95)
    f["ni"] = f["op"] * random.uniform(0.55, 0.92)
    f["rev_prev"] = rev / random.uniform(0.82, 1.24)
    f["year"] = year
    f["year_prev"] = year - 1
    return f


def context_text(company: str, f: dict) -> str:
    return (
        f"{company} — consolidated income statement, FY{f['year']} ($M):\n"
        f"Revenue: {f['rev']:,.0f}\n"
        f"Cost of revenue: {f['cogs']:,.0f}\n"
        f"Gross profit: {f['gross']:,.0f}\n"
        f"Operating expenses (SG&A + R&D): {f['opex']:,.0f}\n"
        f"Operating income: {f['op']:,.0f}\n"
        f"Net income: {f['ni']:,.0f}\n"
        f"(Prior year FY{f['year_prev']} revenue: {f['rev_prev']:,.0f})"
    )


def main() -> None:
    out = Path(__file__).parent / "data"
    out.mkdir(exist_ok=True)
    cases = []
    for company in COMPANIES:
        for year in YEARS:
            f = statement(year)
            ctx = context_text(company, f)
            t = random.choice(TEMPLATES)
            q = t[0].format(company=company, **f)
            value = round(t[1](f), t[3])
            cases.append({
                "id": f"{company.lower().replace(' ', '_')}_{year}",
                "context": ctx,
                "question": q,
                "answer": value,
                "unit": t[2],
                "tolerance": 0.15 if t[2] == "percent" else 0.5,
            })

    with (out / "questions.jsonl").open("w") as fh:
        for c in cases:
            fh.write(json.dumps(c) + "\n")
    print(f"questions: {len(cases)} -> {out / 'questions.jsonl'}")

    # Training split: same distribution, fresh companies/years. Completions are
    # worked solutions (chain of thought) so the specialist learns to compute.
    WORK = {
        0: lambda f, v: f" ({f['op']:,.0f} / {f['rev']:,.0f}) × 100 = {v}%",
        1: lambda f, v: f" (({f['rev']:,.0f} − {f['cogs']:,.0f}) / {f['rev']:,.0f}) × 100 = {v}%",
        2: lambda f, v: f" ({f['ni']:,.0f} / {f['rev']:,.0f}) × 100 = {v}%",
        3: lambda f, v: f" (({f['rev']:,.0f} − {f['rev_prev']:,.0f}) / {f['rev_prev']:,.0f}) × 100 = {v}%",
        4: lambda f, v: f" {f['op']:,.0f} $M",
        5: lambda f, v: f" ({f['opex']:,.0f} / {f['rev']:,.0f}) × 100 = {v}%",
    }
    train_rows, valid_rows = [], []
    for i in range(2200):
        company = f"Company {i} Holdings"
        year = random.choice([2021, 2022, 2023, 2024])
        f = statement(year)
        ctx = context_text(company, f)
        t_i = random.randrange(len(TEMPLATES))
        t = TEMPLATES[t_i]
        q = t[0].format(company=company, **f)
        value = round(t[1](f), t[3])
        row = {"prompt": f"{ctx}\n\n{q}", "completion": WORK[t_i](f, value)}
        (valid_rows if i % 10 == 0 else train_rows).append(row)

    for name, rows in [("fin_train", train_rows), ("fin_valid", valid_rows)]:
        with (out / f"{name}.jsonl").open("w") as fh:
            for r in rows:
                fh.write(json.dumps(r) + "\n")
    print(f"fin_train: {len(train_rows)}, fin_valid: {len(valid_rows)}")


if __name__ == "__main__":
    main()
