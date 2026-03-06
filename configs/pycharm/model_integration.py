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
# ║  FILE: configs/pycharm/model_integration.py                                                    ║
# ║  LAYER: config                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
import os
import sys
from pathlib import Path

def setup_heady_model():
    # Add Heady to Python path
    heady_path = str(Path(__file__).parent.parent.parent)
    if heady_path not in sys.path:
        sys.path.insert(0, heady_path)
    
    try:
        from heady_project.model import HeadyModel
        os.environ['PYCHARM_DEFAULT_MODEL'] = 'heady'
        return True
    except ImportError:
        return False

if __name__ == "__main__":
    if setup_heady_model():
        print("Heady model configured for PyCharm")
    else:
        print("Heady model setup failed")
