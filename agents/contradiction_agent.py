"""
Contradiction Agent
---------------------
Takes the claims.json (from context_auditor.py) and reality.json (from
code_reality_agent.py), matches each claim to the most semantically similar
fact(s) using ChromaDB, then asks the LLM to judge whether they agree,
contradict, or if there's no matching evidence at all.

This is the piece that depends on BOTH sides' work being done first, so
build/test this together once the other four agents are producing real
output.

Usage:
    python contradiction_agent.py --claims claims.json --reality reality.json --out findings.json
"""

import argparse
import json
from dataclasses import dataclass, asdict
from typing import Literal

from shared_config import get_llm, get_embeddings, get_chroma_client, Statement

Verdict = Literal["agrees", "contradicts", "unverifiable"]
Severity = Literal["high", "medium", "low", "none"]


@dataclass
class Finding:
    id: str
    subject: str
    verdict: Verdict
    severity: Severity
    explanation: str
    claim_statement: str
    claim_source_file: str
    claim_source_location: str
    fact_statement: str = ""
    fact_source_file: str = ""
    fact_source_location: str = ""
    similarity_score: float = 0.0


JUDGE_PROMPT = """You are comparing a CLAIM (from project documentation) against a FACT
(extracted from the actual source code) to determine if they agree or contradict.

CLAIM (what the docs say): "{claim}"
FACT (what the code actually does): "{fact}"

Judge the relationship and respond with ONLY a JSON object, no other text:
{{
  "verdict": "agrees" | "contradicts" | "unverifiable",
  "severity": "high" | "medium" | "low" | "none",
  "explanation": "one or two sentences explaining your judgment"
}}

Guidance:
- "agrees": the fact confirms the claim, no meaningful discrepancy
- "contradicts": the fact clearly conflicts with the claim (e.g. claim says JWT with 24h expiry,
  code shows session cookies with 1h expiry)
- "unverifiable": the fact doesn't actually address the claim closely enough to judge either way
- severity "high": contradiction could cause a developer or AI agent to write broken/insecure code
  based on the wrong claim
- severity "medium": contradiction is real but low-impact (e.g. minor detail mismatch)
- severity "low": trivial wording difference, not a real functional contradiction
- severity "none": use only when verdict is "agrees" or "unverifiable"
"""


def load_statements(path: str) -> list[Statement]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [Statement(**item) for item in raw]


def match_claim_to_facts(
    claim: Statement,
    embeddings,
    chroma_collection,
    top_k: int = 3,
) -> list[tuple[dict, float]]:
    """Query the code_reality collection for facts semantically similar
    to this claim. Returns list of (metadata+document, similarity_score)."""
    query_vector = embeddings.embed_query(claim.statement)
    results = chroma_collection.query(
        query_embeddings=[query_vector],
        n_results=top_k,
    )

    matches = []
    if results["ids"] and results["ids"][0]:
        for i in range(len(results["ids"][0])):
            distance = results["distances"][0][i]
            similarity = 1 - distance  # chroma returns cosine distance by default
            matches.append((
                {
                    "id": results["ids"][0][i],
                    "document": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                },
                similarity,
            ))
    return matches


def judge_pair(llm, claim_text: str, fact_text: str) -> dict:
    prompt = JUDGE_PROMPT.format(claim=claim_text, fact=fact_text)
    response = llm.invoke(prompt)
    raw = response.content.strip()

    if raw.startswith("```"):
        raw = raw.strip("`")
        raw = raw.split("\n", 1)[-1] if raw.lower().startswith("json") else raw

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "verdict": "unverifiable",
            "severity": "none",
            "explanation": "Could not parse judgment from LLM response.",
        }


MIN_SIMILARITY_TO_JUDGE = 0.55  # below this, don't bother calling the LLM


def run_contradiction_agent(
    claims_path: str,
    reality_path: str,
    out_path: str,
    persist_dir: str = "./chroma_store",
    top_k: int = 3,
) -> list[Finding]:
    claims = load_statements(claims_path)
    print(f"Loaded {len(claims)} claim(s) from {claims_path}")

    embeddings = get_embeddings()
    llm = get_llm()
    client = get_chroma_client(persist_dir)
    reality_collection = client.get_or_create_collection("code_reality")

    findings: list[Finding] = []

    for claim in claims:
        matches = match_claim_to_facts(claim, embeddings, reality_collection, top_k)

        # No matching fact found at all -> claim is unverifiable, worth flagging
        # since it means nothing in the code confirms this documented behavior
        relevant_matches = [m for m in matches if m[1] >= MIN_SIMILARITY_TO_JUDGE]

        if not relevant_matches:
            findings.append(Finding(
                id=f"f_{claim.id}",
                subject=claim.subject,
                verdict="unverifiable",
                severity="medium",
                explanation="No matching code fact found for this claim. Either the "
                             "feature doesn't exist in code, or it wasn't captured "
                             "by the code reality agent.",
                claim_statement=claim.statement,
                claim_source_file=claim.source_file,
                claim_source_location=claim.source_location,
            ))
            continue

        for match_data, similarity in relevant_matches:
            fact_text = match_data["document"]
            fact_meta = match_data["metadata"]

            judgment = judge_pair(llm, claim.statement, fact_text)

            findings.append(Finding(
                id=f"f_{claim.id}_{match_data['id']}",
                subject=claim.subject,
                verdict=judgment.get("verdict", "unverifiable"),
                severity=judgment.get("severity", "none"),
                explanation=judgment.get("explanation", ""),
                claim_statement=claim.statement,
                claim_source_file=claim.source_file,
                claim_source_location=claim.source_location,
                fact_statement=fact_text,
                fact_source_file=fact_meta.get("source_file", ""),
                fact_source_location=fact_meta.get("source_location", ""),
                similarity_score=round(similarity, 3),
            ))

    # Save full findings
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump([asdict(finding) for finding in findings], f, indent=2)

    # Print a quick summary so you see results immediately in the terminal
    contradictions = [f for f in findings if f.verdict == "contradicts"]
    unverifiable = [f for f in findings if f.verdict == "unverifiable"]
    agrees = [f for f in findings if f.verdict == "agrees"]

    print(f"\n--- Summary ---")
    print(f"Total findings: {len(findings)}")
    print(f"  Contradictions: {len(contradictions)}")
    print(f"  Unverifiable:   {len(unverifiable)}")
    print(f"  Agrees:         {len(agrees)}")

    high_severity = [f for f in contradictions if f.severity == "high"]
    if high_severity:
        print(f"\n[!] {len(high_severity)} HIGH severity contradiction(s):")
        for f in high_severity:
            print(f"  - {f.subject}: claim says '{f.claim_statement[:80]}...' "
                  f"but code shows '{f.fact_statement[:80]}...'")

    print(f"\nFull results saved to {out_path}")
    return findings


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compare doc claims against code facts")
    parser.add_argument("--claims", required=True, help="Path to claims.json")
    parser.add_argument("--reality", required=True, help="Path to reality.json")
    parser.add_argument("--out", default="findings.json", help="Output JSON path")
    parser.add_argument("--chroma-dir", default="./chroma_store", help="ChromaDB persist directory")
    parser.add_argument("--top-k", type=int, default=3, help="How many facts to check per claim")
    args = parser.parse_args()
    run_contradiction_agent(args.claims, args.reality, args.out, args.chroma_dir, args.top_k)