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