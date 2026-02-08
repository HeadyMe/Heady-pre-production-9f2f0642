<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: NOTEBOOK_TEMPLATE.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Project Notebook Template

Use this when you create a new notebook in PyCharm or Colab.

## Header

- Project: <PROJECT_NAME>
- Notebook: <NOTEBOOK_NAME>
- Author: <AUTHOR>
- Date: <YYYY-MM-DD>
- Purpose: 1–2 sentences.

## Run in Colab

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/<USER_OR_ORG>/<REPO_NAME>/blob/main/notebooks/reports/<NOTEBOOK_FILE>.ipynb)

(When I create a new notebook, I will update the path above to notebooks/exploratory/ or notebooks/reports/ to match its actual location.)

## Recommended sections

1. Setup
   - Imports
   - Project root and data paths
   - Environment variables (loaded via python-dotenv if used)

2. Data loading
   - Read input data from data/raw/ or data/processed/
   - Document input sources

3. Exploration / EDA
   - Basic summaries, head(), describe(), plots
   - Sanity checks

4. Core analysis / modeling
   - Feature engineering, models, evaluation

5. Results and conclusions
   - Key metrics, plots, tables
   - Written conclusions and next steps

6. Save outputs
   - Save figures to notebooks/figures/ (or a dedicated output folder)
   - Save processed data or models to data/processed/ or appropriate locations

Guidelines:
- Keep notebooks reasonably short and focused.
- Move reusable code into src/ and import it in notebooks.
- Use meaningful, descriptive notebook names (e.g., 01_eda_customers.ipynb, 02_model_training.ipynb).
