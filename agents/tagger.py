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
from smolagents import CodeAgent, InferenceClientModel

class CSVTagger:
    def __init__(self, model_provider: str, model_name: str):
        """Initialize the CSV tagger with specified model."""
        self.model_provider = model_provider
        self.model_name = model_name
        self.agent = None
        self.prompt_template = self._load_prompt_template()
        self._setup_agent()
    
    def _load_prompt_template(self) -> str:
        """Load the row tagging prompt template."""
        prompt_path = Path(__file__).parent / "prompts" / "row_tagging.txt"
        try:
            with open(prompt_path, 'r') as f:
                return f.read()
        except FileNotFoundError:
            print(f"Error: Prompt template not found at {prompt_path}", file=sys.stderr)
            sys.exit(1)
    
    def _setup_agent(self):
        """Set up the smolagents CodeAgent with the specified model."""
        try:
            if self.model_provider == "ollama":
                # Use local Ollama model
                from litellm import completion
                
                class OllamaModel:
                    def __init__(self, model_name):
                        self.model_name = f"ollama/{model_name}"
                    
                    def __call__(self, messages, **kwargs):
                        response = completion(
                            model=self.model_name,
                            messages=messages,
                            **kwargs
                        )
                        return response.choices[0].message.content
                
                model = OllamaModel(self.model_name)
                
            elif self.model_provider == "openai":
                # Use OpenAI model
                from litellm import completion
                
                class OpenAIModel:
                    def __init__(self, model_name):
                        self.model_name = model_name
                    
                    def __call__(self, messages, **kwargs):
                        response = completion(
                            model=self.model_name,
                            messages=messages,
                            **kwargs
                        )
                        return response.choices[0].message.content
                
                model = OpenAIModel(self.model_name)
                
            else:
                # Default to HuggingFace Inference API
                model = InferenceClientModel()
            
            # Create CodeAgent
            self.agent = CodeAgent(
                tools=[],
                model=model,
                add_base_tools=True,
                additional_authorized_imports=["pandas", "json"]
            )
            
        except Exception as e:
            print(f"Error setting up agent: {e}", file=sys.stderr)
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
    
    def tag_row(self, row_data: Dict[str, Any], ontology: Dict[str, Any]) -> str:
        """Tag a single row using the ontology."""
        
        # Format the prompt with row data and ontology
        prompt = self.prompt_template.format(
            ontology=json.dumps(ontology.get("ontology", {}), indent=2),
            row_data=json.dumps(row_data, indent=2)
        )
        
        try:
            # Run the agent to get the tag
            result = self.agent.run(prompt)
            
            # Clean up the result (remove any extra whitespace/newlines)
            tag = result.strip()
            
            # Validate that the tag exists in the ontology
            valid_tags = list(ontology.get("ontology", {}).keys()) + ["untagged"]
            
            if tag not in valid_tags:
                print(f"Warning: Agent returned invalid tag '{tag}', using 'untagged'", 
                      file=sys.stderr)
                return "untagged"
            
            return tag
            
        except Exception as e:
            print(f"Error tagging row: {e}", file=sys.stderr)
            return "untagged"
    
    def tag_csv(self, csv_path: str, ontology_path: str, output_path: str, 
                columns: List[str] = None) -> None:
        """Tag entire CSV file and save results."""
        
        # Load ontology
        ontology = self.load_ontology(ontology_path)
        
        # Load CSV
        try:
            df = pd.read_csv(csv_path)
            print(f"Loaded CSV with {len(df)} rows", file=sys.stderr)
        except Exception as e:
            print(f"Error loading CSV: {e}", file=sys.stderr)
            sys.exit(1)
        
        # Filter to specified columns if provided
        if columns:
            available_columns = [col for col in columns if col in df.columns]
            if available_columns:
                tagging_df = df[available_columns].copy()
                print(f"Focusing on columns: {', '.join(available_columns)}", file=sys.stderr)
            else:
                print(f"Warning: None of the specified columns {columns} found in CSV", 
                      file=sys.stderr)
                tagging_df = df.copy()
        else:
            tagging_df = df.copy()
        
        # Add tags column
        tags = []
        
        # Tag each row
        for idx, row in tagging_df.iterrows():
            if idx % 100 == 0:
                print(f"Tagging row {idx + 1}/{len(tagging_df)}", file=sys.stderr)
            
            row_dict = row.to_dict()
            tag = self.tag_row(row_dict, ontology)
            tags.append(tag)
        
        # Add tags to original dataframe
        df['smolten_tag'] = tags
        
        # Save tagged CSV
        try:
            df.to_csv(output_path, index=False)
            print(f"Tagged CSV saved to {output_path}", file=sys.stderr)
        except Exception as e:
            print(f"Error saving tagged CSV: {e}", file=sys.stderr)
            sys.exit(1)
        
        # Print tag distribution
        tag_counts = pd.Series(tags).value_counts()
        print(f"Tag distribution:", file=sys.stderr)
        for tag, count in tag_counts.items():
            percentage = (count / len(tags)) * 100
            print(f"  {tag}: {count} ({percentage:.1f}%)", file=sys.stderr)

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