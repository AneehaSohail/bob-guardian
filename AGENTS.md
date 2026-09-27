# Bob Guardian — Agents

Bob Guardian audits what documentation *claims* a codebase does against what the code *actually* does, surfacing stale docs and context drift before they cause silent bugs.

There are **5 agents** that run as a pipeline. Three are independent (run in parallel if you like), two depend on the others' output.

---

## Pipeline Overview

```
Target repo
    │
    ├──► [1] Context Auditor          ──► claims.json
    │                                         │
    ├──► [2] Code Reality Agent       ──► reality.json ──► ChromaDB (code_reality)
    │                                         │
    ├──► [3] Documentation Consistency ──► documentation_consistency.json
    │                                         │
    │                                         ▼
    │                              [4] Evidence Agent ──► evidence.json
    │
    └──► (claims.json + ChromaDB) ──► [5] Contradiction Agent ──► findings.json
```

Agents 1, 2, and 3 can be run independently against a target repo.  
Agent 4 requires Agent 3's output.  
Agent 5 requires Agents 1 and 2's output (claims.json + the ChromaDB store).

---

## Shared Infrastructure

All agents share [`shared_config.py`](agents/shared_config.py) which provides:

| Component | Default | Override via env var |
|---|---|---|
| LLM | `llama3.1` (Ollama) | `OLLAMA_MODEL` |
| Embeddings | `nomic-embed-text` (Ollama) | `OLLAMA_EMBED_MODEL` |
| Ollama host | `http://localhost:11434` | `OLLAMA_BASE_URL` |
| ChromaDB | `./chroma_store` (persistent) | `--chroma-dir` CLI flag |

The shared `Statement` dataclass is the wire format passed between agents:

```python
Statement(id, type, subject, statement, source_file, source_location, raw_excerpt)
# type = "claim"  (from docs)  or  "fact"  (from code)
```

---

## Agent 1 — Context Auditor

**File:** [`agents/context_auditor.py`](agents/context_auditor.py)

**Purpose:** Reads documentation files (`AGENTS.md`, `README.md`, `docs/**/*.md`, `.bob/**/AGENTS*.md`) from the target repo and uses the LLM to extract atomic, checkable *claims* — specific factual statements about how the project is supposed to work.

**Input:** A target repository path.

**Output:** `claims.json` (list of `Statement` objects with `type="claim"`) + entries stored in ChromaDB collection `context_claims`.

**Usage:**
```bash
python context_auditor.py --repo /path/to/target/repo --out claims.json
# Optional:
#   --chroma-dir ./chroma_store
```

**Key behaviours:**
- Skips files whose MD5 hash is already present in ChromaDB (incremental re-runs).
- Processes files concurrently (`--max-workers`, default 4).
- Chunks large files at 4,000 chars to stay within the LLM's context window.
- Strips markdown code fences from LLM responses before parsing JSON.

---

## Agent 2 — Code Reality Agent

**File:** [`agents/code_reality_agent.py`](agents/code_reality_agent.py)

**Purpose:** Walks the actual source code of the target repo and uses the LLM to extract *facts* — what the code truly does (routes, auth logic, config values, data storage, business rules). These are the ground truth that claims are checked against.

**Input:** A target repository path.

**Output:** `reality.json` (list of `Statement` objects with `type="fact"`) + entries stored in ChromaDB collection `code_reality`.

**Usage:**
```bash
python code_reality_agent.py --repo /path/to/target/repo --out reality.json
# Optional:
#   --chroma-dir ./chroma_store
```

**Scanned extensions:** `.py .js .ts .jsx .tsx .java .go`

**Skipped directories:** `node_modules venv __pycache__ .git dist build .next chroma_store`

**Key behaviours:**
- Skips files under 20 characters (trivially empty).
- Skips files already hashed in ChromaDB (incremental re-runs).
- Chunks large files at 6,000 chars.
- Processes files concurrently (default 4 workers).

---

## Agent 3 — Documentation Consistency Agent

**File:** [`agents/documentation_consistency.py`](agents/documentation_consistency.py)

**Purpose:** Compares documentation files *against each other* to find internal contradictions and inconsistencies — without looking at source code at all. Produces a list of documentation-level conflicts for Agent 4 to verify.

**Input:** A target repository path.

