# Bob-guardian
Bob Guardian audits what Bob believes about your codebase against what's actually true, catching stale docs and context drift before they cause silent bugs.
## Performance tip (optional)

For faster processing on larger repos, set this before running the agents:

    $env:OLLAMA_NUM_PARALLEL = "4"     # Windows PowerShell
    export OLLAMA_NUM_PARALLEL=4       # Mac/Linux

Then restart Ollama (`ollama serve`) so the setting takes effect.
Without this, the agents still work, just processed sequentially.