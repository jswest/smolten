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
  LiteLLMModel,
  PythonInterpreterTool,
  Tool
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

# MIN_SYSTEM will be loaded in main()


class FinalOntologyTool(Tool):
    name = "final_ontology"
    description = "Return the final tags-only JSON object (dict of name: description)."
    inputs = {
        "tags": {
            "type": "object",
            "description": "an object with keys that are the names of the tags and values that are the descriptions."
        },
        "notes": {
            "type": "string",
            "description": "Any notes about this ontology.",
            "nullable": True,
        }
    }
    output_type = "string"

    def forward(self, tags, notes=""):
        return json.dumps({"tags": tags, "notes": notes})


from shared import format_token_count, progress, lava, load_prompt


def main():
    p = argparse.ArgumentParser(description="Generate a tag ontology from a CSV using smolagents")
    p.add_argument("csv_path", help="Path to CSV")
    p.add_argument("output_path", help="Where to write ontology JSON")
    p.add_argument(
        "--model",
        default=os.getenv("SMOL_MODEL", "gpt-4o-mini"),
        help="litellm model id (e.g. gpt-4o-mini, anthropic/claude-3-5-sonnet, ollama/llama3.1)"
    )
    p.add_argument("--tag-count", type=int, default=10)
    p.add_argument("--sample-size", type=int, default=1000)
    p.add_argument("--columns", help="Comma-separated columns to prefer", default="")
    p.add_argument("--additional-prompt", type=str, default="")
    args = p.parse_args()

    if not os.path.exists(args.csv_path):
        print(f"❌ CSV not found: {args.csv_path}", file=sys.stderr); sys.exit(1)

    # Parse model provider and name
    if "/" in args.model:
        provider, model_name = args.model.split("/", 1)
    else:
        provider = "openai"  # Default provider
        model_name = args.model
    
    # Get provider configuration
    if provider not in PROVIDER_CONFIG:
        print(f"❌ Unsupported provider: {provider}", file=sys.stderr)
        sys.exit(1)
    
    config = PROVIDER_CONFIG[provider]
    api_key = config["api_key"] or os.getenv("SMOLTEN_API_KEY")
    
    if provider != "ollama" and not api_key:
        print(f"❌ API key required for {provider}", file=sys.stderr)
        sys.exit(1)
    
    progress("warming the lava pool", "status")
    
    # Load system prompt
    MIN_SYSTEM = load_prompt("ontology_system.md")
    
    llm_kwargs = {
        "model_id": model_name,
        "api_base": config["api_base"],
        "api_key": api_key,
    }
    
    if config["custom_llm_provider"]:
        llm_kwargs["custom_llm_provider"] = config["custom_llm_provider"]
    
    llm = LiteLLMModel(**llm_kwargs)

    py = PythonInterpreterTool(
        authorized_imports=["pandas", "json", "re", "itertools", "collections"],
        description="Run short Python snippets."
    )

    def on_step(_, agent=None):
        monitor = getattr(agent, "monitor", None)
        if not monitor:
            return

        if hasattr(monitor, "to_dict"):
            usage = monitor.to_dict()
        else:
            usage = {
                "input_tokens": getattr(monitor, "input_tokens", 0),
                "output_tokens": getattr(monitor, "output_tokens", 0),
                "cost": getattr(monitor, "cost", 0),
                "num_calls": getattr(monitor, "num_calls", 0),
            }
        progress_string = (
            f"In: {format_token_count(usage['input_tokens'])}; "
            f"Out: {format_token_count(usage['output_tokens'])}."
        )
        progress(progress_string)

    final_tool = FinalOntologyTool()
    agent = CodeAgent(
        tools=[py, final_tool],
        model=llm,
        instructions=MIN_SYSTEM,
        add_base_tools=False,
        max_steps=4,
        verbosity_level=0,
        step_callbacks=[on_step]
    )

    # Load task prompt and format with parameters
    cols_hint = [c.strip() for c in args.columns.split(",")] if args.columns else []
    task_template = load_prompt("ontology_task.md")
    user_task = task_template.format(
        csv_path=args.csv_path,
        sample_size=args.sample_size,
        columns_hint=cols_hint,
        additional_prompt=args.additional_prompt
    )

    progress("analyzing your CSV data", "progress")
    
    try:
        run_result = agent.run(user_task)
        result = run_result
    except Exception as e:
        print(f"\n🥵 smolten hissed: {e}", file=sys.stderr); sys.exit(1)
    progress("ontology generation complete", "complete", emoji="💎")

    # Parse whatever came back (string or dict) as JSON
    try:
        if isinstance(result, dict):
            ontology = result
        else:
            # Trim accidental fences if any
            s = str(result).strip()
            if s.startswith("```"):
                s = s.strip("` \n")
                s = s[s.find("\n")+1:] if "\n" in s else s
            ontology = json.loads(s)
    except Exception as e:
        print(f"⚠️ could not parse JSON from agent: {e}\n--- RAW ---\n{result}", file=sys.stderr)
        sys.exit(1)

    # Write output
    with open(args.output_path, "w") as f:
        json.dump(ontology, f, indent=2)

    # Cute summary log
    tag_names = list((ontology.get("ontology") or {}).keys())
    if tag_names:
        gems = ", ".join(tag_names[:4]) + ("…" if len(tag_names) > 4 else "")
        progress(f"forged {len(tag_names)} gems: {gems}", "complete", emoji="💎")
    else:
        progress("no tags generated", "error", emoji="⚠️")

if __name__ == "__main__":
    main()