# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/legal/inject_headers.py                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
import os
import datetime
from multiprocessing import Pool

YEAR = datetime.datetime.now().year

SYSTEMS_HEADER = f"""/**
 * Copyright (c) {YEAR} HeadySystems Inc. (C-Corp)
 * PROPRIETARY & CONFIDENTIAL.
 * Patent Pending: Infrastructure & Orchestration Cluster
 * Implements: Distributed State Mutex, Golden Ratio UI
 */
"""

CONNECTION_HEADER = f"""/**
 * Copyright (c) {YEAR} HeadyConnection Inc. (Non-Profit)
 * Licensed for HeadyConnection Community Use.
 * Patent Pending: Connected Experience Cluster
 * Implements: Social Impact Graph, Vibe Match Algorithm
 */
"""

def get_header(file_path):
    """Determine correct header based on directory heuristics"""
    is_python = file_path.endswith(".py")
    
    if "heady-connection" in file_path or "social-graph" in file_path:
        return CONNECTION_HEADER if not is_python else CONNECTION_HEADER.replace("/**", '"""').replace("*/", '"""')
    elif any(x in file_path for x in ["heady-systems", "infrastructure", "orchestrator", "packages/ui"]):
        return SYSTEMS_HEADER if not is_python else SYSTEMS_HEADER.replace("/**", '"""').replace("*/", '"""')
    return None

def inject_header(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        if "Copyright (c)" in content and "Heady" in content:
            return False

        header = get_header(file_path)
        if not header:
            return False

        print(f"⚖️  Stamping IP header: {file_path}")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(header + "\n" + content)
        return True
    except Exception as e:
        print(f"❌ Error processing {file_path}: {str(e)}")
        return False

def process_file(file_path):
    return inject_header(file_path)

def main():
    target_extensions = (".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs")
    file_paths = []
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", ".next", "dist", "build"]]
        
        for file in files:
            if file.endswith(target_extensions):
                file_paths.append(os.path.join(root, file))

    with Pool() as p:
        p.map(process_file, file_paths)

if __name__ == "__main__":
    main()
