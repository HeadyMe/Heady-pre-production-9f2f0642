# Deploy Windsurf config
Copy-Item c:\Users\erich\Heady\.windsurf\* ~\.windsurf\ -Recurse -Force
Restart-Service -Name "Windsurf" -ErrorAction SilentlyContinue
