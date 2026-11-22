# 🛡️ Bob Guardian

### Catching AI context drift before it becomes a bug

**Team:** Bob the Repo  
**Built for:** IBM Bob 2.0 Hackathon 2026

Bob Guardian audits what an AI coding agent believes about a codebase against what is actually true in the code. It detects stale documentation, conflicting context, unsupported claims, and contradictions before they silently influence future development work.

---

## The Problem

AI coding agents such as IBM Bob can use persistent project context, including `AGENTS.md` and `README.md`, to understand a repository.

But code changes constantly, and documentation does not always change with it.

This creates **context drift**.

For example:

```text
Documentation
"The backend server runs on port 9090."

              ↓

Actual Code
"The backend server runs on port 8080."
```

An AI coding agent relying on the outdated information could make future decisions based on an incorrect understanding of the project.

The problem is especially difficult because the AI can still produce confident and technically plausible output.

**Bob Guardian is designed to identify these mismatches before they become downstream development problems.**

---

# The Solution

Bob Guardian is a multi agent auditing system that compares project documentation, persistent context, and actual source code.

Instead of only asking:

> Is the code correct?

Bob Guardian asks:

> **Is what the AI believes about this codebase still true?**

The system uses **five specialized agents**.

---

## 1. Context Auditor

The Context Auditor reads project documentation and context files and extracts checkable claims about the system.

For example:

```text
"The backend runs on port 9090."
```

The claims are converted into structured statements that can later be compared against evidence from the actual codebase.

---

## 2. Code Reality Agent

The Code Reality Agent analyzes source code and extracts facts about what the application actually does.

This creates a representation of **code reality** that can be compared against claims extracted from documentation.

---

## 3. Documentation Consistency Agent

The Documentation Consistency Agent compares documentation files against each other.

It can identify situations where different project documents provide conflicting information.

For example:

```text
README.md
        ↓
     says X

AGENTS.md
        ↓
     says Y
```

This helps identify inconsistencies within the project's own documentation and context.

---

## 4. Evidence Agent

The Evidence Agent searches the repository for evidence related to detected documentation findings.

This makes findings easier to investigate by connecting them to supporting or contradicting repository evidence rather than relying only on an AI generated judgment.

---

## 5. Contradiction Agent

The Contradiction Agent compares extracted documentation claims with facts derived from the source code.

Semantic embeddings help identify relevant claim and fact pairs.

The agent can then classify their relationship as:

```text
AGREE

CONTRADICT

UNVERIFIABLE
```

The resulting findings help developers identify where project context may no longer accurately represent the implementation.

---

# How Bob Guardian Works

```text
                 PROJECT REPOSITORY
                        │
            ┌───────────┴───────────┐
            │                       │
      Documentation              Source Code
            │                       │
            ▼                       ▼
     Context Auditor        Code Reality Agent
            │                       │
            └───────────┬───────────┘
                        │
                        ▼
               Contradiction Agent
                        │
                        ▼
                 Audit Findings


          Documentation Files
                   │
                   ▼
      Documentation Consistency
                   │
                   ▼
             Evidence Agent
                   │
                   ▼
          Evidence Backed Findings
```

---

# Reproducible Demo

Bob Guardian was tested using **Galaxium Travels** as the target application.

To make the demonstration reproducible, the project includes:

```text
agents/seed_demo_data.py
```

The seed script prepares an intentional test contradiction.

### Documentation Claim

```text
The backend server runs on port 9090.
```

### Code Reality

```text
The server runs on port 8080.
```

This gives Bob Guardian a known context mismatch to audit.

The important distinction is that the seed script creates the **test scenario**. It does not hardcode the contradiction agent's final judgment.

The auditing pipeline must still compare the information and identify the inconsistency.

This also avoids depending on a developer's existing local ChromaDB database when reproducing the demonstration.

---

# IBM Bob 2.0 Usage

IBM Bob IDE was used as a core part of the development process for Bob Guardian.

## Project Context

Bob `/init` was used with the project and demo environment to generate persistent `AGENTS.md` context.

This is particularly relevant to Bob Guardian because persistent project context is one of the types of information the project is designed to audit.

## Development and Code Review

Bob Agent mode was used during development to review code, identify implementation problems, and assist with debugging the agent pipeline.

## Debugging and Configuration

Bob was used while resolving development and integration issues and while configuring the local Ollama based environment.

## Performance Work

Bob was also used during work on improving the processing pipeline, including parallel processing and other performance related changes.

## Bob Usage Evidence

Relevant Bob task session summary screenshots are included in:

```text
bob_sessions/
```

These provide evidence of how IBM Bob was used during development.

---

# Technology