**Output:** `documentation_consistency.json` — list of contradiction objects, each containing `topic`, `claim_a`, `location_a`, `claim_b`, `location_b`, `severity`, and `explanation`.

**Usage:**
```bash
python documentation_consistency.py --repo /path/to/target/repo --out documentation_consistency.json
```

**Scanned files:** All `.md` / `.markdown` files, `README.md`, `AGENTS.md`, files under `docs/` and `.bob/`.

**Key behaviours:**
- Extracts claims from each doc independently, then pairwise-compares claim groups across documents.
- Reports only *genuine* contradictions (incompatible facts), not wording differences or additive information.
- Severity scale: `critical | high | medium | low`.

---

## Agent 4 — Evidence Agent

**File:** [`agents/evidence_agent.py`](agents/evidence_agent.py)

**Purpose:** Takes each finding from the Documentation Consistency Agent and searches the actual repository for concrete evidence that supports, contradicts, or cannot verify it. Acts as a second opinion / hallucination guard on Agent 3's output.

**Input:** `documentation_consistency.json` + a target repository path.

**Output:** `evidence.json` — each finding enriched with `evidence[]`, `conclusion`, and `confidence`.

**Usage:**
```bash
python evidence_agent.py --repo /path/to/target/repo --input documentation_consistency.json --out evidence.json
```

**Evidence priority (highest → lowest):**
1. Executable source code
2. Tests
3. API / route definitions
4. Configuration
5. Database schemas
6. Fixtures / structured data
7. Documentation

**Key behaviours:**
- Scans a wide range of extensions (`.py .js .ts .go .sql .yaml .json .md` and more).
- Validates every file path and line number the LLM returns against the real repository — hallucinated paths or out-of-range lines are silently dropped.
- Reconstructs excerpts from the actual file contents rather than trusting the LLM-generated excerpt.
- Returns `NO_RELIABLE_EVIDENCE_FOUND` when the repo doesn't contain usable evidence.

---

## Agent 5 — Contradiction Agent

**File:** [`agents/contradiction_agent.py`](agents/contradiction_agent.py)

**Purpose:** Cross-references every *claim* (from Agent 1) against the *facts* stored in ChromaDB (from Agent 2) using semantic similarity, then asks the LLM to judge whether they agree, contradict, or are unverifiable. This is the final verdict layer.

**Input:** `claims.json` + `reality.json` + the ChromaDB store populated by Agents 1 and 2.

**Output:** `findings.json` — list of `Finding` objects.

**Usage:**
```bash
python contradiction_agent.py --claims claims.json --reality reality.json --out findings.json
# Optional:
#   --chroma-dir ./chroma_store
#   --top-k 3        (how many facts to match per claim, default 3)
```

**Finding schema:**

| Field | Description |
|---|---|
| `verdict` | `agrees` / `contradicts` / `unverifiable` |
| `severity` | `high` / `medium` / `low` / `none` |
| `explanation` | One or two sentence LLM judgment |
| `claim_statement` | The original doc claim |
| `fact_statement` | The matched code fact |
| `similarity_score` | Cosine similarity (0–1) |

**Key behaviours:**
- Embeds all claims in a single batch call to the embedding model (efficient).
- Skips LLM judgment when cosine similarity is below **0.40** — marks as `unverifiable` automatically.
- Prints a terminal summary showing totals and any `high` severity contradictions immediately after running.

---

## Running the Full Pipeline

```bash
cd agents

# Step 1 & 2 (independent — can run simultaneously)
python context_auditor.py    --repo ../galaxium-travels --out claims.json
python code_reality_agent.py --repo ../galaxium-travels --out reality.json

# Step 3 (independent)
python documentation_consistency.py --repo ../galaxium-travels --out documentation_consistency.json

# Step 4 (requires step 3)
python evidence_agent.py --repo ../galaxium-travels --input documentation_consistency.json --out evidence.json

# Step 5 (requires steps 1 & 2)
python contradiction_agent.py --claims claims.json --reality reality.json --out findings.json
```

> **Performance tip:** Set `$env:OLLAMA_NUM_PARALLEL = "4"` (PowerShell) or `export OLLAMA_NUM_PARALLEL=4` (bash) and restart Ollama before running to process files in parallel.
