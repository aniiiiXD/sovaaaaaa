# Sova / HeavyWork

Full project snapshot: [aniiiiXD/sovaaaaaa](https://github.com/aniiiiXD/sovaaaaaa).

The Sova-branded custom-model market brief is in
[`Research/rl-post-training-2026-10-31/index.html`](Research/rl-post-training-2026-10-31/index.html).
Open it directly in a browser; the accompanying research, sources, tweet drafts
and chart plans live beside it. Its market-size scenarios are illustrative.

Five folders, one job each. Work flows one way: Lab → numbers → website.

```
HeavyWork/
├── website/    The product. Next.js 16 site (own git repo) — renders the
│               measured numbers, hosts the API routes that call Bedrock.
├── backend/    Common infrastructure: AWS/Bedrock serving configs; future
│               DBs and API services.
├── Lab/        All ML work (own git repo — the experiment history):
│               triage/ (Banking77 specialist, done) and arena/ (FinQA
│               benchmark, active).
├── Research/   Papers, research notes, site previews, founder research.
└── startup/    Operational artifacts (distribution xlsx, workflow proof)
                and the archive (superseded website-inference-v1).
```

## Git ownership

- This root repository includes the source and versioned artifacts from
  `website/`, `Lab/`, `backend/`, `Research/` and `startup/`, including the
  archived website.
- Nested local repositories retain their existing Git histories and remotes;
  the root stores their working-tree contents as ordinary files, not submodules.
- Virtual environments, dependencies, caches, local runtime state and credentials
  are excluded. Existing model adapters and dataset artifacts are included.

Rig (`Lab/rig/`) is an unexecuted modular post-training/API implementation.
No training, serving jobs, dependency installations or ML tests were run as part
of this repository export.

## Rules of the road

- `Lab/build_scoreboard.py` writes into `website/src/app/arena/` — that's
  the only cross-folder write.
- Scratch and one-off dumps go to `startup/`, not folder roots.
- Measured numbers only: what the site claims, Lab's reports prove.
