# Smolten 🌋

_A delightfully cute `smolagents`-backed agent that auto-tags your CSV files with molten precision!_

---

`smolten` is a command-line tool that brings the magic of AI tagging to your CSV data. With adorable lava-themed messages and powerful smolagents backend, it generates intelligent tag ontologies and applies them to your data with style.

## ✨ Features

- 🌋 **Two-phase tagging**: Generates custom ontologies, then tags your data
- 🔥 **Multi-provider support**: Works with Ollama (local), OpenAI, Anthropic, and HuggingFace
- 🍯 **Smart sampling**: Handles large CSVs by intelligently sampling data
- 💫 **Multiple tags per row**: Supports comma-separated tags for complex categorization  
- 🛡️ **Overwrite protection**: Warns before replacing existing files
- 📁 **Organized output**: Saves ontologies alongside your data for easy project management
- ✨ **Adorable logging**: Cute molten-themed progress messages that make CSV processing fun

## 🚀 Quick Start

### Installation
```bash
npm install -g smolten
```

### First Run Setup
```bash
# Configure your model provider and preferences
smolten config

# Check if everything is ready
smolten check

# Tag your first CSV
smolten data.csv tagged-data.csv
```

## 📖 Usage

```bash
smolten tag <input.csv> <output.csv> [options]
```

### Options

- `-c, --columns <columns>` - Focus on specific columns (comma-separated)
- `-o, --ontology <file>` - Use existing ontology file
- `-m, --model <provider/model>` - Override configured model (e.g., "ollama/llama2")
- `-t, --tag-count <number>` - Number of tags to generate (default: 10)
- `--skip-ontology` - Skip ontology generation, use existing only
- `--sample-size <number>` - Rows to sample for analysis (default: 1000)
- `--auto-setup` - Automatically set up Python environment if needed
- `--log-level <level>` - Technical log verbosity (default: error)

### Commands

- `smolten config` - Configure model provider and preferences
- `smolten setup` - Set up Python environment for smolagents
- `smolten check` - Verify environment status
- `smolten tag` - Tag CSV files (main command)

### Examples

```bash
# Basic usage (will prompt for configuration on first run)
smolten tag customer-data.csv customer-data-tagged.csv

# Focus on specific columns with more tags
smolten tag data.csv tagged.csv -c "title,description,category" -t 20

# Use existing ontology
smolten tag data.csv tagged.csv -o my-ontology.json --skip-ontology

# Override model for this run
smolten tag data.csv tagged.csv -m "openai/gpt-4"
```

## 🔧 Configuration

On first run, smolten will guide you through configuration:

1. **Model Provider**: Choose from Ollama (local), OpenAI, Anthropic, or HuggingFace
2. **Model Name**: Specify which model to use
3. **API Key**: Provide API key for cloud providers
4. **Defaults**: Set preferred tag count and sample size

Configuration is saved to `.env` and can be reconfigured anytime with `smolten config`.

## 📁 File Organization

Smolten keeps your project organized:

```
your-project/
├── data.csv                           # Your input data
├── data-tagged.csv                    # Tagged output
└── data-tagged-ontology-2025-08-17.json  # Generated ontology
```

## 🏷️ Tag Format

Tags are generated in lowercase with hyphens (e.g., `customer-service`, `billing-issue`, `urgent-request`) for consistency and readability.

## 🎯 How It Works

1. **🌋 Ontology Generation**: Analyzes your CSV structure and content to create meaningful tag categories
2. **🔍 Review Phase**: Optionally review the generated ontology before tagging
3. **🍯 Tagging**: Applies tags to each row using the ontology as guidance
4. **💎 Output**: Saves tagged CSV with `smolten_tag` column containing comma-separated tags

## ⚠️ Requirements

- **Node.js** v24+ 
- **Python** 3.8+ (automatically set up on first run)
- **Model Access**: Local Ollama installation or API keys for cloud providers

## 🚨 Development Status

⚠️ **Beta - Known Issues** - Core functionality implemented but requires fixes before production use.

### Current Issues
- 🐛 Import errors in Python agents affecting runtime stability
- 🔧 Configuration inconsistencies between Node.js and Python components  
- ⚡ Missing error handling for malformed CSV/JSON files
- 🔒 Potential security issue with string injection in tagging templates

### Recent Fixes
- ✅ Fixed missing `join` import in csv-processor.js
- ✅ Fixed `userOutput` vs `cliOutput` inconsistency in cli.js
- ✅ Added missing `DEFAULTS` import in utils.js

### Next Steps
See `TODOS.md` for detailed issue tracking and completion roadmap.
