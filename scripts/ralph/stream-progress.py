"""
Stream progress tracker for Cursor agent runs.
Runs agent with --output-format stream-json --stream-partial-output,
parses NDJSON and prints progress (model, char count, tool calls, result).
Exits with the agent process exit code.
"""
from __future__ import annotations

import json
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


def main() -> int:
    if len(sys.argv) < 2:
        prompt = "完成一个 prd.json 的 story 并提交"
    else:
        prompt = sys.argv[1]

    print("🚀 开始流式处理...", flush=True)

    accumulated_text = ""
    tool_count = 0
    start_time = time.time()

    # Use shell=True on Windows so "agent" resolves like in cmd (agent.cmd/agent.exe in PATH)
    cmd_args = [
        "agent",
        "-p",
        "--force",
        "--output-format",
        "stream-json",
        "--stream-partial-output",
        prompt,
    ]
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
            print(f"🤖 使用模型: {model}", flush=True)

        elif event_type == "assistant":
            content_list = (data.get("message") or {}).get("content") or []
            if content_list and isinstance(content_list[0], dict):
                text = content_list[0].get("text") or ""
            else:
                text = ""
            accumulated_text += text
            if last_line_inline:
                print(flush=True)
            print(f"\r📝 生成中: {len(accumulated_text)} 字符", end="", flush=True)
            last_line_inline = True

        elif event_type == "tool_call":
            tc = data.get("tool_call") or {}
            if subtype == "started":
                tool_count += 1
                if last_line_inline:
                    print(flush=True)
                    last_line_inline = False
                if "writeToolCall" in tc:
                    path = safe_get(tc, "writeToolCall", "args", "path") or "unknown"
                    print(f"🔧 工具 #{tool_count}: 创建 {path}", flush=True)
                elif "readToolCall" in tc:
                    path = safe_get(tc, "readToolCall", "args", "path") or "unknown"
                    print(f"📖 工具 #{tool_count}: 读取 {path}", flush=True)
                else:
                    print(f"🔧 工具 #{tool_count}: 调用", flush=True)
            elif subtype == "completed":
                if "writeToolCall" in tc:
                    res = (tc.get("writeToolCall") or {}).get("result") or {}
                    succ = res.get("success") or {}
                    lines = succ.get("linesCreated", 0)
                    size = succ.get("fileSize", 0)
                    print(f"   ✅ 已创建 {lines} 行 ({size} 字节)", flush=True)
                elif "readToolCall" in tc:
                    res = (tc.get("readToolCall") or {}).get("result") or {}
                    succ = res.get("success") or {}
                    lines = succ.get("totalLines", 0)
                    print(f"   ✅ 已读取 {lines} 行", flush=True)

        elif event_type == "result":
            if last_line_inline:
                print(flush=True)
            duration_ms = data.get("duration_ms") or 0
            total_sec = int(time.time() - start_time)
            print(
                f"\n🎯 完成, 耗时 {duration_ms}ms (总计 {total_sec}s)",
                flush=True,
            )
            print(
                f"📊 最终统计: {tool_count} 个工具, 生成 {len(accumulated_text)} 字符",
                flush=True,
            )

    proc.wait()
    return proc.returncode if proc.returncode is not None else 0


if __name__ == "__main__":
    sys.exit(main())
