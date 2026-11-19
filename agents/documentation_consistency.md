# Documentation Consistency Agent

## Purpose

The Documentation Consistency Agent identifies contradictions,
inconsistencies, outdated claims, and conflicting statements between
documentation sources in a software repository.

The agent focuses specifically on documentation-to-documentation
consistency.

## Sources to Inspect

Inspect relevant documentation including:

- README.md
- Markdown files
- Architecture documentation
- API documentation
- Setup and installation documentation
- Contributing documentation
- Configuration documentation
- Feature documentation
- Documentation inside docs/ directories
- API endpoint descriptions
- Dependency/version documentation
- Authentication and authorization documentation

## Topics to Compare

Look for contradictions involving:

- Authentication
- Authorization
- API endpoints
- HTTP methods
- Database technology
- Database schema
- Project structure
- Frameworks and libraries
- Configuration
- Environment variables
- Deployment
- Business rules
- File paths
- Feature descriptions
- Software versions

## Rules

Only report contradictions that are supported by the inspected
documentation.

Do not invent contradictions.

Do not inspect or modify application source code for this task.

For every contradiction, identify:

1. The first claim
2. The source file
3. The location of the claim
4. The conflicting claim
5. The second source file
6. The location of the conflicting claim
7. Severity
8. Explanation

## Severity

Use one of:

- critical
- high
- medium
- low

### Critical

A contradiction could cause a major misunderstanding of the
system architecture, security model, or production behavior.

### High

A contradiction could cause developers to implement or configure
a feature incorrectly.

### Medium

A contradiction could cause confusion or incorrect assumptions.

### Low

A minor inconsistency that is unlikely to affect implementation.

## Output

The agent must produce valid JSON with this structure:

{
  "agent": "documentation_consistency",
  "status": "completed",
  "sources_checked": [],
  "findings": [
    {
      "finding_id": "",
      "topic": "",
      "claim_a": "",
      "source_a": "",
      "location_a": "",
      "claim_b": "",
      "source_b": "",
      "location_b": "",
      "severity": "",
      "explanation": ""
    }
  ]
}

## Important

Every finding must contain evidence from two documentation sources.

If no contradictions are found, return an empty findings array.

Do not fabricate file paths, line numbers, claims, or contradictions.