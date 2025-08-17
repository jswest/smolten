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

MIN_SYSTEM = (
    "You are smolten, a compact CSV-tagging assistant.\n"
    "Use Python only when needed via the provided python tool.\n"
    "Return a single strict JSON object exactly matching the user schema.\n"
    "No prose, no markdown fences, no Thought/Code/Observation logs.\n"
    "Use snake_case for keys."
)


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


def progress(message, progress_type="status", percentage=None, emoji="🌋"):
    """Send structured progress update to Node.js"""
    progress_data = {
        "type": progress_type,
        "message": message,
        "emoji": emoji
    }
    if percentage is not None:
        progress_data["percentage"] = percentage
    
    print(f"SMOLTEN_PROGRESS:{json.dumps(progress_data)}", file=sys.stderr, flush=True)

def lava(msg):
    """Simple molten message for compatibility"""
    print(f"🌋 {msg}", file=sys.stderr, flush=True)

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

    final_tool = FinalOntologyTool()
    agent = CodeAgent(
        tools=[py, final_tool],
        model=llm,
        instructions=MIN_SYSTEM,
        add_base_tools=False,
        max_steps=4,
        verbosity_level=0
    )

    # Single instruction: the agent should *do* the python work and return strict JSON.
    cols_hint = [c.strip() for c in args.columns.split(",")] if args.columns else []
    user_task = f"""
You are a data tagging assistant. Use Python code when helpful.

Task:
1) Load the CSV at path: {args.csv_path!r} with pandas.
2) If there are more than {args.sample_size} rows, randomly sample {args.sample_size} with a fixed random_state=42.
3) Prefer columns (if present): {cols_hint}
4) Define a set of reusable ROW-LEVEL tags (i.e., labels applied to individual records based on their values)!
5) Return ONLY a strict JSON object matching this shape (no markdown fences, no extra text):

{{
  "ontology": {{
    "tag_name": "description": "what the tag means",
  }},
  "notes": "optional brief notes or assumptions"
}}

Constraints:
- Tag names must be lowercased, contain no commas, and be dashed rather spaced out.
- Keep total response under 20k characters.
- Do not print code output; only return the final JSON object.

{args.additional_prompt}
"""

    progress("analyzing your CSV data", "progress")
    try:
        result = agent.run(user_task)
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