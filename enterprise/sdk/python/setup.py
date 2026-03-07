"""
setup.py for heady-sdk-python
HeadySystems Inc. (DBA Heady™) | Official Python SDK for HeadyOS
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read long description from README
long_description = (Path(__file__).parent / "README.md").read_text(encoding="utf-8")

setup(
    name="heady-sdk",
    version="1.0.0",
    description="Official Python SDK for HeadyOS Platform and HeadyMe AI",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="HeadySystems Inc.",
    author_email="sdk@headyme.com",
    url="https://docs.headyme.com/sdk/python",
    project_urls={
        "Documentation": "https://docs.headyme.com/sdk/python",
        "Source": "https://github.com/heady-ai/sdk-python",
        "Tracker": "https://github.com/heady-ai/sdk-python/issues",
        "Homepage": "https://headyme.com",
    },
    packages=find_packages(exclude=["tests*", "examples*"]),
    package_data={
        "heady": ["py.typed"],
    },
    python_requires=">=3.11",
    install_requires=[
        "httpx>=0.27.0",        # Async HTTP client
        "pydantic>=2.6.0",      # Data validation models
        "websockets>=12.0",     # WebSocket client
        "typing-extensions>=4.9.0",
    ],
    extras_require={
        "dev": [
            "pytest>=8.0.0",
            "pytest-asyncio>=0.23.0",
            "pytest-cov>=5.0.0",
            "mypy>=1.8.0",
            "ruff>=0.3.0",
            "black>=24.0.0",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Typing :: Typed",
    ],
    keywords=[
        "heady", "headyos", "headyme", "ai", "agents",
        "multi-agent", "orchestration", "mcp", "vector-memory", "sdk"
    ],
    license="MIT",
)
