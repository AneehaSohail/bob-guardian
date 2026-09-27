"""
Seed Demo Data
----------------
Reproducibly inserts the demo claim/fact pair used to showcase the
contradiction agent, for cases where a target file is too large/slow for
local LLM extraction to complete reliably (see README "Known Limitations").

This replaces one-off terminal commands with a checked-in, rerunnable
script, so anyone cloning this repo gets the same demo result without
needing to manually patch ChromaDB themselves.

Usage:
    python seed_demo_data.py
"""

import json
import uuid

from shared_config import get_embeddings, get_chroma_client

DEMO_CLAIM = {
    "id": "demo_port_claim",
    "type": "claim",
    "subject": "server port",
    "statement": "The backend server runs on port 9090",
    "source_file": "AGENTS.md",
    "source_location": "Server Configuration section",
    "raw_excerpt": "The backend server runs on port 9090.",
}

DEMO_FACT = {
    "id": "demo_server_port_fact",
    "type": "fact",
    "subject": "server port",
    "statement": "The server runs on port 8080 via uvicorn.run(app, host=0.0.0.0, port=8080)",
    "source_file": "booking_system_backend/server.py",
    "source_location": "if __name__ == '__main__' block",
    "raw_excerpt": 'uvicorn.run(app, host="0.0.0.0", port=8080)',
}


def seed_json(path: str, entry: dict) -> None:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        data = []

    if not any(item.get("id") == entry["id"] for item in data):
        data.append(entry)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"{path}: {len(data)} entries (seed entry present)")


def seed_chroma(collection_name: str, entry: dict) -> None:
    embeddings = get_embeddings()
    client = get_chroma_client()
    collection = client.get_or_create_collection(collection_name)

    vector = embeddings.embed_documents([entry["statement"]])[0]
    collection.upsert(
        ids=[entry["id"]],
        embeddings=[vector],
        documents=[entry["statement"]],
        metadatas=[{
            "subject": entry["subject"],
            "source_file": entry["source_file"],
            "source_location": entry["source_location"],
        }],
    )
    print(f"ChromaDB '{collection_name}': seeded '{entry['id']}'")


if __name__ == "__main__":
    seed_json("claims.json", DEMO_CLAIM)
    seed_json("reality.json", DEMO_FACT)
    seed_chroma("context_claims", DEMO_CLAIM)
    seed_chroma("code_reality", DEMO_FACT)
    print("\nDemo data seeded. Run contradiction_agent.py next to reproduce the catch.")
