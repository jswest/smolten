#!/usr/bin/env python3
import os, sys, argparse, json
from smolagents import CodeAgent, LiteLLMModel
try:
    from smolagents import PythonInterpreterTool as PyTool
except ImportError:
    from smolagents import PythonREPLTool as PyTool

def lava(msg, end="\n"):
    print(f"🌋 {msg}", file=sys.stderr, end=end, flush=True)

def main():
    p = argparse.ArgumentParser(description="General CSV row tagger with editorial judgment (smolagents, 1 pass)")
    p.add_argument("csv_path")
    p.add_argument("ontology_path")   # optional file with {"tags": {...}}; can be empty/minimal
    p.add_argument("output_path")
    p.add_argument("--model", default=os.getenv("SMOL_MODEL", "gpt-oss:20b"))
    p.add_argument("--api-base", default=os.getenv("SMOL_API_BASE", "http://localhost:11434/v1"))
    p.add_argument("--api-key",  default=os.getenv("SMOL_API_KEY", "ollama"))
    p.add_argument("--provider", default=os.getenv("SMOL_PROVIDER", "openai"))
    p.add_argument("--sample-size", type=int, default=1000)
    p.add_argument("--max-steps", type=int, default=4)
    args = p.parse_args()

    llm = LiteLLMModel(
        model_id="gpt-oss:20b",
        api_base="http://localhost:11434/v1",
        api_key="ollama",
        custom_llm_provider="openai",
    )

    py = PyTool(
        authorized_imports=["pandas","json","re","math","statistics","itertools","collections","datetime"],
        description="Run short Python snippets."
    )

    MIN_SYSTEM = (
        "You are smolten, an editorial CSV tagger. You may read files and run pandas via the python tool. "
        "Your job: study a small sample, use editorial judgment to define useful ROW-LEVEL tags for this dataset, "
        "encode that judgment into a simple labeling function, then apply it to all rows. "
        "Return ONLY a tiny JSON summary at the end."
    )

    agent = CodeAgent(
        tools=[py],
        model=llm,
        add_base_tools=False,
        instructions=MIN_SYSTEM,
        verbosity_level=0
    )

    TASK = f"""
Use Python to perform ALL steps deterministically while leveraging your editorial judgment.

1) Load ontology from {args.ontology_path!r} as 'ont':
   - ont["tags"] is a dict of desired tag_name -> description. It is required to adhere to this ontology.

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

7) Return ONLY this JSON summary (no prints/markdown):
{{
  "rows_tagged": <int>,            # count rows where smolten_tag != ""
  "unique_tags": <int>,            # number of distinct tags used (excluding empty strings)
  "example_tags": [ "<tag1>", "<tag2>", "<tag3>" ],   # 3 sample tag names actually used
  "top_tags": [ [ "<tag>", <count> ], ... ]           # up to 5 most frequent tags, desc
}}

Implementation tips:
- Heuristic + editorial blend: You decide the keywords/regex and thresholds after reading df_s.
- Treat non-existent columns gracefully (tag simply never fires).
- For long text columns, prefer simple phrase lists over heavy NLP.
- Keep label_row concise and readable.
"""

    lava("bubbling to life… editorial tagging in one pass…", end="")
    summary = agent.run(TASK, max_steps=args.max_steps)
    lava(" eruption complete!\n")
    print(summary)

if __name__ == "__main__":
    main()
