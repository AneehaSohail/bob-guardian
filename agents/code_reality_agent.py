"""
Code Reality Agent
--------------------
Scans the actual source code in a repo and extracts "facts" -- statements
about what the code actually does (functions, API routes, auth checks,
config values). These facts are what the Context Auditor's claims get
checked against.

Usage:
    python code_reality_agent.py --repo /path/to/target/repo --out reality.json
"""

import os
import argparse
import json
from pathlib import Path

from agents.shared_config import get_llm, get_embeddings, get_chroma_client, Statement, save_statements

# File extensions we scan. Extend as needed for the demo repo's stack.
CODE_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go"}

# Folders to skip entirely
SKIP_DIRS = {
    "node_modules", "venv", ".venv", "__pycache__", ".git",
    "dist", "build", ".next", "chroma_store",
}

FACT_EXTRACTION_PROMPT = """You are analyzing a source code file to extract atomic factual statements
about what the code ACTUALLY does (not what it should do or what's documented -- only what's
really in the code).

Focus especially on things that documentation commonly describes: authentication logic,
API endpoints and their methods/params, data storage, config values, business rules,
validation logic.

Good examples:
- "Authentication uses session cookies with a 1-hour expiry (see SESSION_TTL constant)"
- "The /login route accepts POST and requires 'email' and 'password' fields"
- "Passwords are hashed with bcrypt before storage"

Return ONLY a JSON array, no other text, in this exact format:
[
  {{"subject": "short topic like 'auth flow' or '/login endpoint'", "statement": "the fact, one sentence", "source_location": "function name or approximate line reference"}}
]

If there's nothing checkable in this code (e.g. pure UI styling, no logic), return an empty array: []

CODE FILE: {filename}
CODE:
{code}
"""


def find_code_files(repo_path: Path) -> list[Path]:
    found = []
    for path in repo_path.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in CODE_EXTENSIONS:
            continue
        if any(skip in path.parts for skip in SKIP_DIRS):
            continue
        found.append(path)
    return found


def chunk_code(text: str, max_chars: int = 2500) -> list[str]:
    """Naive chunking for large files. A smarter version could chunk by
    function/class boundary using an AST parser -- worth doing if time
    allows, since it keeps functions intact."""
    chunks = []
    for i in range(0, len(text), max_chars):
        chunks.append(text[i:i + max_chars])
    return chunks


def extract_facts_from_file(llm, filepath: Path, repo_path: Path) -> list[Statement]:
    text = filepath.read_text(encoding="utf-8", errors="ignore")
    rel_path = str(filepath.relative_to(repo_path))

    # Skip trivial/empty files quickly to save LLM calls
    if len(text.strip()) < 20:
        return []

    statements = []
    for chunk in chunk_code(text):
        prompt = FACT_EXTRACTION_PROMPT.format(filename=rel_path, code=chunk)
        response = llm.invoke(prompt)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.strip("`")
            raw = raw.split("\n", 1)[-1] if raw.lower().startswith("json") else raw

        try:
            facts = json.loads(raw)
        except json.JSONDecodeError:
            print(f"  [warn] Could not parse facts JSON from {rel_path}, skipping chunk")
            print("  [debug] Raw LLM response:")
            print(raw[:3000])
            print("  [debug] End raw response")
            continue

        for f in facts:
            statements.append(Statement.new(
                type="fact",
                subject=f.get("subject", "unknown"),
                statement=f.get("statement", ""),
                source_file=rel_path,
                source_location=f.get("source_location", ""),
                raw_excerpt=chunk[:300],
            ))

    return statements


def run_code_reality_agent(repo_path: str, out_path: str, persist_dir: str = "./chroma_store") -> list[Statement]:
    repo = Path(repo_path).resolve()
    code_files = find_code_files(repo)

    if not code_files:
        print(f"No code files found in {repo} with extensions {CODE_EXTENSIONS}")
        return []

    print(f"Found {len(code_files)} code file(s) to scan")

    llm = get_llm()
    all_statements: list[Statement] = []

    for filepath in code_files:
        rel = filepath.relative_to(repo)
        print(f"Extracting facts from {rel}...")
        statements = extract_facts_from_file(llm, filepath, repo)
        print(f"  -> {len(statements)} fact(s) found")
        all_statements.extend(statements)

    if all_statements:
        embeddings = get_embeddings()
        client = get_chroma_client(persist_dir)
        collection = client.get_or_create_collection("code_reality")

        texts = [s.statement for s in all_statements]
        vectors = embeddings.embed_documents(texts)

        collection.upsert(
            ids=[s.id for s in all_statements],
            embeddings=vectors,
            documents=texts,
            metadatas=[{
                "subject": s.subject,
                "source_file": s.source_file,
                "source_location": s.source_location,
            } for s in all_statements],
        )
        print(f"Stored {len(all_statements)} facts in ChromaDB collection 'code_reality'")

    save_statements(all_statements, out_path)
    return all_statements


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract facts from a repo's actual source code")
    parser.add_argument("--repo", required=True, help="Path to the target repo")
    parser.add_argument("--out", default="reality.json", help="Output JSON path")
    parser.add_argument("--chroma-dir", default="./chroma_store", help="ChromaDB persist directory")
    args = parser.parse_args()

    run_code_reality_agent(args.repo, args.out, args.chroma_dir)
