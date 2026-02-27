#!/usr/bin/env bun
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";

interface ParsedEvent {
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  type: "user" | "assistant" | "system" | "progress";
  subtype?: string;
  role?: string;
  message?: unknown;
  toolUseResult?: unknown;
  data?: Record<string, unknown>;
  duration?: number;
  model?: string;
  messageId?: string;
}

interface FileEdit {
  tool: "Write" | "Edit";
  filePath: string;
  timestamp: string;
}

interface SessionAnalysis {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  totalTurns: number;
  totalErrors: number;
  commands: string[];
  toolCalls: Array<{
    tool: string;
    input: Record<string, unknown>;
    result?: string;
    isError: boolean;
    duration?: number;
  }>;
  fileEdits: FileEdit[];
  subagents: string[];
  errors: Array<{
    timestamp: string;
    message: string;
    tool?: string;
  }>;
  conversation: Array<{
    turn: number;
    role: "user" | "assistant";
    timestamp: string;
    content?: string;
    duration?: number;
    model?: string;
  }>;
}

// Skill invocations inject the full command prompt as a user message starting with "# /command-name".
// These are system boilerplate — collapse to just the header line.
const SKILL_PROMPT_RE = /^# \//;

function extractTextContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;

  const parts: string[] = [];
  for (const c of content) {
    if (typeof c === "object" && c !== null) {
      const obj = c as Record<string, unknown>;
      // Only extract plain text — tool_use blocks are captured in extractToolCalls,
      // and tool_result blocks duplicate what's stored in toolCalls[].result.
      if (obj.type === "text") parts.push(obj.text as string);
    }
  }

  const joined = parts.filter(Boolean).join("\n").trim();
  return joined || undefined;
}

function collapseSkillPrompt(content: string): string {
  if (!SKILL_PROMPT_RE.test(content)) return content;
  const firstLine = content.split("\n")[0];
  return `${firstLine}\n[skill prompt omitted]`;
}

function stripWriteEditContent(input: Record<string, unknown>, tool: string): Record<string, unknown> {
  if (tool === "Write" && input.content) {
    return { ...input, content: "[omitted]" };
  }
  if (tool === "Edit" && (input.new_string || input.old_string)) {
    return { ...input, new_string: "[omitted]", old_string: "[omitted]" };
  }
  return input;
}

function extractToolCalls(content: unknown): Array<{
  tool: string;
  input: Record<string, unknown>;
  isError: boolean;
}> | undefined {
  if (!Array.isArray(content)) return undefined;

  const toolCalls: Array<{
    tool: string;
    input: Record<string, unknown>;
    isError: boolean;
  }> = [];

  for (const c of content) {
    if (typeof c === "object" && c !== null) {
      const obj = c as Record<string, unknown>;
      if (obj.type === "tool_use" && obj.name) {
        const tool = obj.name as string;
        const raw = (obj.input || {}) as Record<string, unknown>;
        toolCalls.push({
          tool,
          input: stripWriteEditContent(raw, tool),
          isError: false,
        });
      }
    }
  }

  return toolCalls.length > 0 ? toolCalls : undefined;
}

function extractCommand(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;

  for (const c of content) {
    if (typeof c === "object" && c !== null) {
      const obj = c as Record<string, unknown>;
      if (obj.type === "text") {
        const text = obj.text as string;
        const match = text.match(/\/[\w-]+:[\w-]+/);
        if (match) return match[0];
      }
    }
  }
  return undefined;
}

async function findMainSession(dir: string): Promise<string | null> {
  const files = await readdir(dir);
  const sessions = files
    .filter((f) => f.endsWith(".jsonl") && !f.includes("subagents"))
    .map((f) => ({ name: f, path: join(dir, f) }));

  if (sessions.length === 0) return null;

  let mainSession = sessions[0];
  let maxSize = 0;

  for (const session of sessions) {
    try {
      const stats = await readFile(session.path);
      if (stats.length > maxSize) {
        maxSize = stats.length;
        mainSession = session;
      }
    } catch {
      // skip
    }
  }

  return mainSession.name;
}

async function findSubagents(sessionDir: string): Promise<string[]> {
  const subagentDir = join(sessionDir, "subagents");
  if (!existsSync(subagentDir)) return [];

  const files = await readdir(subagentDir);
  return files.filter((f) => f.endsWith(".jsonl"));
}

