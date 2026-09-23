import { describe, expect, it } from "vitest";

const { stripEosSentinel } = await import("../../open-sse/translator/concerns/eosStrip.js");
const { toClaudeMessageShape } = await import("../../open-sse/translator/concerns/claudeShape.js");

// An OpenAI-shape body as returned by a claude-transport executor (opencode/
// big-pickle): no type:"message", choices[] present. This is what an Anthropic
// client request gets today via the CLAUDE→CLAUDE path needsTranslation skips.
const OPENAI_BODY = {
  id: "chatcmpl-abc123",
  object: "chat.completion",
  created: 1789056634,
  model: "big-pickle",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "OK", tool_calls: null },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
};

describe("stripEosSentinel", () => {
  it("removes trailing <|im_end|>", () => {
    expect(stripEosSentinel("OK<|im_end|>")).toBe("OK");
  });

  it("removes trailing <|endoftext|> and <|eot_id|>", () => {
    expect(stripEosSentinel("hi<|endoftext|>")).toBe("hi");
    expect(stripEosSentinel("hi<|eot_id|>")).toBe("hi");
  });

  it("leaves normal text untouched", () => {
    expect(stripEosSentinel("plain answer")).toBe("plain answer");
    expect(stripEosSentinel("")).toBe("");
    expect(stripEosSentinel(null)).toBeNull();
  });
});

describe("toClaudeMessageShape (Anthropic non-stream guard)", () => {
  it("converts OpenAI body to Claude message", () => {
    const out = toClaudeMessageShape(structuredClone(OPENAI_BODY));
    expect(out.type).toBe("message");
    expect(out.content).toEqual([{ type: "text", text: "OK" }]);
    expect(out.stop_reason).toBe("end_turn");
    expect(out.stop_sequence).toBeNull();
    expect(out.usage).toEqual({ input_tokens: 10, output_tokens: 2 });
  });

  it("leaves an already-Claude message untouched", () => {
    const claudeBody = {
      id: "msg_abc",
      type: "message",
      role: "assistant",
      model: "claude",
      content: [{ type: "text", text: "OK" }],
      stop_reason: "end_turn",
    };
    expect(toClaudeMessageShape(claudeBody)).toBe(claudeBody);
  });

  it("converts tool_calls to tool_use blocks", () => {
    const body = structuredClone(OPENAI_BODY);
    body.choices[0].message.tool_calls = [
      { id: "call_1", type: "function", function: { name: "read", arguments: "{\"path\":\"/x\"}" } },
    ];
    body.choices[0].finish_reason = "tool_calls";
    const out = toClaudeMessageShape(body);
    const toolBlock = out.content.find((c) => c.type === "tool_use");
    expect(toolBlock.name).toBe("read");
    expect(toolBlock.id).toBe("call_1");
    expect(toolBlock.input).toEqual({ path: "/x" });
    expect(out.stop_reason).toBe("tool_use");
  });
});