| Technology | Purpose |
|---|---|
| IBM Bob 2.0 | Core AI assisted development environment |
| Python | Agent implementation |
| Ollama | Local model runtime |
| Llama 3.1 | Local language model |
| Nomic Embed Text | Embedding model |
| ChromaDB | Persistent vector storage and semantic retrieval |
| LangChain Ollama | Integration with locally running Ollama models |

The default configuration uses local Ollama models and does not require an external LLM API key.

---

# Repository Structure

```text
bob-guardian/
│
├── agents/
│   ├── context_auditor.py
│   ├── code_reality_agent.py
│   ├── documentation_consistency.py
│   ├── evidence_agent.py
│   ├── contradiction_agent.py
│   ├── seed_demo_data.py
│   └── shared_config.py
│
├── bob_sessions/
│   └── Bob task session summary screenshots
│
├── demo_outputs/
│   ├── claims.json
│   ├── reality.json
│   └── findings.json
│
├── AGENTS.md
├── README.md
├── Requirements.txt
└── .gitignore
```

Generated Python cache files, local ChromaDB storage, environment files, and local test data are excluded through `.gitignore`.

---

# Setup

## 1. Clone the Project

Clone the Bob Guardian repository and open the project directory.

## 2. Create a Virtual Environment

### Windows PowerShell

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### Mac or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

## 3. Install Dependencies

```bash
pip install -r Requirements.txt
```

## 4. Install Ollama

Install Ollama and make sure the local service is running.

Pull the two models used by Bob Guardian:

```bash
ollama pull llama3.1
ollama pull nomic-embed-text
```

The default configuration uses:

```text
LLM: llama3.1
Embedding Model: nomic-embed-text
```

These values can also be changed using the optional environment variables defined in `shared_config.py`.

---

# Running the Demo

Move into the agents directory:

```bash
cd agents
```

## Seed the Reproducible Demo

```bash
python seed_demo_data.py
```

This prepares the intentional demo scenario used to test contradiction detection.

## Documentation Consistency Check

The Documentation Consistency Agent can be run against a target repository with:

```bash
python documentation_consistency.py --repo <TARGET_REPOSITORY> --out documentation_consistency.json
```

The agent scans supported documentation files, extracts checkable claims, compares relevant document pairs, and writes its findings to JSON.

Additional example outputs from the Bob Guardian pipeline are available in:

```text
demo_outputs/
```

---

# Performance Tip

For larger repositories, Ollama can be configured to handle additional requests concurrently.

### Windows PowerShell

```powershell
$env:OLLAMA_NUM_PARALLEL = "4"
```

### Mac or Linux

```bash
export OLLAMA_NUM_PARALLEL=4
```

Restart Ollama after changing the setting.

Bob Guardian can still run without this optional configuration, although processing time may differ depending on the repository and local hardware.

---

# Business Value

As AI coding agents take on more repository level development tasks, the quality of their decisions increasingly depends on the quality of the context they receive.

Stale or contradictory context can contribute to:

* Incorrect implementation assumptions
* Additional debugging
* Development rework
* Manual documentation verification
* Reduced confidence in AI assisted development

Bob Guardian adds a verification layer between **AI context and code reality**.

### Reduce Manual Verification

Developers can use automated auditing to help identify mismatches instead of manually comparing multiple context and documentation files against implementation details.

### Reduce Rework

Identifying outdated assumptions before they influence subsequent development can help reduce work based on incorrect project context.

### Improve Traceability

Evidence oriented findings make it easier for developers to investigate why a piece of project context may be unreliable.

### Support Growing Codebases

As repositories grow, keeping every piece of documentation synchronized with implementation becomes increasingly difficult. Bob Guardian provides a structured way to audit that relationship.

---

# Originality

Traditional developer tooling generally focuses on questions such as:

> **Is the code correct?**

Bob Guardian focuses on a different layer:

> **Is the AI's understanding of the codebase correct?**

The project does not replace conventional code review or testing.

Instead, it audits the **context and knowledge layer used by AI coding agents**.

By comparing documentation claims with actual implementation evidence, Bob Guardian focuses on the gap between:

```text
WHAT THE AI BELIEVES

          VS

WHAT THE CODE ACTUALLY DOES
```

That is the core idea behind Bob Guardian.

---

# Hackathon Evidence

Bob task session summary screenshots are stored in:

```text
bob_sessions/
```

The repository also contains example outputs from the tested pipeline in:

```text
demo_outputs/
```

---

# Team

## Bob the Repo

**Project:** Bob Guardian  
**Hackathon:** IBM Bob 2.0 Hackathon 2026

### Our Goal

**Keep an AI coding agent's understanding of a repository as reliable as the code itself.**
