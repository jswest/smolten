# Smolten Implementation Plan

## Architecture Overview
- **Node.js CLI** with argument parsing for CSV input/output paths, column selection, and ontology
- **Two-mode operation**: Ontology generation → User approval → Tagging
- **Model flexibility**: Support both local Ollama models and frontier providers
- **smolagents backend**: Python agent for AI-powered tagging logic
- **Logging**: Pino for structured logging to file and console

## Key Technical Decisions
1. **Hybrid approach**: Node.js CLI wrapper calling Python smolagents backend
2. **CSV handling**: Use pandas in smolagents for efficient data processing
3. **Sampling strategy**: Random sampling for large files in ontology generation
4. **User interaction**: CLI prompts for tag count and ontology approval
5. **Model providers**: LiteLLM integration for unified provider access

## Implementation Tasks

### Phase 1: Project Setup ✅
- [x] Initialize Node.js project with package.json and dependencies
- [x] Set up basic CLI structure with argument parsing
- [x] Integrate pino logging to file and console

### Phase 2: Model Integration
- [ ] Implement model provider selection (Ollama local vs frontier providers)
- [ ] Set up smolagents backend integration

### Phase 3: CSV Processing
- [ ] Implement CSV reading and sampling functionality
- [ ] Build ontology generation mode with user interaction
- [ ] Build tagging mode with row-by-row processing
- [ ] Implement CSV output with new tagged data

### Phase 4: Polish
- [ ] Add error handling and validation

## Technical Notes

### Dependencies
- **Node.js**: commander (CLI), pino (logging), csv-parser (CSV handling)
- **Python**: smolagents, pandas, litellm (model providers)

### File Structure
```
smolten/
│—— agents/
│   ├── ontology-generator.py
│   └── tagger.py
├── lib/
│   ├── cli.js (main CLI entry)
│   └── logger.js (pino setup)
├── logs/
├── .gitignore
├── .venv
├── CLAUDE.md
├── index.js (the main script, which passes off to `lib/cli.js`)
├── package.json
├── package-lock.json
├── README.md
├── requirements.txt
└── TODOS.md
```

### CLI Interface
```bash
smolten <input.csv> <output.csv> [options]
  -c, --columns <columns>        Comma-separated list of relevant columns to focus on
  -o, --ontology <file>          Existing ontology file path
  -m, --model <provider/model>   Model provider and name (e.g., "ollama/llama2" or "openai/gpt-4")
  -t, --tag-count <number>       Rough number of tags for ontology generation (default: 10)
  --skip-ontology               Skip ontology generation and use existing ontology
  --sample-size <number>        Number of rows to sample for ontology generation (default: 1000)
  --log-level <level>           Log level (error, warn, info, debug) (default: info)
```