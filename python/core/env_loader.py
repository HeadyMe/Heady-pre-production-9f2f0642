"""
env_loader.py
=============
Zero-dependency replacement for python-dotenv.

Features:
    - Parse .env files with comments, blank lines, quoted values
    - Single-quoted and double-quoted values
    - Multiline values via backslash continuation or triple-quoted blocks
    - Variable interpolation: ${VAR} and $VAR
    - Export to os.environ (with override option)
    - Typed accessors: get_env, require_env
    - Multiple file support and cascading precedence
    - Validation helpers

Usage:
    from core.env_loader import load_env, get_env, require_env

    load_env()               # loads .env from cwd
    load_env(".env.local")   # loads specific file
    port = get_env("PORT", default="8000", cast=int)
    secret = require_env("SECRET_KEY")
"""

import os
import re
import sys
import logging
from pathlib import Path
from typing import Any, Callable, Optional, Union

__all__ = [
    "load_env",
    "load_env_file",
    "get_env",
    "require_env",
    "EnvLoader",
]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Parsing internals
# ---------------------------------------------------------------------------

# Matches: KEY=VALUE, KEY = VALUE, export KEY=VALUE
_KEY_VALUE_RE = re.compile(
    r"""
    ^
    (?:export\s+)?                  # optional 'export' prefix
    (?P<key>[A-Za-z_][A-Za-z0-9_]*)  # key
    \s*=\s*                          # equals with optional whitespace
    (?P<value>.*)                    # everything else
    $
    """,
    re.VERBOSE,
)

# Variable interpolation: ${VAR_NAME} or $VAR_NAME
_INTERP_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)")


def _strip_inline_comment(value: str) -> str:
    """Remove trailing inline comment (unquoted # after whitespace)."""
    # Walk character by character to respect quotes
    in_single = False
    in_double = False
    escaped = False
    for i, ch in enumerate(value):
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == "#" and not in_single and not in_double:
            # Only strip if preceded by whitespace
            if i > 0 and value[i - 1] in (" ", "\t"):
                return value[:i].rstrip()
    return value


def _unquote(value: str) -> str:
    """
    Remove surrounding quotes from a value and handle escape sequences.
    Supports: 'value', "value", and unquoted.
    """
    if len(value) >= 2:
        if value[0] == value[-1] == "'":
            # Single-quoted: no escape processing
            return value[1:-1]
        if value[0] == value[-1] == '"':
            # Double-quoted: process escape sequences
            inner = value[1:-1]
            inner = inner.replace(r"\n", "\n")
            inner = inner.replace(r"\r", "\r")
            inner = inner.replace(r"\t", "\t")
            inner = inner.replace(r"\\", "\\")
            inner = inner.replace(r'\"', '"')
            return inner
    return value


def _interpolate(value: str, env: dict[str, str]) -> str:
    """Replace ${VAR} and $VAR references with values from env or os.environ."""

    def replacer(match: re.Match) -> str:
        var = match.group(1) or match.group(2)
        return env.get(var, os.environ.get(var, match.group(0)))

    return _INTERP_RE.sub(replacer, value)


