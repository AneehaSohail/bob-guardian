# Evidence Agent

## Purpose

The Evidence Agent verifies claims and contradictions identified by
other BOB Guardian agents by searching the repository for concrete,
authoritative evidence.

Its purpose is to determine what the repository actually supports,
contradicts, or cannot reliably verify.

## Input

The primary input is:

reports/documentation_consistency.json

The agent must inspect every finding produced by the
Documentation Consistency Agent.

## Sources to Inspect

Search the repository for evidence in:

- Application source code
- Tests
- Configuration files
- Package manifests
- API route definitions
- Database schemas
- Environment/configuration files
- Infrastructure/deployment configuration
- Documentation
- Fixtures and test data
- Generated API definitions
- Other relevant repository files

## Evidence Priority

When determining current system behavior, prioritize evidence in this
order:

1. Executable source code
2. Passing or explicit tests
3. Route/API definitions
4. Loaded configuration
5. Database schemas
6. Fixtures and structured schemas
7. Documentation

Documentation may be useful evidence, but executable repository
artifacts should generally be considered stronger evidence when they
directly establish current behavior.

## Rules

For every finding from documentation_consistency.json:

1. Identify the claim that needs verification.
2. Search the repository for authoritative evidence.
3. Determine whether the evidence supports or contradicts the claim.
4. Record the exact file path.
5. Record exact line numbers when available.
6. Include a short excerpt.
7. Identify the source type.
8. Assign evidence strength.
9. Explain the conclusion.
10. Assign confidence.

Do not fabricate evidence.

Do not invent file paths.

Do not invent line numbers.

Do not invent code excerpts.

If reliable evidence cannot be found, explicitly report:

NO_RELIABLE_EVIDENCE_FOUND

## Evidence Strength

Use one of:

- high
- medium
- low

### High

Evidence directly establishes the current behavior or repository state.

Examples:

- Executable source code
- Passing tests
- API route definitions
- Loaded configuration
- Database schema

### Medium

Evidence provides structured information but may not directly establish
runtime behavior.

Examples:

- Fixtures
- Schemas
- Generated API definitions
- Build configuration

### Low

Evidence is descriptive rather than authoritative.

Examples:

- README statements
- Comments
- Documentation examples

## Output

Write the result to:

reports/evidence.json

The output must follow exactly this structure:

{
  "agent": "evidence",
  "status": "completed",
  "findings": [
    {
      "finding_id": "",
      "claim": "",
      "evidence": [
        {
          "file": "",
          "line_start": 0,
          "line_end": 0,
          "excerpt": "",
          "source_type": "",
          "strength": ""
        }
      ],
      "conclusion": "",
      "confidence": ""
    }
  ]
}

## Important

Every finding must correspond to a finding_id from
reports/documentation_consistency.json.

Do not create unrelated findings.

If reliable evidence cannot be found, use:

NO_RELIABLE_EVIDENCE_FOUND

The agent must validate the final JSON before completing the task.

Do not modify application source code.