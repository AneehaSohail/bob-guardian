# Plan Mode — Architecture Rules

This file provides guidance to agents when working with code in this repository.

## Status

No architecture exists yet. This file should be updated once the stack and component boundaries are defined.

## Design Constraints to Keep in Mind

- The core function is diffing Bob's internal beliefs (e.g., AGENTS.md, context files) against the actual codebase state.
- The system must be non-destructive — auditing only, no automatic writes to codebase files without explicit user confirmation.
