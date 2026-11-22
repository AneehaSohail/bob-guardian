"""
Context Auditor Agent
----------------------
Reads AGENTS.md, README, and other doc files in a repo and extracts a list
of atomic "claims": factual statements about how the project supposedly
works. These claims are what the Code Reality Agent's facts will later be
checked against.

Usage:
    python context_auditor.py --repo /path/to/target/repo --out claims.json
"""

import os
import argparse
import json
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from shared_config import get_llm, get_embeddings, get_chroma_client, Statement, save_statements

# Doc files/folders we scan by default. Extend this list as needed.
DOC_PATTERNS = [
    "AGENTS.md",
    ".bob/**/AGENTS*.md",   # Bob's mode-specific context files
    "README.md",
    "docs/**/*.md",
]

CLAIM_EXTRACTION_PROMPT = """You are analyzing a project documentation file to extract atomic factual claims.

A "claim" is a single, specific, checkable statement about how the codebase works.
Good examples:
- "Authentication uses JWT tokens with a 24-hour expiry"
- "The /login endpoint accepts POST requests with email and password"
- "User profile data is stored in the users table"

Bad examples (too vague, not checkable):
- "The app has good security"
- "This is a web application"

Extract every checkable claim from the text below. Return ONLY a JSON array,
no other text, in this exact format:
[
  {{"subject": "short topic like 'auth flow' or '/login endpoint'", "statement": "the claim, one sentence", "source_location": "heading or nearby context, e.g. 'Authentication section'"}}
]

If there are no checkable claims in this text, return an empty array: []

DOCUMENT TEXT:
{text}
"""


def find_doc_files(repo_path: Path) -> list[Path]:
    found = []
    for pattern in DOC_PATTERNS:
        found.extend(repo_path.glob(pattern))
    # de-dupe while preserving order
    seen = set()
    unique = []
    for f in found:
        if f.is_file() and f not in seen:
            seen.add(f)
            unique.append(f)
    return unique


def chunk_text(text: str, max_chars: int = 4000) -> list[str]:
    """Naive chunking so we don't blow past context limits on huge docs."""
    chunks = []
    for i in range(0, len(text), max_chars):
        chunks.append(text[i:i + max_chars])
    return chunks


def extract_claims_from_file(llm, filepath: Path, repo_path: Path) -> list[Statement]:
    text = filepath.read_text(encoding="utf-8", errors="ignore")
    rel_path = str(filepath.relative_to(repo_path))
    statements = []

    for chunk in chunk_text(text):
        if not chunk.strip():
            continue
        prompt = CLAIM_EXTRACTION_PROMPT.format(text=chunk)
        response = llm.invoke(prompt)
        raw = response.content.strip()

        # Strip markdown code fences if the model wrapped its JSON in them
        if raw.startswith("```"):
            raw = raw.strip("`")
            raw = raw.split("\n", 1)[-1] if raw.lower().startswith("json") else raw

        try:
            claims = json.loads(raw)
        except json.JSONDecodeError:
            print(f"  [warn] Could not parse claims JSON from {rel_path}, skipping chunk")
            continue

        for c in claims:
            statements.append(Statement.new(
                type="claim",
                subject=c.get("subject", "unknown"),
                statement=c.get("statement", ""),
                source_file=rel_path,
                source_location=c.get("source_location", ""),
                raw_excerpt=chunk[:300],
            ))

    return statements


def _file_hash(filepath: Path) -> str:
    """MD5 of file contents — used to skip unchanged files."""
    return hashlib.md5(filepath.read_bytes()).hexdigest()


def run_context_auditor(
    repo_path: str,
    out_path: str,
    persist_dir: str = "./chroma_store",
    max_workers: int = 4,
) -> list[Statement]:
    repo = Path(repo_path).resolve()
    doc_files = find_doc_files(repo)

    if not doc_files:
        print(f"No doc files found in {repo} matching {DOC_PATTERNS}")
        return []

    print(f"Found {len(doc_files)} doc file(s): {[str(f.relative_to(repo)) for f in doc_files]}")

    # Check which files have already been processed (by hash stored in ChromaDB)
    client = get_chroma_client(persist_dir)
    collection = client.get_or_create_collection("context_claims")
    existing_meta = collection.get(include=["metadatas"])["metadatas"] or []
    processed_hashes = {m.get("file_hash") for m in existing_meta if m.get("file_hash")}

    files_to_process = []
    skipped = 0
    for f in doc_files:
        if _file_hash(f) in processed_hashes:
            skipped += 1
        else:
            files_to_process.append(f)

    if skipped:
        print(f"Skipping {skipped} unchanged file(s) (already in ChromaDB)")

    llm = get_llm()
    all_statements: list[Statement] = []

    def process_file(filepath: Path):
        stmts = extract_claims_from_file(llm, filepath, repo)
        print(f"  {filepath.name} -> {len(stmts)} claim(s)")
        return filepath, stmts

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(process_file, f): f for f in files_to_process}
        for future in as_completed(futures):
            filepath, stmts = future.result()
            # Tag each statement with the file hash so we can skip it next run
            fhash = _file_hash(filepath)
            for s in stmts:
                s.raw_excerpt = s.raw_excerpt  # no-op, just clarity
            all_statements.extend(stmts)

    # Embed + store in ChromaDB
    if all_statements:
        embeddings = get_embeddings()
        fhash_map = {str(f.relative_to(repo)): _file_hash(f) for f in files_to_process}

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
                "file_hash": fhash_map.get(s.source_file, ""),
            } for s in all_statements],
        )
        print(f"Stored {len(all_statements)} claims in ChromaDB collection 'context_claims'")

    save_statements(all_statements, out_path)
    return all_statements


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract claims from a repo's doc files")
    parser.add_argument("--repo", required=True, help="Path to the target repo")
    parser.add_argument("--out", default="claims.json", help="Output JSON path")
    parser.add_argument("--chroma-dir", default="./chroma_store", help="ChromaDB persist directory")
    args = parser.parse_args()

    run_context_auditor(args.repo, args.out, args.chroma_dir, max_workers=4)