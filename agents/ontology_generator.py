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
            # Use smolagents' LiteLLMModel for multi-provider support
            from smolagents import LiteLLMModel
            
            # Configure LiteLLM based on provider
            if self.model_provider == "ollama":
                model = LiteLLMModel(
                    model_id=f"ollama/{self.model_name}",
                    api_base="http://localhost:11434",
                    api_key="ollama"
                )
            elif self.model_provider == "openai":
                model = LiteLLMModel(
                    model_id=self.model_name,  # e.g., "gpt-4", "gpt-3.5-turbo"
                    # API key will be read from OPENAI_API_KEY env var
                )
            elif self.model_provider == "anthropic":
                model = LiteLLMModel(
                    model_id=self.model_name,  # e.g., "claude-3-5-sonnet-20241022"
                    # API key will be read from ANTHROPIC_API_KEY env var
                )
            elif self.model_provider == "huggingface":
                from smolagents import InferenceClientModel
                model = InferenceClientModel()
            else:
                raise ValueError(
                    f"Unsupported model provider: {self.model_provider}. "
                    f"Supported providers: ollama, openai, anthropic, huggingface"
                )
            
            # Create CodeAgent with CSV analysis capabilities
            self.agent = CodeAgent(
                tools=[],
                model=model,
                add_base_tools=False,
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
        
        print(f"🌋 bubbling to life… your smolten agent awakens!", file=sys.stderr)
        print(f"🍯 your smolten pot just slurped down {df.shape[0]} rows of delicious data!", file=sys.stderr)
        
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
        
        print(f"🌶️  preparing a spicy {len(prompt)}-character recipe for the AI chef…", file=sys.stderr)
        
        try:
            # Try to get streaming response if possible
            if hasattr(self.agent.model, 'generate') and self.model_provider == "ollama":
                result = self._generate_with_streaming(prompt)
            else:
                result = self.agent.run(prompt)
            
            print(f"🍯 mmm, the AI chef cooked up {len(str(result))} chars of gooey goodness!", file=sys.stderr)
            
            # Handle different response types
            if isinstance(result, dict):
                return result
            elif isinstance(result, str):
                # Parse JSON from string response
                import re
                json_match = re.search(r'```json\s*(.*?)\s*```', result, re.DOTALL)
                if json_match:
                    ontology_json = json_match.group(1)
                else:
                    json_start = result.find('{')
                    json_end = result.rfind('}') + 1
                    if json_start != -1 and json_end > json_start:
                        ontology_json = result[json_start:json_end]
                    else:
                        ontology_json = result
                
                ontology = json.loads(ontology_json)
                print("💫 smolten crystallized the molten data into perfect tag gems!", file=sys.stderr)
                return ontology
            else:
                raise ValueError(f"Unexpected response type: {type(result)}")
            
        except json.JSONDecodeError as e:
            print(f"Error parsing ontology JSON: {e}", file=sys.stderr)
            print(f"Raw agent response: {result}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"Error generating ontology: {e}", file=sys.stderr)
            sys.exit(1)
    
    def _generate_with_streaming(self, prompt):
        """Generate response with streaming output for Ollama."""
        try:
            import requests
            import json as json_module
            
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": True
                },
                stream=True
            )
            response.raise_for_status()
            
            full_response = ""
            token_count = 0
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json_module.loads(line.decode('utf-8'))
                        if 'response' in data:
                            token = data['response']
                            full_response += token
                            token_count += len(token.split())
                            
                            # Show token count every 100 tokens with k notation
                            if token_count % 100 == 0:
                                if token_count >= 1000:
                                    display_count = f"{token_count/1000:.1f}k"
                                else:
                                    display_count = f"{token_count/1000:.1f}k"
                                print(f"\r🔥 simmering… {display_count} tokens bubbling", end="", file=sys.stderr)
                        
                        if data.get('done', False):
                            break
                    except json_module.JSONDecodeError:
                        continue
            
            # Format final token count with k notation
            if token_count >= 1000:
                display_count = f"{token_count/1000:.1f}k"
            else:
                display_count = f"{token_count/1000:.1f}k"
            print(f"\r🌋 eruption complete! {display_count} molten tokens poured out", file=sys.stderr)
            
            return full_response
            
        except Exception as e:
            print(f"⚠️ smolten hissed—streaming got too hot, switching to standard mode: {e}", file=sys.stderr)
            return self.agent.run(prompt)

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
    
    # Print summary
    if "ontology" in ontology:
        tag_count = len(ontology["ontology"])
        tag_names = list(ontology["ontology"].keys())
        print(f"💎 smolten forged {tag_count} perfect gems: {', '.join(tag_names)}", file=sys.stderr)

if __name__ == "__main__":
    main()