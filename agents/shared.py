"""
Shared utilities for smolten agents
"""
import json
import sys


def format_token_count(count):
    """Format token count like the Node.js version"""
    if count >= 1000:
        return f"{count / 1000:.1f}k"
    return str(count)


def progress(message, progress_type="status", percentage=None, emoji="🌋"):
    """Send structured progress update to Node.js"""
    # Flush any existing output to avoid stale characters
    sys.stderr.flush()
    sys.stdout.flush()
    
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
    # Flush any existing output to avoid stale characters
    sys.stderr.flush()
    sys.stdout.flush()
    print(f"🌋 {msg}", file=sys.stderr, flush=True)


def load_prompt(filename):
    """Load prompt from markdown file"""
    import os
    prompt_path = os.path.join(os.path.dirname(__file__), "prompts", filename)
    with open(prompt_path, "r", encoding="utf-8") as f:
        content = f.read()
    # Strip markdown heading and return just the content
    lines = content.split('\n')
    # Skip first line if it's a heading, then join the rest
    if lines and lines[0].startswith('#'):
        return '\n'.join(lines[1:]).strip()
    return content.strip()