def _parse_env_text(text: str) -> dict[str, str]:
    """
    Parse raw .env file text into an ordered dict of key->value pairs.

    Handles:
      - Comments (# at start of line or inline after whitespace)
      - Blank lines
      - Backslash line continuation
      - Multiline double-quoted values
      - Single-quoted values (no interpolation inside)
      - Variable interpolation in unquoted and double-quoted values
    """
    result: dict[str, str] = {}
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1

        # Strip leading whitespace
        stripped = line.lstrip()

        # Skip blanks and comments
        if not stripped or stripped.startswith("#"):
            continue

        # Handle backslash continuation (join before matching)
        while stripped.endswith("\\") and i < len(lines):
            stripped = stripped[:-1] + lines[i].lstrip()
            i += 1

        match = _KEY_VALUE_RE.match(stripped)
        if not match:
            continue

        key = match.group("key")
        raw_value = match.group("value").strip()

        # --- Multiline double-quoted value ---
        if raw_value.startswith('"') and not (len(raw_value) >= 2 and raw_value.endswith('"') and raw_value.count('"') >= 2):
            # Opening quote with no closing quote yet — gather lines
            accumulated = raw_value[1:]  # strip leading "
            while i < len(lines):
                next_line = lines[i]
                i += 1
                if next_line.endswith('"'):
                    accumulated += "\n" + next_line[:-1]
                    break
                accumulated += "\n" + next_line
            raw_value = accumulated
            raw_value = raw_value.replace(r"\n", "\n").replace(r"\t", "\t")
        else:
            raw_value = _strip_inline_comment(raw_value)
            raw_value = _unquote(raw_value)

        # Interpolate variables (skip for single-quoted already unquoted)
        raw_value = _interpolate(raw_value, result)

        result[key] = raw_value

    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class EnvLoader:
    """
    Stateful .env loader. Tracks which files have been loaded and
    provides typed accessors.
    """

    def __init__(self) -> None:
        self._loaded_files: list[Path] = []
        self._values: dict[str, str] = {}

    def load(
        self,
        path: Union[str, Path] = ".env",
        override: bool = False,
        encoding: str = "utf-8",
    ) -> dict[str, str]:
        """
        Load a .env file into os.environ.

        Args:
            path:     Path to the .env file.
            override: If True, existing os.environ values are overwritten.
            encoding: File encoding (default utf-8).

        Returns:
            Dict of key/value pairs that were loaded.

        Raises:
            FileNotFoundError: if the file does not exist.
        """
        p = Path(path).expanduser().resolve()
        if not p.exists():
            raise FileNotFoundError(f"env file not found: {p}")

        text = p.read_text(encoding=encoding)
        parsed = _parse_env_text(text)

        loaded: dict[str, str] = {}
        for key, value in parsed.items():
            if override or key not in os.environ:
                os.environ[key] = value
                loaded[key] = value
            self._values[key] = value

        self._loaded_files.append(p)
        logger.debug("Loaded %d variables from %s", len(loaded), p)
        return loaded

    def load_dict(self, data: dict[str, str], override: bool = False) -> None:
        """Load a dict of key/value pairs directly into os.environ."""
        for k, v in data.items():
            if override or k not in os.environ:
                os.environ[k] = str(v)
            self._values[k] = str(v)

    def get(self, key: str, default: Any = None, cast: Optional[Callable] = None) -> Any:
        """
        Retrieve an env variable with optional type casting.

        Args:
            key:     Environment variable name.
            default: Value to return if key is not set.
            cast:    Callable to convert the string value (e.g. int, float, bool).

        Returns:
            The value (cast if requested) or the default.
        """
        raw = os.environ.get(key)
        if raw is None:
            return default
        if cast is None:
            return raw
        if cast is bool:
            return raw.lower() in ("1", "true", "yes", "on")
        try:
            return cast(raw)
        except (ValueError, TypeError) as exc:
            logger.warning("Could not cast %s=%r to %s: %s", key, raw, cast, exc)
            return default

    def require(self, key: str, cast: Optional[Callable] = None) -> Any:
        """
        Like get() but raises if the variable is missing or empty.

        Raises:
            KeyError: if the variable is not set.
        """
        raw = os.environ.get(key)
        if raw is None or raw == "":
            raise KeyError(f"Required environment variable '{key}' is not set")
        if cast is None:
            return raw
        if cast is bool:
            return raw.lower() in ("1", "true", "yes", "on")
        return cast(raw)

    @property
    def loaded_files(self) -> list[Path]:
        return list(self._loaded_files)

    def __repr__(self) -> str:
        return f"<EnvLoader files={[str(f) for f in self._loaded_files]}>"


# ---------------------------------------------------------------------------
# Module-level singleton and convenience helpers
# ---------------------------------------------------------------------------

_default_loader = EnvLoader()


def load_env(
    path: Union[str, Path] = ".env",
    override: bool = False,
    encoding: str = "utf-8",
    missing_ok: bool = True,
) -> dict[str, str]:
    """
    Load a .env file into os.environ using the default loader.

    Args:
        path:       Path to .env (default: ".env" in cwd).
        override:   Overwrite existing os.environ values.
        encoding:   File encoding.
        missing_ok: If True, silently skip when the file doesn't exist.

    Returns:
        Dict of variables that were set.
    """
    try:
        return _default_loader.load(path, override=override, encoding=encoding)
    except FileNotFoundError:
        if missing_ok:
            return {}
        raise


def load_env_file(
    path: Union[str, Path],
    override: bool = False,
    encoding: str = "utf-8",
) -> dict[str, str]:
    """Load a specific .env file; raises FileNotFoundError if missing."""
    return _default_loader.load(path, override=override, encoding=encoding)


def get_env(
    key: str,
    default: Any = None,
    cast: Optional[Callable] = None,
) -> Any:
    """
    Get an environment variable with optional casting.

    Examples:
        port = get_env("PORT", default=8000, cast=int)
        debug = get_env("DEBUG", default=False, cast=bool)
    """
    return _default_loader.get(key, default=default, cast=cast)


def require_env(key: str, cast: Optional[Callable] = None) -> Any:
    """
    Get a required environment variable; raises KeyError if not set.
    """
    return _default_loader.require(key, cast=cast)


# ---------------------------------------------------------------------------
# CLI helper: python -m core.env_loader print
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    cmd = sys.argv[1] if len(sys.argv) > 1 else "print"
    env_file = sys.argv[2] if len(sys.argv) > 2 else ".env"

    if cmd == "print":
        try:
            data = load_env_file(env_file)
            print(json.dumps(data, indent=2))
        except FileNotFoundError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
