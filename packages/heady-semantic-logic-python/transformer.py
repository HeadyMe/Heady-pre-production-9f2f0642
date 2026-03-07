"""
Python-side transformer for converting traditional logic to CSL
"""

import re
from pathlib import Path
from typing import List

def transform_python_file(content: str) -> str:
    """Transform Python if/else to continuous semantic logic"""

    # Pattern: if x == "value":
    pattern = r'if\s+([a-zA-Z0-9_\.]+)\s*==\s*['"]([^'"]+)['"]\s*:'
    replacement = r'if SemanticGate.AND([SemanticTruthValue(/* fuzzify \1 */)], "zadeh").is_truthy():'
    content = re.sub(pattern, replacement, content)

    # Add import if transformed
    if "SemanticGate" in content and "from semantic_gates import" not in content:
        content = "from semantic_gates import SemanticGate, SemanticTruthValue\n" + content

    return content

def process_directory(source_dir: Path, target_dir: Path):
    """Process all Python files in directory"""
    for py_file in source_dir.rglob("*.py"):
        if "venv" in py_file.parts or "__pycache__" in py_file.parts:
            continue

        rel_path = py_file.relative_to(source_dir)
        dest_file = target_dir / rel_path
        dest_file.parent.mkdir(parents=True, exist_ok=True)

        with open(py_file, 'r') as f:
            content = f.read()

        transformed = transform_python_file(content)

        with open(dest_file, 'w') as f:
            f.write(transformed)

        print(f"[+] Transformed: {rel_path}")

if __name__ == "__main__":
    import sys
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("../HeadyMe")
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("../HeadyMe_Semantic")
    process_directory(source, target)
