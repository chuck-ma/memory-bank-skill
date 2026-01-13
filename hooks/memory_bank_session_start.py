#!/usr/bin/env python3
"""
Memory Bank SessionStart Hook for Claude Code

Automatically injects Memory Bank context (brief.md + active.md + _index.md)
into Claude's session context when a new session starts.

Usage:
  Configure in .claude/settings.json:
  {
    "hooks": {
      "SessionStart": [{
        "matcher": "startup|clear|compact",
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/memory_bank_session_start.py\""
        }]
      }]
    }
  }

Environment Variables:
  CLAUDE_PROJECT_DIR: Project root directory (set by Claude Code)
  MEMORY_BANK_MAX_CHARS: Override default character limit (default: 12000)
"""

import json
import os
import sys
from pathlib import Path
from typing import Optional

MAX_CHARS = int(os.environ.get("MEMORY_BANK_MAX_CHARS", "12000"))
TRUNCATION_NOTICE = "\n\n---\n\n[TRUNCATED] Memory Bank context exceeded size limit. Read files directly for complete content."
TRUNCATION_RESERVE = len(TRUNCATION_NOTICE)

MEMORY_BANK_FILES = [
    ("brief", "memory-bank/brief.md"),
    ("active", "memory-bank/active.md"),
    ("index", "memory-bank/_index.md"),
]


def read_file_safe(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None


def build_context(project_root: Path) -> Optional[str]:
    mb_dir = project_root / "memory-bank"

    if not mb_dir.exists():
        return None

    parts = []
    for label, rel_path in MEMORY_BANK_FILES:
        file_path = project_root / rel_path
        if file_path.exists():
            content = read_file_safe(file_path)
            if content:
                parts.append(f"## {rel_path}\n\n{content.strip()}")

    if not parts:
        return None

    header = (
        "# Memory Bank Bootstrap (Auto-injected on SessionStart)\n\n"
        "Use `memory-bank/_index.md` to locate additional context files.\n"
        "Read more files from `memory-bank/` as needed based on the task.\n\n"
        "---\n\n"
    )

    return header + "\n\n---\n\n".join(parts)


def main():
    try:
        hook_input = json.load(sys.stdin)
    except Exception:
        hook_input = {}

    project_dir = (
        os.environ.get("CLAUDE_PROJECT_DIR") or hook_input.get("cwd") or os.getcwd()
    )
    project_root = Path(project_dir)

    context = build_context(project_root)

    if not context:
        sys.exit(0)

    if len(context) > MAX_CHARS:
        context = context[: MAX_CHARS - TRUNCATION_RESERVE] + TRUNCATION_NOTICE

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
    }

    sys.stdout.write(json.dumps(output, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
