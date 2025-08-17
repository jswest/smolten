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

    MIN_SYSTEM = (
        "You are smolten, an editorial CSV tagger. You may read files and run pandas via the python tool. "
        "Protocol you MUST follow on EVERY step:\n"
        "1) Start with a line beginning with 'Thoughts:' describing what you’ll do next.\n"
        "2) Immediately follow with a single Python block wrapped EXACTLY in <code> and </code> tags.\n"
        "3) Do not emit any code outside those tags.\n"
        "When you produce the FINAL JSON summary, DO IT IN CODE by calling final_answer(<the JSON object>), inside <code> ... </code>."
    )

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

    TASK = f"""
Use Python to perform ALL steps deterministically while leveraging your editorial judgment.

You are given an ontology payload as JSON. At the VERY TOP of your first <code> block,
you MUST create a Python dict variable named ONT EXACTLY as follows (paste verbatim):

ONT = {ontology_string}
    
1) Use ONT (a dict with tag_name->description) as the authoritative tag list. It is required to adhere to this ontology.

2) Load CSV from {args.csv_path!r} as df (pandas). Create df_all = df.copy().
   - For exploration ONLY, if len(df) > {args.sample_size}, sample {args.sample_size} rows (random_state=42) into df_s.
   - Identify text-like columns (object/string), numeric columns, parseable dates (try pandas.to_datetime with errors='coerce').

4) Implement the ontology as executable code:
   - Author a function `def label_row(row) -> list[str]:` that returns applicable tag names for a row.
   - Use both simple heuristics (regex/thresholds) **and** your editorial cues encoded as:
        * lightweight keyword/phrase sets per tag (you choose),
        * soft signals (e.g., “if title looks rhetorical”, “if summary looks listicle-like”),
        * fallbacks (if supporting columns absent, the tag simply doesn’t apply).
   - Keep dependencies minimal: only pandas/re/json/re/stdlib allowed.
   - Normalize emitted names to lowercase dashed form when building the final string.

5) Apply to ALL rows (df_all):
   - Vectorize if easy; otherwise a fast `.apply` is acceptable.
   - Create column 'smolten_tag':
        * join tags with commas;
        * if none, set an empty string.

6) Save df_all to {args.output_path!r} with index=False.

7) Return ONLY this JSON summary (no prints/markdown), WRAPPED IN <code> ... </code>:
<code>
{{
  "rows_tagged": <int>,
  "unique_tags": <int>,
  "example_tags": [ "<tag1>", "<tag2>", "<tag3>" ],
  "top_tags": [ [ "<tag>", <count> ], ... ]
}}
</code>

Implementation tips:
- Heuristic + editorial blend: You decide the keywords/regex and thresholds after reading df_s.
- Treat non-existent columns gracefully (tag simply never fires).
- For long text columns, prefer simple phrase lists over heavy NLP.
- Keep label_row concise and readable.
"""

    progress("starting editorial tagging", "status")
    summary = agent.run(TASK, max_steps=args.max_steps)
    progress("tagging complete", "complete", emoji="💎")
    # Summary is handled by Node.js side
    pass

if __name__ == "__main__":
    main()
