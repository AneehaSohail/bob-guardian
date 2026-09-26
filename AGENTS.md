# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Status

This repository is in early scaffolding stage — currently only a `README.md` exists. No source code, build system, package manager, or configuration files are present yet.

**Branch:** active development is on `feature/b-agents`; `main` is identical.

## Project Purpose

Bob Guardian audits what Bob (IBM Bob) believes about a codebase against what is actually true, catching stale docs and context drift before they cause silent bugs.

## Commands

No build, test, lint, or run commands exist yet (no `package.json`, `Makefile`, `pyproject.toml`, or equivalent found).

## Notes for Agents

- Do not assume any framework, language, or toolchain — none has been established.
- When the stack is chosen, update this file with build/test/lint commands and code style rules.
- The `.bob/rules-agent/`, `.bob/rules-ask/`, and `.bob/rules-plan/` directories contain mode-specific guidance.
