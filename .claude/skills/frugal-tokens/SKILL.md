---
name: frugal-tokens
description: Minimize LLM token usage aggressively to stay under API cost caps. Use this skill whenever building AI-powered features, writing prompts, designing multi-step LLM pipelines, calling the Anthropic API (or any LLM API), or reviewing code that makes LLM calls. Trigger any time the user is thinking about token budgets, prompt design, context window management, or reducing AI API costs. Also use when the user mentions being on a tight API budget, hitting rate limits, or wanting to "keep costs down" with LLM calls. Every token counts — treat the context window like a scarce resource.
---

# Frugal Token Skill

> **Mindset**: You are a broke developer. Every token is a fraction of a cent you cannot
> get back. Your API bill is coming at the end of the month. Think before you prompt.

---

## The Core Rules

### 1. Use the smallest model that can do the job
| Task | Use |
|------|-----|
| Classification, routing, yes/no | `claude-haiku-4-5` |
| Summarization, extraction, simple Q&A | `claude-haiku-4-5` |
| Complex reasoning, multi-step tasks | `claude-sonnet-4-6` |
| Research, very hard coding, nuanced writing | `claude-opus-4-6` (last resort) |

**Default to Haiku. Upgrade only when Haiku fails.**

### 2. Set `max_tokens` tightly
Never leave `max_tokens` at the default ceiling. Ask: what's the longest reasonable response?
- Yes/no classification → `max_tokens: 5`
- Single label extraction → `max_tokens: 20`
- Short summary → `max_tokens: 150`
- Code snippet → `max_tokens: 500`
- Full document → `max_tokens: 1000`

Wasted output tokens are money left burning on the table.

### 3. Trim the system prompt ruthlessly
Every word in a system prompt is paid on **every single call**. Audit mercilessly:
- Remove pleasantries, filler, redundant instructions
- Use bullet points not paragraphs
- Cut anything the model already knows by default
- If a rule is covered by the model's base behavior, delete it

**Bad**: "You are a helpful AI assistant. Please be polite and professional at all times. When answering questions, make sure to provide accurate information and cite your sources when applicable."
**Good**: "Answer concisely. Cite sources."

### 4. Compress user input before sending
Before stuffing a user's document/data into a prompt:
- Truncate to only the relevant section
- Strip whitespace, comments, boilerplate
- Summarize long documents first, then operate on the summary
- For structured data: send only needed columns/fields

### 5. Cache aggressively
- **Prompt caching**: If using Anthropic API, use `cache_control` on static system prompts and long documents — cached tokens cost ~10% of normal input tokens
- **Application-level cache**: If the same question + context will recur, cache the response. Don't re-call the API for the same inputs.
- **Embed + retrieve**: For large knowledge bases, use embeddings + vector search to fetch only relevant chunks. Don't dump the whole doc.

### 6. Batch when possible
- Group multiple small requests into one call (e.g., classify 10 items in one prompt)
- Use structured output to get multiple answers at once
- Avoid N calls in a loop — design prompts that handle lists

### 7. Kill the conversation history bloat
Multi-turn conversations accumulate tokens fast:
- Summarize old turns periodically instead of sending raw history
- Drop system prompt repetition from history
- Only include the last N turns if earlier context is stale
- Store facts extracted from conversation, not raw conversation

---

## Prompt Design for Frugality

### Output format control
Force short outputs by constraining the format:
```
Bad:  "Tell me the sentiment of this text."
Good: "Classify sentiment. Reply with one word: positive, negative, or neutral."
```

Specify format so the model doesn't pad:
```
Bad:  "Extract the name."
Good: "Extract the full name. Reply with only the name, nothing else."
```

### Avoid chain-of-thought when you don't need it
`"Think step by step"` is expensive — it generates lots of reasoning tokens you pay for.
Use it only when accuracy matters more than cost. For simple tasks, it's waste.

### Front-load constraints
Put output constraints at the **start** of the prompt, not the end. The model reads the whole prompt before generating, but users of streaming truncate early — putting limits first makes them more likely to be respected.

```
Good: "Reply in ≤50 words. Summarize: [text]"
Bad:  "Summarize: [text]. Keep your answer under 50 words."
```

### Use `stop` sequences
For classification or extraction, set stop sequences to halt generation immediately:
```json
{ "stop_sequences": ["\n", ".", ","] }
```
Stops the model after the first word for single-label tasks.

---

## Code Patterns

### ✅ Frugal API call pattern
```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-haiku-4-5-20251001",  // Cheapest capable model
    max_tokens: 50,                       // Tight ceiling
    system: "Classify intent. Reply: question | command | statement",  // Minimal system prompt
    messages: [{ role: "user", content: input.slice(0, 500) }],  // Truncated input
    stop_sequences: ["\n"],               // Stop after first line
  })
});
```

### ❌ Token-burning anti-patterns
```javascript
// WASTEFUL: huge max_tokens, fat system prompt, no truncation
const response = await fetch("https://api.anthropic.com/v1/messages", {
  body: JSON.stringify({
    model: "claude-opus-4-6",           // ❌ Most expensive model for a simple task
    max_tokens: 4096,                    // ❌ Leaving money on the table
    system: longWindedSystemPrompt,      // ❌ Paid on every call
    messages: [
      ...fullConversationHistory,        // ❌ Unbounded history
      { role: "user", content: entireDocument }  // ❌ Untruncated input
    ]
  })
});
```

### Prompt caching (Anthropic API)
```javascript
// Cache the expensive static system prompt
{
  system: [{
    type: "text",
    text: longSystemPrompt,
    cache_control: { type: "ephemeral" }  // ✅ ~90% cheaper on cache hits
  }],
  messages: [{ role: "user", content: dynamicUserInput }]
}
```

---

## Pre-Call Checklist

Before every LLM API call, ask yourself:

- [ ] Is this the cheapest model that can actually do this task?
- [ ] Is `max_tokens` set to the minimum reasonable value?
- [ ] Is the system prompt as short as it can be while still working?
- [ ] Is the user input trimmed to only what's needed?
- [ ] Could this be batched with other calls?
- [ ] Is there a cached result I can use instead?
- [ ] Do I need chain-of-thought, or is a direct answer fine?
- [ ] Have I set stop sequences for short-answer tasks?

**If you can't check all boxes, fix the ones you can before calling.**

---

## When to Spend More Tokens

Not every token saved is worth it. Spend more when:
- Accuracy is critical (medical, financial, legal decisions)
- A cheap model fails the task after 1-2 tries
- A longer prompt prevents expensive retry loops
- The cost of a wrong answer exceeds the cost of more tokens

**Frugality is about waste elimination, not starvation. Feed the model what it needs — nothing more.**
