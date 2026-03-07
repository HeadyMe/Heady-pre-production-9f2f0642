from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
zip_path = root.parent / 'heady-latent-os-runtime-bundle.zip'

exclude_parts = {'node_modules', '.git', '__pycache__'}
exclude_suffixes = {'.pyc'}

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for path in root.rglob('*'):
        rel = path.relative_to(root)
        if any(part in exclude_parts for part in rel.parts):
            continue
        if path.suffix in exclude_suffixes:
            continue
        zf.write(path, arcname=str(Path('heady-latent-os-runtime-bundle') / rel))

print(zip_path)