async function parseSession(sessionPath: string, subagentNames: string[]): Promise<SessionAnalysis> {
  const content = await readFile(sessionPath, "utf-8");
  const lines = content.split("\n").filter(Boolean);

  const events: ParsedEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip invalid JSON
    }
  }

  const sessionId = basename(sessionPath, ".jsonl");
  const commands: string[] = [];
  const errors: SessionAnalysis["errors"] = [];
  const toolCalls: SessionAnalysis["toolCalls"] = [];
  const fileEdits: FileEdit[] = [];
  const conversation: SessionAnalysis["conversation"] = [];

  let turn = 0;
  let startedAt = "";
  let endedAt = "";
  let lastTimestamp = "";

  for (const event of events) {
    lastTimestamp = event.timestamp || lastTimestamp;

    if (!startedAt && event.timestamp) {
      startedAt = event.timestamp;
    }

    if (event.type === "user") {
      const cmd = extractCommand(event.message?.content);
      if (cmd) commands.push(cmd);

      turn++;
      const rawContent = extractTextContent(event.message?.content);
      const content = rawContent ? collapseSkillPrompt(rawContent) : undefined;

      // Drop turns that are pure tool-result echoes with no meaningful content
      if (!content || content.trim().length < 20) continue;

      conversation.push({
        turn,
        role: "user",
        timestamp: event.timestamp,
        content,
      });
    }

    if (event.type === "assistant") {
      const toolCallsInMsg = extractToolCalls(event.message?.content);
      const content = extractTextContent(event.message?.content);

      // Drop assistant turns with no text and no tool calls
      if (!content && !toolCallsInMsg) continue;

      conversation.push({
        turn,
        role: "assistant",
        timestamp: event.timestamp,
        content: content || undefined,
        model: event.message?.model,
      });

      if (toolCallsInMsg) {
        for (const tc of toolCallsInMsg) {
          toolCalls.push({ ...tc, isError: false });

          if (tc.tool === "Write" || tc.tool === "Edit") {
            fileEdits.push({
              tool: tc.tool,
              filePath: tc.input.file_path as string,
              timestamp: event.timestamp,
            });
          }
        }
      }
    }

    if (event.type === "system" && event.subtype === "turn_duration") {
      if (conversation.length > 0) {
        conversation[conversation.length - 1].duration = event.duration;
      }
      endedAt = event.timestamp;
    }

    if (event.type === "user" && event.toolUseResult) {
      const result = event.toolUseResult as Record<string, unknown>;
      const isError = result.is_error === true;

      if (isError) {
        const errorMsg =
          typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content)?.slice(0, 500);

        errors.push({
          timestamp: event.timestamp,
          message: errorMsg,
          tool: result.tool_use_id as string,
        });

        if (toolCalls.length > 0) {
          toolCalls[toolCalls.length - 1].isError = true;
          toolCalls[toolCalls.length - 1].result = errorMsg;
        }
      } else {
        const resultStr =
          typeof result.content === "string"
            ? result.content.slice(0, 500)
            : JSON.stringify(result.content)?.slice(0, 500);

        if (toolCalls.length > 0) {
          toolCalls[toolCalls.length - 1].result = resultStr;
        }
      }
    }

    if (event.type === "progress" && event.data?.type === "api_error") {
      errors.push({
        timestamp: event.timestamp,
        message: (event.data.error as string) || "API error",
      });
    }
  }

  return {
    sessionId,
    startedAt,
    endedAt: endedAt || lastTimestamp,
    totalTurns: turn,
    totalErrors: errors.length,
    commands: [...new Set(commands)],
    toolCalls,
    fileEdits,
    subagents: subagentNames,
    errors,
    conversation,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const mainOnly = args.includes("--main-only");
  const logsPath = args.find((a) => !a.startsWith("--")) || process.cwd();
  const outputDir = process.cwd();

  const mainSession = await findMainSession(logsPath);
  if (!mainSession) {
    console.error("No session found in:", logsPath);
    process.exit(1);
  }

  console.log(`Found main session: ${mainSession}`);

  const sessionPath = join(logsPath, mainSession);
  const subagents = mainOnly
    ? []
    : await findSubagents(join(logsPath, mainSession.replace(".jsonl", "")));

  if (mainOnly) {
    console.log("Skipping subagents (--main-only)");
  } else {
    console.log(`Found ${subagents.length} subagent sessions`);
  }

  const analysis = await parseSession(sessionPath, subagents);

  const outputPath = join(outputDir, "analysis.json");
  await writeFile(outputPath, JSON.stringify(analysis, null, 2));

  console.log(`\n=== Session Analysis ===`);
  console.log(`Session ID: ${analysis.sessionId}`);
  console.log(`Started:    ${analysis.startedAt}`);
  console.log(`Ended:      ${analysis.endedAt}`);
  console.log(`Turns:      ${analysis.totalTurns}`);
  console.log(`Errors:     ${analysis.totalErrors}`);
  console.log(`Commands:   ${analysis.commands.join(", ")}`);
  console.log(`Tool calls: ${analysis.toolCalls.length}`);
  console.log(`File edits: ${analysis.fileEdits.length}`);
  console.log(`Subagents:  ${analysis.subagents.length}`);

  if (analysis.errors.length > 0) {
    console.log(`\n=== Errors ===`);
    for (const err of analysis.errors) {
      console.log(`[${err.timestamp}] ${err.message.slice(0, 200)}`);
    }
  }

  console.log(`\nFull analysis written to: ${outputPath}`);
}

main().catch(console.error);
