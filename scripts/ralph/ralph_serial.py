"""
Serial Ralph loop: run Cursor CLI (agent) until every story in prd.json has passes=true.
Each iteration runs: agent -p --force "完成一个 prd.json 的 story 并提交"
"""
from __future__ import annotations

import json
import os
import subprocess
import sys


def repo_root() -> str:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(script_dir, "..", ".."))


def prd_path(root: str) -> str:
    return os.path.join(root, "prd.json")


def has_failing_stories(root: str) -> bool:
    path = prd_path(root)
    if not os.path.isfile(path):
        return False
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    stories = data.get("userStories") or []
    return any(not s.get("passes", False) for s in stories)


def run_agent(root: str) -> int:
    prompt = "完成一个 prd.json 的 story 并提交"
    cmd = ["agent", "-p", "--force", prompt]
    return subprocess.call(cmd, cwd=root, shell=False)


def main() -> int:
    root = repo_root()
    iteration = 0
    while has_failing_stories(root):
        iteration += 1
        print(f"[ralph-serial] iteration {iteration}")
        code = run_agent(root)
        if code != 0:
            print(f"[ralph-serial] agent exited with code {code}")
            return code
    print("[ralph-serial] all stories pass; done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
