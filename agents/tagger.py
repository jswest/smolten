#!/usr/bin/env python3
import argparse
import json
import os
import sys
import logging

# Suppress external library logging completely
logging.getLogger("litellm").setLevel(logging.ERROR)
logging.getLogger("smolagents").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.ERROR)
logging.getLogger("openai").setLevel(logging.ERROR)

import litellm
from smolagents import (
  CodeAgent,
  FinalAnswerTool,
  LiteLLMModel,
  PythonInterpreterTool
)

# Suppress litellm logging
litellm.suppress_debug_info = True
litellm.set_verbose = False

# Provider configuration mapping
PROVIDER_CONFIG = {
    "ollama": {
        "api_base": "http://localhost:11434/v1",
        "api_key": "ollama",
        "custom_llm_provider": "openai"
    },
    "openai": {
        "api_base": "https://api.openai.com/v1",
        "api_key": os.getenv("OPENAI_API_KEY"),
        "custom_llm_provider": None
    },
    "anthropic": {
        "api_base": "https://api.anthropic.com",
        "api_key": os.getenv("ANTHROPIC_API_KEY"),
        "custom_llm_provider": None
    },
    "huggingface": {
        "api_base": "https://api-inference.huggingface.co",
        "api_key": os.getenv("HUGGINGFACE_API_KEY"),
        "custom_llm_provider": None
    }
}

# Only enable debug for development
if os.getenv("SMOLTEN_DEBUG"):
    litellm._turn_on_debug()


from shared import format_token_count, progress, lava, load_prompt

def main():
    p = argparse.ArgumentParser(description="General CSV row tagger with editorial judgment (smolagents, 1 pass)")
    p.add_argument("csv_path")
    p.add_argument("ontology_path")
    p.add_argument("output_path")
    p.add_argument("--model", default=os.getenv("SMOL_MODEL", "gpt-oss:20b"))
    p.add_argument("--api-base", default=os.getenv("SMOL_API_BASE", "http://localhost:11434/v1"))
    p.add_argument("--api-key",  default=os.getenv("SMOL_API_KEY", "ollama"))
    p.add_argument("--provider", default=os.getenv("SMOL_PROVIDER", "openai"))
    p.add_argument("--sample-size", type=int, default=1000)
    p.add_argument("--max-steps", type=int, default=4)
    args = p.parse_args()

    with open(args.ontology_path, "r", encoding="utf-8") as ontology_file:
        ontology = json.load(ontology_file)
    ontology_string = json.dumps(ontology["ontology"], ensure_ascii=False, separators=(",", ":"))

    # Get provider configuration
    if args.provider not in PROVIDER_CONFIG:
        print(f"❌ Unsupported provider: {args.provider}", file=sys.stderr)
        sys.exit(1)
    
    config = PROVIDER_CONFIG[args.provider]
    api_key = config["api_key"] or os.getenv("SMOLTEN_API_KEY")
    
    if args.provider != "ollama" and not api_key:
        print(f"❌ API key required for {args.provider}", file=sys.stderr)
        sys.exit(1)
    
    llm_kwargs = {
        "model_id": args.model,
        "api_base": config["api_base"],
        "api_key": api_key,
    }
    
    if config["custom_llm_provider"]:
        llm_kwargs["custom_llm_provider"] = config["custom_llm_provider"]
    
    llm = LiteLLMModel(**llm_kwargs)

    py = PythonInterpreterTool(
        authorized_imports=["pandas","json","re","math","statistics","itertools","collections","datetime"],
        description="Run short Python snippets."
    )

    # Load system prompt
    MIN_SYSTEM = load_prompt("tagging_system.md")

    agent = CodeAgent(
        tools=[py, FinalAnswerTool()],
        model=llm,
        add_base_tools=False,
        instructions=MIN_SYSTEM,
        verbosity_level=2,
        additional_authorized_imports=[
            "pandas",
            "json",
            "re",
            "math",
            "statistics",
            "itertools",
            "collections",
            "datetime"
        ],
    )

    # Load task prompt and format with parameters
    task_template = load_prompt("tagging_task.md")
    TASK = task_template.format(
        ontology_string=ontology_string,
        csv_path=args.csv_path,
        sample_size=args.sample_size,
        output_path=args.output_path
    )

    progress("starting editorial tagging", "status")
    
    try:
        run_result = agent.run(TASK, max_steps=args.max_steps)
    except Exception as e:
        print(f"❌ Error during tagging: {e}", file=sys.stderr)
        sys.exit(1)
    
    progress("tagging complete", "complete", emoji="💎")
    # Summary is handled by Node.js side
    pass

if __name__ == "__main__":
    main()
