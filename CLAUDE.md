# Project overview

`smolten` is a command-line agent. Its aim is to tag a CSV file. Users must pass a CSV file. The must pass a location to save the new CSV file. Optionally, they can pass a list of relevent columns. Users can also pass an ontology.

The agent has two modes:

1. **Ontology-generation**: The agent reads either the full CSV file or (depending on length) a random sample of the CSV and determines an ontology of tags. It asks the user for a rough number of tags, and then it asks the user to approve the ontology.
2. **Tagging**: The agent reads the CSV, row by row, and applies the ontology. It saves the file as a new CSV file.

## Specs

- Use Node v24.
- Be as simple as possible.
- Log with pino or similar to a log file and to console.
- Allow users to choose a local model via ollama (e.g., `gpt-oss:20b`) or a fronteir provider.
- Use `smolagents` from HuggingFace as the backend.

## Code Style Preferences

- Use double quotes for strings
- Group imports by category (standard library, third-party, local) with blank lines between
- Use forward slashes (/) as separators in CLI options (e.g., `ollama/gpt-oss:20b`)
- Use kebab-case for CLI option names (e.g., `--tag-count` not `--tags`)
- Use trailing commas in objects and arrays
- No newlines at end of files


