"""
Stream progress tracker for Ralph loop runs.
By default it uses CodeBuddy CLI with stream-json output, and can fallback
to `agent` for backward compatibility.
Parses NDJSON and prints progress (model, char count, tool calls, result).
Exits with the agent process exit code.
"""
from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
import sys
import time


def safe_get(obj: dict, *keys: str, default: str = ""):
    for key in keys:
        try:
            obj = obj[key]
        except (KeyError, TypeError):
            return default
    return obj if isinstance(obj, str) else default


def build_agent_command(prompt: str) -> list[str]:
    """Build command for Ralph agent execution.

    Environment variables:
    - RALPH_AGENT_CMD: full command (highest priority)
    - RALPH_AGENT_EXEC: executable name (default: codebuddy)
    - RALPH_AGENT_FLAGS: flags for executable
    """
    full_cmd = os.environ.get("RALPH_AGENT_CMD", "").strip()
    if full_cmd:
        return shlex.split(full_cmd) + [prompt]

    exec_name = os.environ.get("RALPH_AGENT_EXEC", "codebuddy").strip() or "codebuddy"
    explicit_flags = os.environ.get("RALPH_AGENT_FLAGS")

    using_codebuddy = exec_name.lower() == "codebuddy"
    if explicit_flags is None:
        flags = "--model glm-5.0-ioa --dangerously-skip-permissions" if using_codebuddy else "-p --force"
    else:
        flags = explicit_flags.strip()

    # Backward compatibility: if default codebuddy is not available, fallback to agent.
    if using_codebuddy and shutil.which(exec_name) is None and shutil.which("agent") is not None:
        exec_name = "agent"
        using_codebuddy = False
        if explicit_flags is None:
            flags = "-p --force"

    cmd_args = [exec_name]
    if flags:
        cmd_args.extend(shlex.split(flags))

    # stream-json is required for this progress parser.
    cmd_args.extend(["--output-format", "stream-json"])

    if using_codebuddy:
        # codebuddy requires --print/-p for non-interactive stream-json output.
        if "-p" not in cmd_args and "--print" not in cmd_args:
            cmd_args.insert(1, "-p")
    else:
        # keep existing behavior for Cursor CLI agent.
        cmd_args.append("--stream-partial-output")

    cmd_args.append(prompt)
    return cmd_args


def main() -> int:
    if len(sys.argv) < 2:
        prompt = "Complete one story from prd.json and commit"
    else:
        prompt = sys.argv[1]

    print("Streaming...", flush=True)

    char_count = 0
    segment_text = ""  # already printed in current assistant segment (for dedup)
    tool_count = 0
    start_time = time.time()

    # Use shell=True on Windows so .cmd/.exe commands resolve via PATH.
    cmd_args = build_agent_command(prompt)
    cmd_str = subprocess.list2cmdline(cmd_args)
    proc = subprocess.Popen(
        cmd_str,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        shell=True,
    )

    assert proc.stdout is not None
    last_line_inline = False

    for line in proc.stdout:
        line = line.rstrip("\n\r")
        if not line.strip():
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue

        event_type = data.get("type") or ""
        subtype = data.get("subtype") or ""

        if event_type == "system" and subtype == "init":
            model = data.get("model") or "unknown"
            print(f"Model: {model}", flush=True)

        elif event_type == "assistant":
            content_list = (data.get("message") or {}).get("content") or []
            if content_list and isinstance(content_list[0], dict):
                text = content_list[0].get("text") or ""
            else:
                text = ""
            if last_line_inline:
                print(flush=True)
            # Dedup: stream may send deltas then same content again (cumulative)
            if text == segment_text:
                continue
            if segment_text and text.startswith(segment_text):
                to_print = text[len(segment_text) :]
                segment_text = text
            else:
                to_print = text
                segment_text += text
            char_count += len(to_print)
            if char_count == len(to_print) and to_print.strip():
                print(">> ", end="", flush=True)
            if to_print:
                print(to_print, end="", flush=True)
            last_line_inline = True

        elif event_type == "tool_call":
            segment_text = ""
            tc = data.get("tool_call") or {}
            if subtype == "started":
                tool_count += 1
                if last_line_inline:
                    print(flush=True)
                    last_line_inline = False
                if "writeToolCall" in tc:
                    path = safe_get(tc, "writeToolCall", "args", "path") or "unknown"
                    print(f"Tool #{tool_count}: write {path}", flush=True)
                elif "readToolCall" in tc:
                    path = safe_get(tc, "readToolCall", "args", "path") or "unknown"
                    print(f"Tool #{tool_count}: read {path}", flush=True)
                else:
                    print(f"Tool #{tool_count}: call", flush=True)
            elif subtype == "completed":
                if "writeToolCall" in tc:
                    res = (tc.get("writeToolCall") or {}).get("result") or {}
                    succ = res.get("success") or {}
                    lines = succ.get("linesCreated", 0)
                    size = succ.get("fileSize", 0)
                    print(f"   done: {lines} lines ({size} bytes)", flush=True)
                elif "readToolCall" in tc:
                    res = (tc.get("readToolCall") or {}).get("result") or {}
                    succ = res.get("success") or {}
                    lines = succ.get("totalLines", 0)
                    print(f"   done: {lines} lines read", flush=True)

        elif event_type == "result":
            segment_text = ""
            if last_line_inline:
                print(flush=True)
            duration_ms = data.get("duration_ms") or 0
            total_sec = int(time.time() - start_time)
            print(
                f"\nDone in {duration_ms}ms (total {total_sec}s)",
                flush=True,
            )
            print(
                f"Stats: {tool_count} tools, {char_count} chars",
                flush=True,
            )

    proc.wait()
    return proc.returncode if proc.returncode is not None else 0


if __name__ == "__main__":
    sys.exit(main())
