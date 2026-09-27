"""
Evidence Agent

Purpose:
    Verifies findings produced by the Documentation Consistency Agent
    by searching the repository for concrete evidence.

Input:
    documentation_consistency.json

Output:
    evidence.json

The agent prioritizes evidence in this order:

1. Executable source code
2. Tests
3. API/route definitions
4. Configuration
5. Database schemas
6. Fixtures / structured data
7. Documentation
"""

import argparse
import json
import re
from pathlib import Path
from typing import List, Dict, Any

from shared_config import get_llm


# ---------------------------------------------------------------------------
# Repository configuration
# ---------------------------------------------------------------------------

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


SOURCE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".go",
    ".c",
    ".cpp",
    ".cs",
    ".php",
    ".rb",
    ".rs",
    ".sql",
    ".yaml",
    ".yml",
    ".json",
    ".toml",
    ".ini",
    ".env",
    ".md",
    ".markdown",
}


# ---------------------------------------------------------------------------
# JSON helper
# ---------------------------------------------------------------------------

def extract_json(text: str):
    """Extract JSON from an LLM response."""

    text = text.strip()

    text = re.sub(
        r"^```(?:json)?",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(
        r"```$",
        "",
        text,
    ).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    object_match = re.search(
        r"\{.*\}",
        text,
        re.DOTALL,
    )

    if object_match:
        try:
            return json.loads(
                object_match.group(0)
            )
        except json.JSONDecodeError:
            pass

    return None


# ---------------------------------------------------------------------------
# Repository scanning
# ---------------------------------------------------------------------------

def should_skip(path: Path) -> bool:
    return any(
        part in SKIP_DIRECTORIES
        for part in path.parts
    )


def discover_files(repo_path: Path) -> List[Path]:

    files = []

    for path in repo_path.rglob("*"):

        if not path.is_file():
            continue

        if should_skip(path):
            continue

        if path.suffix.lower() in SOURCE_EXTENSIONS:
            files.append(path)

    return sorted(files)


# ---------------------------------------------------------------------------
# File reading
# ---------------------------------------------------------------------------

def read_file(path: Path, repo_path: Path) -> Dict[str, Any]:

    try:
        text = path.read_text(
            encoding="utf-8",
            errors="replace",
        )
    except Exception:
        return {
            "file": str(
                path.relative_to(repo_path)
            ),
            "text": "",
            "lines": [],
        }

    relative = path.relative_to(
        repo_path
    ).as_posix()

    return {
        "file": relative,
        "text": text,
        "lines": text.splitlines(),
    }


# ---------------------------------------------------------------------------
# Candidate evidence search
# ---------------------------------------------------------------------------

def find_candidate_evidence(
    claim: str,
    repository_files: List[Dict[str, Any]],
    max_files: int = 15,
) -> List[Dict[str, Any]]:
    """
    Find files that contain words related to the claim.

    This is deliberately simple and deterministic.
    The LLM performs the actual evidence evaluation later.
    """

    words = re.findall(
        r"[A-Za-z0-9_./:-]+",
        claim.lower(),
    )

    # Ignore extremely common words.
    stop_words = {
        "the",
        "and",
        "that",
        "this",
        "with",
        "from",
        "into",
        "there",
        "only",
        "uses",
        "using",
        "has",
        "have",
        "for",
        "are",
        "is",
        "a",
        "an",
        "of",
        "to",
        "in",
    }

    keywords = [
        word
        for word in words
        if len(word) >= 4
        and word not in stop_words
    ]

    if not keywords:
        return []

    scored = []

    for file_data in repository_files:

        text_lower = file_data["text"].lower()

        score = sum(
            text_lower.count(keyword)
            for keyword in keywords
        )

        if score > 0:
            scored.append(
                (
                    score,
                    file_data,
                )
            )

    scored.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    candidates = []

    for _, file_data in scored[:max_files]:

        candidates.append(file_data)

    return candidates


# ---------------------------------------------------------------------------
# Evidence extraction
# ---------------------------------------------------------------------------

def extract_relevant_lines(
    claim: str,
    file_data: Dict[str, Any],
    max_lines: int = 30,
) -> str:
    """
    Extract lines that contain keywords related to the claim.
    """

    words = re.findall(
        r"[A-Za-z0-9_./:-]+",
        claim.lower(),
    )

    keywords = [
        word
        for word in words
        if len(word) >= 4
    ]

    relevant = []

    for index, line in enumerate(
        file_data["lines"],
        start=1,
    ):

        lower_line = line.lower()

        if any(
            keyword in lower_line
            for keyword in keywords
        ):
            relevant.append(
                f"{index}: {line}"
            )

        if len(relevant) >= max_lines:
            break

    if not relevant:
        # If nothing matched, give the model a small amount of context.
        for index, line in enumerate(
            file_data["lines"][:20],
            start=1,
        ):
            relevant.append(
                f"{index}: {line}"
            )

    return "\n".join(relevant)


# ---------------------------------------------------------------------------
# Evidence evaluation
# ---------------------------------------------------------------------------

def evaluate_finding(
    llm,
    finding: Dict[str, Any],
    candidate_files: List[Dict[str, Any]],
    repo_path: Path,
) -> Dict[str, Any]:
    """
    Ask the LLM to determine whether repository evidence supports,
    contradicts, or cannot verify the documentation finding.
    """

    evidence_context = []

    for file_data in candidate_files:

        excerpt = extract_relevant_lines(
            finding.get("claim", ""),
            file_data,
        )

        evidence_context.append(
            {
                "file": file_data["file"],
                "excerpt": excerpt,
            }
        )

    prompt = f"""
You are the Evidence Agent for a software repository.

You are verifying a finding produced by the Documentation Consistency Agent.

The finding claims that two documentation statements contradict each other.

Your job is NOT to invent evidence.

Search the supplied repository evidence and determine whether there is
concrete evidence that supports or contradicts the finding.

Evidence priority:

1. Executable source code
2. Tests
3. API/route definitions
4. Loaded configuration
5. Database schemas
6. Fixtures / structured schemas
7. Documentation

Important rules:

- Never invent a file path.
- Never invent line numbers.
- Never invent an excerpt.
- Only use evidence supplied below.
- If the repository does not contain reliable evidence, say:
  NO_RELIABLE_EVIDENCE_FOUND
- Do not treat the documentation finding itself as proof.
- Be conservative.
- Evidence should directly relate to the claim.

Return ONLY valid JSON in this format:

{{
  "evidence": [
    {{
      "file": "",
      "line_start": 0,
      "line_end": 0,
      "excerpt": "",
      "source_type": "source|test|route|configuration|schema|fixture|documentation",
      "strength": "high|medium|low"
    }}
  ],
  "conclusion": "",
  "confidence": "high|medium|low"
}}

DOCUMENTATION FINDING:

{json.dumps(finding, indent=2)}

REPOSITORY EVIDENCE:

{json.dumps(evidence_context, indent=2)}

Remember:
If there is no reliable evidence, return:

{{
  "evidence": [],
  "conclusion": "NO_RELIABLE_EVIDENCE_FOUND",
  "confidence": "low"
}}
"""

    response = llm.invoke(prompt)

    result = extract_json(
        response.content
    )

    if not isinstance(result, dict):

        return {
            "evidence": [],
            "conclusion": "NO_RELIABLE_EVIDENCE_FOUND",
            "confidence": "low",
        }

    evidence = result.get(
        "evidence",
        [],
    )

    if not isinstance(evidence, list):
        evidence = []

    cleaned_evidence = []

    for item in evidence:

        if not isinstance(item, dict):
            continue

        file_path = str(
            item.get("file", "")
        ).strip()

        if not file_path:
            continue

        # -------------------------------------------------------
        # Validate that the LLM-selected file actually exists.
        # -------------------------------------------------------

        actual_file = (
            repo_path / file_path
        ).resolve()

        try:
            actual_file.relative_to(
                repo_path.resolve()
            )
        except ValueError:
            continue

        if not actual_file.exists():
            continue

        # -------------------------------------------------------
        # Validate line numbers against the actual file.
        # -------------------------------------------------------

        try:
            line_start = int(
                item.get(
                    "line_start",
                    0,
                )
            )

            line_end = int(
                item.get(
                    "line_end",
                    0,
                )
            )

        except (TypeError, ValueError):
            continue

        try:
            actual_lines = (
                actual_file.read_text(
                    encoding="utf-8",
                    errors="replace",
                ).splitlines()
            )

            total_lines = len(
                actual_lines
            )

        except Exception:
            continue

        if (
            line_start < 1
            or line_end < line_start
            or line_start > total_lines
        ):
            continue

        line_end = min(
            line_end,
            total_lines,
        )

        # IMPORTANT:
        # Reconstruct the excerpt from the actual repository
        # rather than trusting an LLM-generated excerpt.
        actual_excerpt = "\n".join(
            actual_lines[
                line_start - 1:line_end
            ]
        )

        cleaned_evidence.append(
            {
                "file": file_path,
                "line_start": line_start,
                "line_end": line_end,
                "excerpt": actual_excerpt,
                "source_type": item.get(
                    "source_type",
                    "documentation",
                ),
                "strength": item.get(
                    "strength",
                    "low",
                ),
            }
        )

    return {
        "evidence": cleaned_evidence,
        "conclusion": result.get(
            "conclusion",
            "NO_RELIABLE_EVIDENCE_FOUND",
        ),
        "confidence": result.get(
            "confidence",
            "low",
        ),
    }


# ---------------------------------------------------------------------------
# Main agent
# ---------------------------------------------------------------------------

def run_agent(
    repo_path: str,
    input_path: str,
    output_path: str,
):

    repo = Path(
        repo_path
    ).resolve()

    if not repo.exists():
        raise FileNotFoundError(
            f"Repository does not exist: {repo}"
        )

    input_file = Path(
        input_path
    ).resolve()

    if not input_file.exists():
        raise FileNotFoundError(
            f"Input file does not exist: {input_file}"
        )

    print(
        f"Loading findings from: {input_file}"
    )

    data = json.loads(
        input_file.read_text(
            encoding="utf-8"
        )
    )

    findings = data.get(
        "findings",
        [],
    )

    print(
        f"Found {len(findings)} documentation findings."
    )

    print(
        "Scanning repository for evidence..."
    )

    files = discover_files(repo)

    print(
        f"Repository files available: {len(files)}"
    )

    repository_files = []

    for path in files:

        file_data = read_file(
            path,
            repo,
        )

        if file_data["text"]:
            repository_files.append(
                file_data
            )

    llm = get_llm()

    output_findings = []

    # -------------------------------------------------------
    # Process each finding
    # -------------------------------------------------------

    for index, finding in enumerate(
        findings,
        start=1,
    ):

        finding_id = finding.get(
            "finding_id",
            f"DC-{index:03d}",
        )

        print(
            f"[{index}/{len(findings)}] "
            f"Checking {finding_id}"
        )

        # The documentation consistency agent has two claims.
        # For evidence purposes, we want to verify the actual
        # contradiction represented by those claims.

        combined_claim = (
            f"{finding.get('claim_a', '')} "
            f"{finding.get('claim_b', '')}"
        )

        candidate_files = (
            find_candidate_evidence(
                combined_claim,
                repository_files,
            )
        )

        # Also search separately for claim A and claim B.
        candidate_files_a = (
            find_candidate_evidence(
                finding.get("claim_a", ""),
                repository_files,
            )
        )

        candidate_files_b = (
            find_candidate_evidence(
                finding.get("claim_b", ""),
                repository_files,
            )
        )

        # Merge candidates without duplicates.
        candidate_map = {}

        for file_data in (
            candidate_files
            + candidate_files_a
            + candidate_files_b
        ):
            candidate_map[
                file_data["file"]
            ] = file_data

        candidate_files = list(
            candidate_map.values()
        )

        # ---------------------------------------------------
        # Adapt the finding to the Evidence Agent's schema.
        # ---------------------------------------------------

        evidence_input = {
            "finding_id": finding_id,
            "claim": (
                f"Claim A: {finding.get('claim_a', '')}\n"
                f"Claim B: {finding.get('claim_b', '')}"
            ),
            "source_a": finding.get(
                "source_a",
                "",
            ),
            "source_b": finding.get(
                "source_b",
                "",
            ),
            "location_a": finding.get(
                "location_a",
                "",
            ),
            "location_b": finding.get(
                "location_b",
                "",
            ),
        }

        result = evaluate_finding(
            llm,
            evidence_input,
            candidate_files,
            repo,
        )

        output_findings.append(
            {
                "finding_id": finding_id,
                "claim": evidence_input[
                    "claim"
                ],
                "evidence": result[
                    "evidence"
                ],
                "conclusion": result[
                    "conclusion"
                ],
                "confidence": result[
                    "confidence"
                ],
            }
        )

    # -------------------------------------------------------
    # Final output
    # -------------------------------------------------------

    output = {
        "agent": "evidence",
        "status": "completed",
        "findings": output_findings,
    }

    Path(output_path).write_text(
        json.dumps(
            output,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print()
    print("Evidence Agent completed.")
    print(
        f"Findings checked: {len(output_findings)}"
    )
    print(
        f"Output: {output_path}"
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description="Evidence Agent"
    )

    parser.add_argument(
        "--repo",
        required=True,
        help="Path to target repository",
    )

    parser.add_argument(
        "--findings",
        default="documentation_consistency.json",
        help="Documentation consistency JSON",
    )

    parser.add_argument(
        "--out",
        default="evidence.json",
        help="Evidence output JSON",
    )

    args = parser.parse_args()

    run_agent(
        args.repo,
        args.findings,
        args.out,
    )