"""
Shared config + client setup for Bob Guardian agents.

Both context_auditor.py and code_reality_agent.py import from here so the
whole team uses the same LLM client, embedding model, and output schema.

Uses Ollama (local). Before running any agent:
    1. Install Ollama: https://ollama.com/download
    2. Pull the models:
         ollama pull llama3.1
         ollama pull nomic-embed-text
    3. Ollama runs a local server automatically, nothing else to configure.

Optional environment variables (only needed if you change model names or
run Ollama on a non-default host):
    OLLAMA_MODEL              (defaults to "llama3.1")
    OLLAMA_EMBED_MODEL        (defaults to "nomic-embed-text")
    OLLAMA_BASE_URL           (defaults to "http://localhost:11434")
"""

import os
import json
import uuid
from dataclasses import dataclass, asdict, field
from typing import Literal

from langchain_ollama import ChatOllama, OllamaEmbeddings
import chromadb

# ---------------------------------------------------------------------------
# LLM + embedding clients (shared across agents)
# ---------------------------------------------------------------------------

def get_llm(temperature: float = 0.0) -> ChatOllama:
    """Chat model used to extract claims/facts from text. Runs locally
    via Ollama, no API key needed."""
    return ChatOllama(
        model=os.environ.get("OLLAMA_MODEL", "llama3.1"),
        base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
        temperature=temperature,
    )


def get_embeddings() -> OllamaEmbeddings:
    """Embedding model used to store claims/facts in ChromaDB. Runs
    locally via Ollama, no API key needed."""
    return OllamaEmbeddings(
        model=os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text"),
        base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
    )


def get_chroma_client(persist_dir: str = "./chroma_store") -> chromadb.PersistentClient:
    """Single shared ChromaDB instance. Both agents write to different
    collections inside the same store so the contradiction agent can
    query across both later."""
    return chromadb.PersistentClient(path=persist_dir)


# ---------------------------------------------------------------------------
# Shared output schema
# ---------------------------------------------------------------------------
# This is the data format the whole team agreed on. Both agents produce
# records in this shape so the evidence + contradiction agents (Person B's
# side) can consume either one without caring which agent produced it.

@dataclass
class Statement:
    id: str
    type: Literal["claim", "fact"]      # "claim" = from docs, "fact" = from code
    subject: str                        # short topic, e.g. "auth flow", "/login endpoint"
    statement: str                      # the actual extracted statement text
    source_file: str                    # relative file path
    source_location: str                # line number, function name, or heading
    raw_excerpt: str = ""               # the original text/code this came from

    @staticmethod
    def new(**kwargs) -> "Statement":
        kwargs.setdefault("id", str(uuid.uuid4())[:8])
        return Statement(**kwargs)


def save_statements(statements: list[Statement], out_path: str) -> None:
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump([asdict(s) for s in statements], f, indent=2)
    print(f"Saved {len(statements)} statements to {out_path}")