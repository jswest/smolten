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

### Phase 1: Project Setup
- [ ] Initialize Node.js project with package.json and dependencies
- [ ] Set up basic CLI structure with argument parsing
- [ ] Integrate pino logging to file and console

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
├── package.json
├── src/
│   ├── cli.js (main CLI entry)
│   ├── logger.js (pino setup)
│   └── agents/
│       ├── ontology-generator.py
│       └── tagger.py
├── logs/
└── README.md
```

### CLI Interface
```bash
smolten <input.csv> <output.csv> [options]
  --columns <list>     Relevant columns to focus on
  --ontology <file>    Existing ontology file
  --model <provider>   Model provider (ollama:model-name or openai:gpt-4)
  --tags <number>      Rough number of tags for ontology generation
```