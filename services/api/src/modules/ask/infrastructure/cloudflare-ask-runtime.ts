import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ChatMessage } from "../application/ask-answer.js";
import { ASK_FALLBACK_MODEL, ASK_GATEWAY_ID } from "../application/ask-policy.js";
import type { AskModelClient, AskRateLimiter, AskRuntimeBindings, AskSearchIndex, RetrievedChunk } from "../application/ask.ports.js";

// The subset of the Workers AI, AI Search and Rate Limiting bindings this module calls.
interface WorkersAiBinding {
  run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

interface AiSearchBinding {
  search(request: Record<string, unknown>): Promise<{ chunks?: { text?: unknown; score?: unknown; item?: { key?: unknown } }[] }>;
  items: {
    upload(name: string, content: string, options?: { metadata?: Record<string, string> }): Promise<{ id?: unknown }>;
    delete(itemId: string): Promise<unknown>;
  };
}

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface AskWorkerBindings {
  AI?: WorkersAiBinding;
  AI_SEARCH?: AiSearchBinding;
  ASK_RATE_LIMIT?: RateLimitBinding;
}

export function aiSearchIndex(binding: AiSearchBinding): AskSearchIndex {
  return {
    async search(query, maxResults): Promise<RetrievedChunk[]> {
      const result = await binding.search({
        query,
        ai_search_options: { retrieval: { max_num_results: maxResults } },
      });
      return (result.chunks ?? []).flatMap((chunk) =>
        typeof chunk.text === "string" && typeof chunk.score === "number" && typeof chunk.item?.key === "string"
          ? [{ itemKey: chunk.item.key, text: chunk.text, score: chunk.score }]
          : [],
      );
    },
    async upload(key, content, metadata) {
      const result = await binding.items.upload(key, content, { metadata });
      if (typeof result.id !== "string") throw new Error("AI Search upload returned no item id");
      return { id: result.id };
    },
    async delete(itemId) {
      await binding.items.delete(itemId);
    },
  };
}

/** Pulls the answer text out of either Workers AI response shape. */
export function modelText(output: unknown): string {
  if (typeof output !== "object" || output === null) throw new Error("Workers AI returned no output");
  const record = output as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  if (typeof record.response === "string") return record.response;
  if (typeof record.response === "object" && record.response !== null) return JSON.stringify(record.response);
  const content = record.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  throw new Error("Workers AI returned no text");
}

export function workersAiModel(binding: WorkersAiBinding): AskModelClient {
  return {
    async complete(model: string, messages: ChatMessage[], maxTokens: number) {
      const output = await binding.run(
        model,
        {
          messages,
          max_tokens: maxTokens,
          temperature: 0.1,
          // GLM reasons by default; the answer has to fit in max_tokens without it.
          ...(model === ASK_FALLBACK_MODEL ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        },
        // Every call goes through the zhipanda-ask gateway: its rate and spend limits apply, and
        // it keeps no request or response logs.
        { gateway: { id: ASK_GATEWAY_ID, skipCache: true } },
      );
      return modelText(output);
    },
  };
}

export function workersRateLimiter(binding: RateLimitBinding): AskRateLimiter {
  return {
    async allow(key) {
      return (await binding.limit({ key })).success;
    },
  };
}

/** Holds the Worker's AI bindings for the request being served. */
@Injectable()
export class AskRuntimeService {
  private readonly requests = new AsyncLocalStorage<AskRuntimeBindings>();

  public withBindings<T>(bindings: AskWorkerBindings, work: () => T): T {
    if (bindings.AI === undefined || bindings.AI_SEARCH === undefined || bindings.ASK_RATE_LIMIT === undefined) return work();
    return this.requests.run(
      {
        index: aiSearchIndex(bindings.AI_SEARCH),
        model: workersAiModel(bindings.AI),
        rateLimiter: workersRateLimiter(bindings.ASK_RATE_LIMIT),
      },
      work,
    );
  }

  public current(): AskRuntimeBindings | undefined {
    return this.requests.getStore();
  }
}
