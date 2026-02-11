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
# ║  FILE: scripts/ops/snapshot_evidence.py                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
import shutil
import datetime
import os
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor

def create_evidence_packet():
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    evidence_dir = f"evidence/build_{timestamp}"
    os.makedirs(evidence_dir, exist_ok=True)
    
    # Archive source with headers
    shutil.make_archive(f"{evidence_dir}_source", 'zip', root_dir='.', base_dir='apps')
    
    # Capture project state
    if os.path.exists("PROJECT_STATE.json"):
        shutil.copy("PROJECT_STATE.json", f"{evidence_dir}_state.json")
    
    # Generate manifest with checksums
    manifest = {
        "timestamp": timestamp,
        "commit": os.popen("git rev-parse HEAD").read().strip(),
        "branch": os.popen("git rev-parse --abbrev-ref HEAD").read().strip(),
        "checksums": {}
    }
    
    file_paths = []
    for root, _, files in os.walk("apps"):
        for file in files:
            if file.endswith((".ts", ".tsx", ".py")):
                path = os.path.join(root, file)
                file_paths.append(path)
    
    def hash_file(path):
        try:
            with open(path, "rb") as f:
                return path, hashlib.sha256(f.read()).hexdigest()
        except Exception as e:
            print(f"❌ Error processing {path}: {str(e)}")
            return path, None
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = dict(executor.map(hash_file, file_paths))
        manifest["checksums"] = {path: checksum for path, checksum in results.items() if checksum is not None}
    
    with open(f"{evidence_dir}_manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)
    
    print(f"🔒 Evidence packet created: {evidence_dir}")
    print("   Upload to S3 with Object Lock or similar WORM storage for USPTO verification.")

if __name__ == "__main__":
    create_evidence_packet()
