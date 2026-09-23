import { describe, expect, it } from "vitest";

const { parseSSEToOpenAIResponse } = await import("../../open-sse/handlers/chatCore/sseToJsonHandler.js");
const { toClaudeMessageShape } = await import("../../open-sse/translator/concerns/claudeShape.js");

// SSE fixture of an OpenAI chat streaming provider (eg big-pickle forced
// streaming): text deltas + reasoning + tool_calls + usage.
const OPENAI_SSE = [
  "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"created\":1000,\"model\":\"big-pickle\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"\",\"reasoning_content\":\"let me think\"},\"finish_reason\":null}]}",
  "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"created\":1000,\"model\":\"big-pickle\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"Hel\"},\"finish_reason\":null}]}",
  "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"created\":1000,\"model\":\"big-pickle\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"lo\"},\"finish_reason\":null}]}",
  "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"created\":1000,\"model\":\"big-pickle\",\"choices\":[{\"index\":0,\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"{\\\"city\\\":\\\"Jakarta\\\"}\"}}]},\"finish_reason\":null}]}",
  "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"created\":1000,\"model\":\"big-pickle\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"tool_calls\"}],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":20,\"total_tokens\":30}}",
  "data: [DONE]"
].join("\n");

describe("parseSSEToOpenAIResponse (forced streaming → JSON)", () => {
  it("reassembles content, reasoning, tool_calls, finish_reason, usage", () => {
    const parsed = parseSSEToOpenAIResponse(OPENAI_SSE, "big-pickle");
    expect(parsed.object).toBe("chat.completion");
    expect(parsed.choices[0].message.content).toBe("Hello");
    expect(parsed.choices[0].message.reasoning_content).toBe("let me think");
    expect(parsed.choices[0].message.tool_calls).toHaveLength(1);
    expect(parsed.choices[0].message.tool_calls[0].function.name).toBe("get_weather");
    expect(parsed.choices[0].message.tool_calls[0].function.arguments).toContain("Jakarta");
    expect(parsed.choices[0].finish_reason).toBe("tool_calls");
    expect(parsed.usage.total_tokens).toBe(30);
  });

  it("returns null for empty / malformed SSE", () => {
    expect(parseSSEToOpenAIResponse("", "m")).toBeNull();
    expect(parseSSEToOpenAIResponse("data: [DONE]", "m")).toBeNull();
  });
});

describe("sseToJson Anthropic guard (sourceFormat=CLAUDE)", () => {
  it("converts parsed OpenAI body to Claude message shape", () => {
    const parsed = parseSSEToOpenAIResponse(OPENAI_SSE, "big-pickle");
    const out = toClaudeMessageShape(parsed);

    expect(out.type).toBe("message");
    expect(out.role).toBe("assistant");
    expect(Array.isArray(out.content)).toBe(true);
    expect(out.content[0].type).toBe("thinking");
    expect(out.content[0].thinking).toBe("let me think");
    expect(out.content[1].type).toBe("text");
    expect(out.content[1].text).toBe("Hello");
    expect(out.content[2].type).toBe("tool_use");
    expect(out.content[2].name).toBe("get_weather");
    expect(out.stop_reason).toBe("tool_use");
    expect(out.usage.input_tokens).toBe(10);
    expect(out.usage.output_tokens).toBe(20);
  });
});