# CSV Tagging Task

Use Python to perform ALL steps deterministically while leveraging your editorial judgment.

You are given an ontology payload as JSON. At the VERY TOP of your first `<code>` block,
you MUST create a Python dict variable named ONT EXACTLY as follows (paste verbatim):

```python
ONT = {ontology_string}
```

## Steps:

1) Use ONT (a dict with tag_name->description) as the authoritative tag list. It is required to adhere to this ontology.

2) Load CSV from `{csv_path}` as df (pandas). Create df_all = df.copy().
   - For exploration ONLY, if len(df) > {sample_size}, sample {sample_size} rows (random_state=42) into df_s.
   - Identify text-like columns (object/string), numeric columns, parseable dates (try pandas.to_datetime with errors='coerce').

4) Implement the ontology as executable code:
   - Author a function `def label_row(row) -> list[str]:` that returns applicable tag names for a row.
   - Use both simple heuristics (regex/thresholds) **and** your editorial cues encoded as:
        * lightweight keyword/phrase sets per tag (you choose),
        * soft signals (e.g., "if title looks rhetorical", "if summary looks listicle-like"),
        * fallbacks (if supporting columns absent, the tag simply doesn't apply).
   - Keep dependencies minimal: only pandas/re/json/re/stdlib allowed.
   - Normalize emitted names to lowercase dashed form when building the final string.

5) Apply to ALL rows (df_all):
   - Vectorize if easy; otherwise a fast `.apply` is acceptable.
   - Create column 'smolten_tag':
        * join tags with commas;
        * if none, set an empty string.

6) Save df_all to `{output_path}` with index=False.

7) Return ONLY this JSON summary (no prints/markdown), WRAPPED IN `<code> ... </code>`:
```json
{{
  "rows_tagged": <int>,
  "unique_tags": <int>,
  "example_tags": [ "<tag1>", "<tag2>", "<tag3>" ],
  "top_tags": [ [ "<tag>", <count> ], ... ]
}}
```

## Implementation tips:

- Heuristic + editorial blend: You decide the keywords/regex and thresholds after reading df_s.
- Treat non-existent columns gracefully (tag simply never fires).
- For long text columns, prefer simple phrase lists over heavy NLP.
- Keep label_row concise and readable.