#!/usr/bin/env python3
"""
Ontology Generator Agent

This agent analyzes CSV data and generates a tag ontology using smolagents.
"""

import json
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd
from smolagents import CodeAgent, InferenceClientModel

class OntologyGenerator:
    def __init__(self, model_provider: str, model_name: str):
        """Initialize the ontology generator with specified model."""
        self.model_provider = model_provider
        self.model_name = model_name
        self.agent = None
        self.prompt_template = self._load_prompt_template()
        self._setup_agent()
    
    def _load_prompt_template(self) -> str:
        """Load the ontology generation prompt template."""
        prompt_path = Path(__file__).parent / "prompts" / "ontology_generation.txt"
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
            
            # Create CodeAgent with CSV analysis capabilities
            self.agent = CodeAgent(
                tools=[],
                model=model,
                add_base_tools=True,
                additional_authorized_imports=[
                    "pandas", "numpy", "json", "collections", "itertools"
                ]
            )
            
        except Exception as e:
            print(f"Error setting up agent: {e}", file=sys.stderr)
            sys.exit(1)
    
    def load_and_sample_csv(self, csv_path: str, sample_size: int = 1000, 
                           columns: List[str] = None) -> pd.DataFrame:
        """Load CSV and return a sample for analysis."""
        try:
            df = pd.read_csv(csv_path)
            
            # Filter to specified columns if provided
            if columns:
                available_columns = [col for col in columns if col in df.columns]
                if available_columns:
                    df = df[available_columns]
                else:
                    print(f"Warning: None of the specified columns {columns} found in CSV", 
                          file=sys.stderr)
            
            # Sample the data if it's larger than sample_size
            if len(df) > sample_size:
                df_sample = df.sample(n=sample_size, random_state=42)
                print(f"Sampled {sample_size} rows from {len(df)} total rows", file=sys.stderr)
            else:
                df_sample = df
                print(f"Using all {len(df)} rows for analysis", file=sys.stderr)
            
            return df_sample
            
        except Exception as e:
            print(f"Error loading CSV: {e}", file=sys.stderr)
            sys.exit(1)
    
    def generate_ontology(self, df: pd.DataFrame, tag_count: int = 10) -> Dict[str, Any]:
        """Generate tag ontology from DataFrame using the agent."""
        
        # Prepare data for the prompt
        sample_data = json.dumps(df.head(5).to_dict('records'), indent=2)
        columns = ', '.join(df.columns)
        shape = f"{df.shape[0]} x {df.shape[1]}"
        
        # Format the prompt with actual data
        prompt = self.prompt_template.format(
            shape=shape,
            columns=columns,
            sample_data=sample_data,
            tag_count=tag_count
        )
        
        try:
            # Run the agent to generate ontology
            result = self.agent.run(prompt)
            
            # Try to extract JSON from the response
            import re
            json_match = re.search(r'```json\s*(.*?)\s*```', result, re.DOTALL)
            if json_match:
                ontology_json = json_match.group(1)
            else:
                # Try to find JSON in the response without code blocks
                json_start = result.find('{')
                json_end = result.rfind('}') + 1
                if json_start != -1 and json_end > json_start:
                    ontology_json = result[json_start:json_end]
                else:
                    ontology_json = result
            
            ontology = json.loads(ontology_json)
            return ontology
            
        except json.JSONDecodeError as e:
            print(f"Error parsing ontology JSON: {e}", file=sys.stderr)
            print(f"Raw agent response: {result}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"Error generating ontology: {e}", file=sys.stderr)
            sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Generate tag ontology from CSV data")
    parser.add_argument("csv_path", help="Path to CSV file")
    parser.add_argument("output_path", help="Path for ontology JSON output")
    parser.add_argument("--columns", help="Comma-separated list of columns to focus on")
    parser.add_argument("--tag-count", type=int, default=10, 
                       help="Number of tags to generate (default: 10)")
    parser.add_argument("--sample-size", type=int, default=1000,
                       help="Number of rows to sample for analysis (default: 1000)")
    parser.add_argument("--model-provider", default="huggingface",
                       help="Model provider (ollama, openai, huggingface)")
    parser.add_argument("--model-name", default="meta-llama/Llama-2-7b-chat-hf",
                       help="Model name")
    
    args = parser.parse_args()
    
    # Parse columns if provided
    columns = None
    if args.columns:
        columns = [col.strip() for col in args.columns.split(",")]
    
    # Create ontology generator
    generator = OntologyGenerator(args.model_provider, args.model_name)
    
    # Load and sample CSV data
    df = generator.load_and_sample_csv(args.csv_path, args.sample_size, columns)
    
    # Generate ontology
    print(f"Generating ontology with {args.tag_count} tags...", file=sys.stderr)
    ontology = generator.generate_ontology(df, args.tag_count)
    
    # Save ontology to output file
    with open(args.output_path, 'w') as f:
        json.dump(ontology, f, indent=2)
    
    print(f"Ontology saved to {args.output_path}", file=sys.stderr)
    
    # Print summary
    if "ontology" in ontology:
        tag_count = len(ontology["ontology"])
        print(f"Generated {tag_count} tags:", file=sys.stderr)
        for tag_name in ontology["ontology"].keys():
            print(f"  - {tag_name}", file=sys.stderr)

if __name__ == "__main__":
    main()