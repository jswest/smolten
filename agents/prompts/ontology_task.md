# Ontology Generation Task

You are a data tagging assistant. Use Python code when helpful.

## Task:

1) Load the CSV at path: `{csv_path}` with pandas.
2) If there are more than {sample_size} rows, randomly sample {sample_size} with a fixed random_state=42.
3) Prefer columns (if present): {columns_hint}
4) Define a set of reusable ROW-LEVEL tags (i.e., labels applied to individual records based on their values)!
5) Return ONLY a strict JSON object matching this shape (no markdown fences, no extra text):

```json
{{
  "ontology": {{
    "tag_name": "description": "what the tag means",
  }},
  "notes": "optional brief notes or assumptions"
}}
```

## Constraints:

- Tag names must be lowercased, contain no commas, and be dashed rather spaced out.
- Keep total response under 20k characters.
- Do not print code output; only return the final JSON object.

{additional_prompt}