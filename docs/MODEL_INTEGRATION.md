## How to Select Heady as Default Model

### PyCharm
1. Open `Tools > AI Models`
2. Select "Heady" from dropdown
3. Set as default

### Windsurf
Heady will be default if:
- `priority` is highest in `.windsurf/model_config.yaml`
- Configuration file exists

### Troubleshooting
- Run verification script: `.\scripts\verify_model_setup.ps1`
- Check logs: `%APPDATA%\Heady\logs\model_integration.log`
