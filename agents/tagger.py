#!/usr/bin/env python3
"""
CSV Tagger Agent

This agent tags CSV rows using a provided ontology and smolagents.
"""

import json
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd
from smolagents import LiteLLMModel, InferenceClientModel

class CSVTagger:
    def __init__(self, model_provider: str, model_name: str):
        """Initialize the CSV tagger with specified model."""
        self.model_provider = model_provider
        self.model_name = model_name
        self.model = None
        self._setup_model()
    
    def _setup_model(self):
        """Set up smolagents LiteLLM model."""
        try:            
            # Configure LiteLLM based on provider using smolagents
            if self.model_provider == "ollama":
                self.model = LiteLLMModel(
                    model_id=f"ollama/{self.model_name}",
                    api_base="http://localhost:11434",
                    api_key="ollama",
                    temperature=0.1,
                    max_tokens=50
                )
            elif self.model_provider == "openai":
                self.model = LiteLLMModel(
                    model_id=self.model_name,  # e.g., "gpt-4", "gpt-3.5-turbo"
                    temperature=0.1,
                    max_tokens=50
                    # API key will be read from OPENAI_API_KEY env var
                )
            elif self.model_provider == "anthropic":
                self.model = LiteLLMModel(
                    model_id=self.model_name,  # e.g., "claude-3-5-sonnet-20241022"
                    temperature=0.1,
                    max_tokens=50
                    # API key will be read from ANTHROPIC_API_KEY env var
                )
            elif self.model_provider == "huggingface":
                from smolagents import InferenceClientModel
                self.model = InferenceClientModel()
            else:
                raise ValueError(
                    f"Unsupported model provider: {self.model_provider}. "
                    f"Supported providers: ollama, openai, anthropic, huggingface"
                )
            
        except Exception as e:
            print(f"Error setting up model: {e}", file=sys.stderr)
            sys.exit(1)
    
    def load_ontology(self, ontology_path: str) -> Dict[str, Any]:
        """Load ontology from JSON file."""
        try:
            with open(ontology_path, 'r') as f:
                ontology = json.load(f)
            return ontology
        except Exception as e:
            print(f"Error loading ontology: {e}", file=sys.stderr)
            sys.exit(1)
    
    def tag_row(self, row_data: Dict[str, Any], ontology_summary: str) -> str:
        """Tag a single row using a concise ontology summary. Returns comma-separated tags."""
        
        # Create a much more concise prompt with formatting instructions
        row_text = " | ".join([f"{k}: {v}" for k, v in row_data.items() if v is not None])
        
        prompt = f"""Available tags: {ontology_summary}
Row data: {row_text}

Return matching tags as lowercase, no-spaces, comma-separated (e.g., "customer-service,urgent"):"""
        
        try:
            # Use correct smolagents LiteLLMModel format from documentation
            messages = [
                {"role": "user", "content": [{"type": "text", "text": prompt}]}
            ]
            
            # Call the model with proper message format
            response = self.model(messages)
            
            # Extract the response text
            if hasattr(response, 'content'):
                tags_string = response.content.strip()
            elif hasattr(response, 'text'):
                tags_string = response.text.strip()
            else:
                tags_string = str(response).strip()
            
            # Parse multiple tags (comma-separated)
            proposed_tags = [tag.strip() for tag in tags_string.split(',') if tag.strip()]
            
            # Simple validation - just return the proposed tags
            if not proposed_tags or not any(proposed_tags):
                return "untagged"
            
            return ",".join(proposed_tags)
            
        except Exception as e:
            print(f"Error tagging row: {e}", file=sys.stderr)
            return "untagged"
    
    def tag_csv(self, csv_path: str, ontology_path: str, output_path: str, 
                columns: List[str] = None) -> None:
        """Tag entire CSV file and save results."""
        
        # Load ontology and create concise summary
        ontology = self.load_ontology(ontology_path)
        ontology_tags = ontology.get('ontology', {})
        tag_names = list(ontology_tags.keys())
        ontology_summary = ", ".join(tag_names)
        print(f"✨ smolten sparks are flying… warming up the lava pool with {len(ontology_tags)} bubbly tags!", file=sys.stderr)
        
        # Load CSV
        try:
            df = pd.read_csv(csv_path)
            print(f"🥄 scooped up 1 CSV and dropped it into the lava bath!", file=sys.stderr)
        except Exception as e:
            print(f"🥵 too spicy! CSV melted into invalid goo: {e}", file=sys.stderr)
            sys.exit(1)
        
        # Filter to specified columns if provided
        if columns:
            available_columns = [col for col in columns if col in df.columns]
            if available_columns:
                tagging_df = df[available_columns].copy()
                print(f"🌶️  focusing the heat on columns: {', '.join(available_columns)}", file=sys.stderr)
            else:
                print(f"⚠️ smolten hissed—those columns don't like the heat: {columns}", file=sys.stderr)
                tagging_df = df.copy()
        else:
            tagging_df = df.copy()
        
        # Add tags column
        tags = []
        total_rows = len(tagging_df)
        
        if total_rows < 100:
            print(f"🔥 smolten is bubbling over {total_rows} rows, nice and toasty!", file=sys.stderr)
        else:
            print(f"🌶️  melting through {total_rows} rows—spicy data soup incoming!", file=sys.stderr)
        
        # Tag each row with progress updates
        for idx, row in tagging_df.iterrows():
            if idx % 25 == 0 or idx == total_rows - 1:
                progress = ((idx + 1) / total_rows) * 100
                if progress < 50:
                    print(f"\r🌋 bubbling to life… {idx + 1}/{total_rows} ({progress:.0f}%)", 
                          end="", file=sys.stderr)
                else:
                    print(f"\r🍯 gooey goodness brewing… {idx + 1}/{total_rows} ({progress:.0f}%)", 
                          end="", file=sys.stderr)
            
            row_dict = row.to_dict()
            tag = self.tag_row(row_dict, ontology_summary)
            tags.append(tag)
        
        print("", file=sys.stderr)  # New line after progress
        
        # Add tags to original dataframe
        df['smolten_tag'] = tags
        
        # Save tagged CSV
        try:
            df.to_csv(output_path, index=False)
            print(f"🌋 eruption complete—smolten cools with satisfaction!", file=sys.stderr)
        except Exception as e:
            print(f"🥵 too spicy! output melted before saving: {e}", file=sys.stderr)
            sys.exit(1)
        
        # Print compact tag distribution with cute messages
        all_individual_tags = []
        for tag_string in tags:
            individual_tags = [tag.strip() for tag in tag_string.split(',') if tag.strip()]
            all_individual_tags.extend(individual_tags)
        
        tag_counts = pd.Series(all_individual_tags).value_counts()
        multi_tag_rows = sum(1 for tag_string in tags if ',' in tag_string)
        
        top_tags = dict(tag_counts.head(3))
        if top_tags:
            top_tag_name = list(top_tags.keys())[0]
            print(f"💫 smolten's favorite flavor: *{top_tag_name}* (appeared {top_tags[top_tag_name]} times)", file=sys.stderr)
        
        if multi_tag_rows > 0:
            print(f"🍯 extra gooey! {multi_tag_rows} rows got multiple tags", file=sys.stderr)
        
        print(f"✨ molten job well done, cooling down…", file=sys.stderr)

def main():
    parser = argparse.ArgumentParser(description="Tag CSV rows using ontology")
    parser.add_argument("csv_path", help="Path to CSV file")
    parser.add_argument("ontology_path", help="Path to ontology JSON file")
    parser.add_argument("output_path", help="Path for tagged CSV output")
    parser.add_argument("--columns", help="Comma-separated list of columns to focus on")
    parser.add_argument("--model-provider", default="huggingface",
                       help="Model provider (ollama, openai, huggingface)")
    parser.add_argument("--model-name", default="meta-llama/Llama-2-7b-chat-hf",
                       help="Model name")
    
    args = parser.parse_args()
    
    # Parse columns if provided
    columns = None
    if args.columns:
        columns = [col.strip() for col in args.columns.split(",")]
    
    # Create tagger
    tagger = CSVTagger(args.model_provider, args.model_name)
    
    # Tag the CSV
    tagger.tag_csv(args.csv_path, args.ontology_path, args.output_path, columns)
    
    print("Tagging complete!", file=sys.stderr)

if __name__ == "__main__":
    main()