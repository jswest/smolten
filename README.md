# Smolten

_A `smolagents`-backed agent that auto-tags a CSV._

---

`smolten` runs in a Terminal window. Pass it a CSV and a list of column names--and an optional ontology, and it will, first, recommend additional tags for your ontology and, second, actually tag each of the entries in the CSV.

## Installation

```bash
npm install -g smolten
```

## Usage

```bash
smolten <input.csv> <output.csv> [options]
```

### Options

- `-c, --columns <columns>` - Comma-separated list of relevant columns to focus on
- `-o, --ontology <file>` - Existing ontology file path  
- `-m, --model <provider/model>` - Model provider and name (e.g., "ollama/gpt-oss:20b" or "openai/gpt-4")
- `-t, --tag-count <number>` - Rough number of tags for ontology generation (default: 10)
- `--skip-ontology` - Skip ontology generation and use existing ontology
- `--sample-size <number>` - Number of rows to sample for ontology generation (default: 1000)
- `--log-level <level>` - Log level (error, warn, info, debug) (default: info)

### Examples

```bash
# Basic usage with default local model
smolten data.csv tagged-data.csv

# Focus on specific columns with custom tag count
smolten data.csv tagged-data.csv -c "name,description,category" -t 15

# Use existing ontology
smolten data.csv tagged-data.csv -o my-ontology.json --skip-ontology

# Use OpenAI model
smolten data.csv tagged-data.csv -m "openai/gpt-4"
```

## Status

🚧 **In Development** - Basic CLI structure complete, smolagents integration in progress.
