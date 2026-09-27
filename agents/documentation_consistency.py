"""
Documentation Consistency Agent

Purpose:
    Finds contradictions, inconsistencies, outdated claims, and conflicting
    statements between documentation sources in a repository.

The agent only compares documentation against other documentation.
It does NOT inspect application source code to determine whether a claim
is true.

Input:
    A target repository path.

Output:
    documentation_consistency.json
"""

import argparse
import json
import os
import re
from pathlib import Path
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

from shared_config import get_llm


# ---------------------------------------------------------------------------
# Documentation discovery
# ---------------------------------------------------------------------------

DOCUMENTATION_FILES = {
    "README.md",
    "AGENTS.md",
}

DOCUMENTATION_EXTENSIONS = {
    ".md",
    ".markdown",
}

SKIP_DIRECTORIES = {
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    ".next",
    "chroma_store",
    "test_chroma",
}


def should_skip(path: Path) -> bool:
    """Return True if the path is inside a directory we should ignore."""
    return any(part in SKIP_DIRECTORIES for part in path.parts)


def discover_documentation(repo_path: Path) -> List[Path]:
    """
    Find documentation files inside the repository.

    Includes:
        README.md
        AGENTS.md
        Markdown files inside docs/
        .bob/
        other documentation folders
    """

    documents = []

    for path in repo_path.rglob("*"):

        if not path.is_file():
            continue

        if should_skip(path):
            continue

        filename = path.name.lower()

        # README / AGENTS files
        if filename in {"readme.md", "agents.md"}:
            documents.append(path)
            continue

        # Markdown documentation
        if path.suffix.lower() in DOCUMENTATION_EXTENSIONS:
            documents.append(path)

    return sorted(set(documents))


# ---------------------------------------------------------------------------
# File reading
# ---------------------------------------------------------------------------

def read_document(path: Path, repo_path: Path) -> Dict[str, Any]:
    """Read a documentation file and preserve line numbers."""

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8", errors="replace")

    relative_path = path.relative_to(repo_path).as_posix()

    lines = text.splitlines()

    numbered_lines = []

    for index, line in enumerate(lines, start=1):
        numbered_lines.append(
            {
                "line": index,
                "text": line
            }
        )

    return {
        "file": relative_path,
        "text": text,
        "lines": numbered_lines,
    }


# ---------------------------------------------------------------------------
# LLM helper
# ---------------------------------------------------------------------------

