// EOS sentinel strip for translated streaming text.
//
// Some upstream executors/providers (observed: opencode/big-pickle behind a
// claude transport) append their special end-of-stream token verbatim to the
// final text delta — e.g. "OK<|im_end|>" — because the tokenizer emits it and
// the executor's OpenAI-compatible decoder passes it through as content. An
// Anthropic client receiving such a delta renders the literal marker in the
// transcript (and a strict schema check flags the unknown character run).
// Stripping is safe: these tokens only ever appear exactly once, as a suffix
// of the final chunk, and never carry meaning in a translated stream.
const EOS_SENTINELS = [
  "<|im_end|>",
  "<|endoftext|>",
  "<|eot_id|>",
  "<|end|>",
];

/** Remove a trailing EOS sentinel from streaming text (suffix-only, once). */
export function stripEosSentinel(text) {
  if (!text || typeof text !== "string") return text;
  for (const sentinel of EOS_SENTINELS) {
    if (text.endsWith(sentinel)) {
      return text.slice(0, -sentinel.length);
    }
  }
  // Some providers emit it mid-chunk boundary (sentinel split across two
  // deltas) — strip any occurrence, since these tokens have no legitimate
  // place in model output.
  const hasAny = EOS_SENTINELS.find((s) => text.includes(s));
  if (hasAny) return text.split(hasAny).join("");
  return text;
}