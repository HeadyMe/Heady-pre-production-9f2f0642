#!/usr/bin/env python3
"""
Heady CLI Interface
"""
import os
import pprint
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.heady_client import HeadyClient

print("HeadyNotebook: PyCharm is working")

if __name__ == "__main__":
    # Fetch configuration from environment variables
    base_url = os.getenv("HEADY_BASE_URL", "https://api.heady.ai")
    api_key = os.getenv("HEADY_API_KEY")

    if not api_key:
        print("Error: HEADY_API_KEY not set")
        print("Export it first:")
        print('export HEADY_API_KEY="YOUR_TOKEN_HERE"')
        sys.exit(1)

    client = HeadyClient(base_url=base_url, api_key=api_key)

    # Example round-trip: retrieve your user profile
    try:
        profile = client.get("/me")
    except Exception as exc:
        print(f"Error: Call failed - {exc}", file=sys.stderr)
        sys.exit(1)

    print("\n✔ Connected to Heady! Profile data:")
    pprint.pprint(profile, sort_dicts=False)