def extract_json(text: str):
    """
    Extract JSON from an LLM response.

    Handles responses containing:
        {...}
        [...]
        ```json
        {...}
        ```
    """

    text = text.strip()

    # Remove markdown code fences
    text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```$", "", text).strip()

    # Try direct JSON first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to locate JSON object
    object_match = re.search(r"\{.*\}", text, re.DOTALL)

    if object_match:
        try:
            return json.loads(object_match.group(0))
        except json.JSONDecodeError:
            pass

    # Try to locate JSON array
    array_match = re.search(r"\[.*\]", text, re.DOTALL)

    if array_match:
        try:
            return json.loads(array_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


# ---------------------------------------------------------------------------
# Document claim extraction
# ---------------------------------------------------------------------------

def extract_claims(llm, document: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Ask the LLM to extract factual/checkable claims from one document.
    """

    prompt = f"""
You are the Documentation Consistency Agent for a software repository.

Your task is to extract factual, checkable claims from the documentation
below.

Only extract claims that could potentially conflict with another document.

Focus on things such as:

- authentication
- authorization
- API endpoints
- HTTP methods
- database technology
- database schema
- project structure
- frameworks
- libraries
- configuration
- environment variables
- deployment
- business rules
- file paths
- feature descriptions
- software versions
- dependencies
- setup instructions

Do NOT invent information.

Do NOT interpret opinions as factual claims.

Return ONLY valid JSON.

Expected format:

[
  {{
    "claim": "exact factual claim",
    "location": "filename, line number or line range"
  }}
]

DOCUMENT:

File: {document["file"]}

{document["text"]}
"""

    response = llm.invoke(prompt)

    result = extract_json(response.content)

    if not isinstance(result, list):
        return []

    cleaned = []

    for item in result:
        if not isinstance(item, dict):
            continue

        claim = str(item.get("claim", "")).strip()
        location = str(item.get("location", "")).strip()

        if claim:
            cleaned.append(
                {
                    "claim": claim,
                    "location": location,
                    "source": document["file"],
                }
            )

    return cleaned


# ---------------------------------------------------------------------------
# Contradiction detection
# ---------------------------------------------------------------------------

def compare_claim_groups(
    llm,
    claims_a: List[Dict[str, Any]],
    claims_b: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Compare claims from two documentation sources.

    The LLM determines whether any claims directly contradict one another.
    """

    if not claims_a or not claims_b:
        return []

    prompt = f"""
You are checking documentation consistency in a software repository.

Compare the claims from DOCUMENT A with the claims from DOCUMENT B.

Report ONLY genuine contradictions or materially conflicting factual claims.

Do NOT report:
- simple differences in wording
- additional information
- compatible statements
- vague similarities
- assumptions
- things that cannot be proven from the supplied claims

A contradiction requires the two claims to describe incompatible facts.

For every contradiction return:

{{
  "contradictions": [
    {{
      "topic": "",
      "claim_a": "",
      "location_a": "",
      "claim_b": "",
      "location_b": "",
      "severity": "critical|high|medium|low",
      "explanation": ""
    }}
  ]
}}

DOCUMENT A CLAIMS:

{json.dumps(claims_a, indent=2)}

DOCUMENT B CLAIMS:

{json.dumps(claims_b, indent=2)}

Return ONLY valid JSON.
"""

    response = llm.invoke(prompt)

    result = extract_json(response.content)

    if not isinstance(result, dict):
        return []

    contradictions = result.get("contradictions", [])

    if not isinstance(contradictions, list):
        return []

    return contradictions


# ---------------------------------------------------------------------------
# Main agent
# ---------------------------------------------------------------------------

def run_agent(repo_path: str, output_path: str):
    repo = Path(repo_path).resolve()

    if not repo.exists():
        raise FileNotFoundError(f"Repository does not exist: {repo}")

    print(f"Scanning documentation in: {repo}")

    documents = discover_documentation(repo)

    print(f"Found {len(documents)} documentation files.")

    if not documents:
        output = {
            "agent": "documentation_consistency",
            "status": "completed",
            "sources_checked": [],
            "findings": [],
        }

        Path(output_path).write_text(
            json.dumps(output, indent=2),
            encoding="utf-8",
        )

        return

    llm = get_llm()

    # -------------------------------------------------------
    # Extract claims (parallelized across files)
    # -------------------------------------------------------

    all_claims = {}

    def process_doc(document_path):
        document = read_document(document_path, repo)
        claims = extract_claims(llm, document)
        return document["file"], claims

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(process_doc, dp): dp for dp in documents}
        for future in as_completed(futures):
            filename, claims = future.result()
            all_claims[filename] = claims
            print(f"Read {filename}: {len(claims)} checkable claims.")

    # -------------------------------------------------------
    # Compare documentation sources (parallelized across pairs)
    # -------------------------------------------------------

    findings = []
    document_names = list(all_claims.keys())
    pairs = [
        (document_names[i], document_names[j])
        for i in range(len(document_names))
        for j in range(i + 1, len(document_names))
    ]

    def compare_pair(pair):
        file_a, file_b = pair
        contradictions = compare_claim_groups(llm, all_claims[file_a], all_claims[file_b])
        return file_a, file_b, contradictions

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(compare_pair, p): p for p in pairs}
        for future in as_completed(futures):
            file_a, file_b, contradictions = future.result()
            print(f"Compared {file_a} <-> {file_b}: {len(contradictions)} finding(s)")

            for contradiction in contradictions:

                finding_id = f"DC-{len(findings) + 1:03d}"

                finding = {
                    "finding_id": finding_id,
                    "topic": contradiction.get("topic", ""),
                    "claim_a": contradiction.get("claim_a", ""),
                    "source_a": file_a,
                    "location_a": contradiction.get("location_a", ""),
                    "claim_b": contradiction.get("claim_b", ""),
                    "source_b": file_b,
                    "location_b": contradiction.get("location_b", ""),
                    "severity": contradiction.get(
                        "severity",
                        "medium"
                    ),
                    "explanation": contradiction.get(
                        "explanation",
                        ""
                    ),
                }

                findings.append(finding)

    # -------------------------------------------------------
    # Remove duplicate findings
    # -------------------------------------------------------

    unique_findings = []

    seen = set()

    for finding in findings:

        key = (
            finding["claim_a"].strip().lower(),
            finding["claim_b"].strip().lower(),
            finding["source_a"],
            finding["source_b"],
        )

        reverse_key = (
            finding["claim_b"].strip().lower(),
            finding["claim_a"].strip().lower(),
            finding["source_b"],
            finding["source_a"],
        )

        if key in seen or reverse_key in seen:
            continue

        seen.add(key)
        unique_findings.append(finding)

    # -------------------------------------------------------
    # Final output
    # -------------------------------------------------------

    output = {
        "agent": "documentation_consistency",
        "status": "completed",
        "sources_checked": document_names,
        "findings": unique_findings,
    }

    Path(output_path).write_text(
        json.dumps(output, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print()
    print("Documentation Consistency Agent completed.")
    print(f"Sources checked: {len(document_names)}")
    print(f"Findings: {len(unique_findings)}")
    print(f"Output: {output_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description="Documentation Consistency Agent"
    )

    parser.add_argument(
        "--repo",
        required=True,
        help="Path to target repository",
    )

    parser.add_argument(
        "--out",
        default="documentation_consistency.json",
        help="Output JSON file",
    )

    args = parser.parse_args()

    run_agent(
        args.repo,
        args.out,
    )