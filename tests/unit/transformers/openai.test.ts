// OpenAI 格式转换器单元测试
// 测试 transformRequest、transformResponse、transformError、transformModelList 四个纯函数
// transformStream 延迟到 round 2 测试

import { describe, it, expect, mock } from "bun:test";
import type {
  ChatCompletionRequest,
  OllamaChatResponse,
  OllamaTagsResponse,
} from "../../../src/types";
import {
  transformRequest,
  transformResponse,
  transformError,
  transformModelList,
  transformStream,
} from "../../../src/transformers/openai";
import { createChatCompletionRequest } from "../../fixtures/request-factories";
import { MOCK_MODEL_ALIASES } from "../../fixtures/config.mock";
import {
  ollamaChatResponse,
  ollamaTagsResponse,
} from "../../fixtures/ollama-responses";

// 模拟 config 模块，使 resolveModelAlias 使用测试别名映射
mock.module("../../../src/config", () => ({
  config: {
    modelAliases: { ...MOCK_MODEL_ALIASES },
  },
}));

// ─── transformRequest ───────────────────────────────────────────────

describe("transformRequest", () => {
  it("converts basic OpenAI request to Ollama format", () => {
    const req = createChatCompletionRequest();
    const result = transformRequest(req);

    // 基本字段映射
    expect(result.stream).toBe(false);
    expect(result.messages).toEqual([{ role: "user", content: "Hello!" }]);
    // model 经过别名解析（gpt-4 → llama3.1:8b）
    expect(result.model).toBe("llama3.1:8b");
  });

  it("resolves model alias via config.modelAliases", () => {
    // gpt-4 → llama3.1:8b
    const req1 = createChatCompletionRequest({ model: "gpt-4" });
    expect(transformRequest(req1).model).toBe("llama3.1:8b");

    // gpt-3.5-turbo → qwen2.5:7b
    const req2 = createChatCompletionRequest({ model: "gpt-3.5-turbo" });
    expect(transformRequest(req2).model).toBe("qwen2.5:7b");

    // 未配置别名的模型名保持原样
    const req3 = createChatCompletionRequest({ model: "llama3.1:8b" });
    expect(transformRequest(req3).model).toBe("llama3.1:8b");
  });

  it("maps stream parameter correctly", () => {
    const streamTrue = createChatCompletionRequest({ stream: true });
    expect(transformRequest(streamTrue).stream).toBe(true);

    const streamFalse = createChatCompletionRequest({ stream: false });
    expect(transformRequest(streamFalse).stream).toBe(false);

    // stream 未设置时默认为 false
    const noStream: ChatCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "hi" }],
    };
    expect(transformRequest(noStream).stream).toBe(false);
  });

  it("maps temperature and max_tokens to Ollama options", () => {
    const req = createChatCompletionRequest({
      temperature: 0.5,
      max_tokens: 2048,
    });
    const result = transformRequest(req);

    expect(result.options.temperature).toBe(0.5);
    expect(result.options.num_predict).toBe(2048);
  });

  it("maps messages array preserving role and content", () => {
    const req: ChatCompletionRequest = {
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is 2+2?" },
        { role: "assistant", content: "4" },
        { role: "user", content: "And 3+3?" },
      ],
    };
    const result = transformRequest(req);

    expect(result.messages).toHaveLength(4);
    expect(result.messages[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant.",
    });
    expect(result.messages[1]).toEqual({ role: "user", content: "What is 2+2?" });
    expect(result.messages[2]).toEqual({ role: "assistant", content: "4" });
    expect(result.messages[3]).toEqual({ role: "user", content: "And 3+3?" });
  });

  it("handles missing optional fields (temperature, max_tokens, stream)", () => {
    const req: ChatCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
    };
    const result = transformRequest(req);

    // stream 默认 false
    expect(result.stream).toBe(false);
    // temperature 和 max_tokens 未设置时为 undefined
    expect(result.options.temperature).toBeUndefined();
    expect(result.options.num_predict).toBeUndefined();
  });
});

// ─── transformResponse ───────────────────────────────────────────────

describe("transformResponse", () => {
  it("converts basic Ollama response to OpenAI format", () => {
    const result = transformResponse(ollamaChatResponse, "gpt-4");

    // id 以 "chatcmpl-" 开头
    expect(result.id).toStartWith("chatcmpl-");
    expect(result.object).toBe("chat.completion");
    expect(result.created).toBeNumber();
    expect(result.model).toBe("gpt-4");

    // choices 结构
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].index).toBe(0);
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].message.content).toBe(
      "Hello! How can I help you today?"
    );
    expect(result.choices[0].finish_reason).toBe("stop");
  });

  it("handles null message.content by returning empty string", () => {
    const ollamaResp: OllamaChatResponse = {
      model: "llama3.1:8b",
      done: true,
      // message 字段缺失
    };
    const result = transformResponse(ollamaResp, "gpt-4");

    expect(result.choices[0].message.content).toBe("");
  });

  it("handles usage with null eval counts defaulting to 0", () => {
    // eval_count 和 prompt_eval_count 都缺失
    const ollamaResp: OllamaChatResponse = {
      model: "llama3.1:8b",
      message: { role: "assistant", content: "test" },
      done: true,
    };
    const result = transformResponse(ollamaResp, "gpt-4");

    expect(result.usage.prompt_tokens).toBe(0);
    expect(result.usage.completion_tokens).toBe(0);
    expect(result.usage.total_tokens).toBe(0);
  });

  it("computes usage correctly when eval counts are present", () => {
    const result = transformResponse(ollamaChatResponse, "gpt-4");

    // ollamaChatResponse: prompt_eval_count=5, eval_count=12
    expect(result.usage.prompt_tokens).toBe(5);
    expect(result.usage.completion_tokens).toBe(12);
    expect(result.usage.total_tokens).toBe(17);
  });

  it("passes model parameter through to response", () => {
    const result = transformResponse(ollamaChatResponse, "custom-model");
    expect(result.model).toBe("custom-model");
  });
});

// ─── transformError ─────────────────────────────────────────────────

describe("transformError", () => {
  it("creates basic OpenAI error response", () => {
    const result = transformError(
      "Model not found",
      "invalid_request_error",
      "model_not_found"
    );

    expect(result.error.message).toBe("Model not found");
    expect(result.error.type).toBe("invalid_request_error");
    expect(result.error.code).toBe("model_not_found");
    expect(result.error.param).toBeNull();
  });

  it("creates error with param specified", () => {
    const result = transformError(
      "Invalid value",
      "invalid_request_error",
      "invalid_value",
      "temperature"
    );

    expect(result.error.param).toBe("temperature");
    expect(result.error.message).toBe("Invalid value");
  });

  it("defaults param to null when not provided", () => {
    const result = transformError("Rate limit exceeded", "rate_limit_error", "429");

    expect(result.error.param).toBeNull();
  });
});

// ─── transformModelList ─────────────────────────────────────────────

describe("transformModelList", () => {
  it("converts Ollama tags to OpenAI model list format", () => {
    const result = transformModelList(ollamaTagsResponse);

    expect(result.object).toBe("list");
    expect(result.data).toHaveLength(2);

    // 第一个模型
    expect(result.data[0].id).toBe("llama3.1:8b");
    expect(result.data[0].object).toBe("model");
    expect(result.data[0].owned_by).toBe("ollama");
    expect(result.data[0].created).toBeNumber();

    // 第二个模型
    expect(result.data[1].id).toBe("qwen2.5:7b");
    expect(result.data[1].object).toBe("model");
  });

  it("handles empty models array", () => {
    const emptyTags: OllamaTagsResponse = { models: [] };
    const result = transformModelList(emptyTags);

    expect(result.object).toBe("list");
    expect(result.data).toHaveLength(0);
  });

  it("handles null/undefined models by defaulting to empty array", () => {
    const nullTags: OllamaTagsResponse = { models: undefined as any };
    const result = transformModelList(nullTags);

    expect(result.data).toHaveLength(0);
  });

  it("converts ISO date string to Unix timestamp", () => {
    const result = transformModelList(ollamaTagsResponse);

    // "2024-07-23T10:00:00Z" → Unix timestamp
    const expectedTimestamp = Math.floor(
      new Date("2024-07-23T10:00:00Z").getTime() / 1000
    );
    expect(result.data[0].created).toBe(expectedTimestamp);

    // "2024-09-12T08:30:00Z" → Unix timestamp
    const expectedTimestamp2 = Math.floor(
      new Date("2024-09-12T08:30:00Z").getTime() / 1000
    );
    expect(result.data[1].created).toBe(expectedTimestamp2);
  });

  it("maps model name to id field", () => {
    const tags: OllamaTagsResponse = {
      models: [
        { name: "custom-model:latest", modified_at: "2024-01-01T00:00:00Z", size: 1000 },
      ],
    };
    const result = transformModelList(tags);

    expect(result.data[0].id).toBe("custom-model:latest");
  });
});

// ─── transformStream ─────────────────────────────────────────────────

// 辅助函数：从 ReadableStream 读取全部输出为字符串
async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// 辅助函数：将 Ollama NDJSON 数据创建为 ReadableStream
function createOllamaStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("transformStream", () => {
  it("converts Ollama NDJSON stream to OpenAI SSE format", async () => {
    const ollamaChunks = [
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "Hello" }, done: false }) + "\n",
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: " world" }, done: false }) + "\n",
      JSON.stringify({ model: "llama3.1:8b", done: true, eval_count: 5 }) + "\n",
    ];

    const input = createOllamaStream(ollamaChunks);
    const output = transformStream(input, "gpt-4");
    const result = await readStream(output);

    // 应包含 SSE data 行
    const lines = result.split("\n\n").filter(l => l.trim());
    // 2 个内容 chunk + 1 个 final chunk + [DONE]
    expect(lines.length).toBe(4);

    // 第一个内容 chunk
    const chunk1 = JSON.parse(lines[0].replace("data: ", ""));
    expect(chunk1.object).toBe("chat.completion.chunk");
    expect(chunk1.model).toBe("gpt-4");
    expect(chunk1.choices[0].delta.content).toBe("Hello");
    expect(chunk1.choices[0].finish_reason).toBeNull();

    // 第二个内容 chunk
    const chunk2 = JSON.parse(lines[1].replace("data: ", ""));
    expect(chunk2.choices[0].delta.content).toBe(" world");

    // final chunk（done=true）
    const finalChunk = JSON.parse(lines[2].replace("data: ", ""));
    expect(finalChunk.choices[0].finish_reason).toBe("stop");
    expect(finalChunk.choices[0].delta).toEqual({});

    // [DONE] 标记
    expect(lines[3]).toBe("data: [DONE]");
  });

  it("sends [DONE] when reader finishes without done chunk", async () => {
    const ollamaChunks = [
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "Hi" }, done: false }) + "\n",
    ];

    const input = createOllamaStream(ollamaChunks);
    const output = transformStream(input, "gpt-4");
    const result = await readStream(output);

    expect(result).toContain("data: [DONE]");
  });

  it("skips empty lines in the stream", async () => {
    const ollamaChunks = [
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "A" }, done: false }) + "\n\n",
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "B" }, done: false }) + "\n",
    ];

    const input = createOllamaStream(ollamaChunks);
    const output = transformStream(input, "gpt-4");
    const result = await readStream(output);

    const contentLines = result.split("\n\n").filter(l => l.includes('"delta"'));
    expect(contentLines.length).toBe(2);
  });

  it("ignores unparseable lines", async () => {
    const ollamaChunks = [
      "not valid json\n",
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "OK" }, done: false }) + "\n",
    ];

    const input = createOllamaStream(ollamaChunks);
    const output = transformStream(input, "gpt-4");
    const result = await readStream(output);

    const contentLines = result.split("\n\n").filter(l => l.includes('"delta"'));
    expect(contentLines.length).toBe(1);
  });

  it("skips chunks with empty content", async () => {
    const ollamaChunks = [
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "" }, done: false }) + "\n",
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "visible" }, done: false }) + "\n",
    ];

    const input = createOllamaStream(ollamaChunks);
    const output = transformStream(input, "gpt-4");
    const result = await readStream(output);

    const contentLines = result.split("\n\n").filter(l => l.includes('"delta"'));
    expect(contentLines.length).toBe(1);
  });

  it("handles chunk without message field", async () => {
    const ollamaChunks = [
      JSON.stringify({ model: "llama3.1:8b", done: false }) + "\n",
      JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "text" }, done: false }) + "\n",
    ];

    const input = createOllamaStream(ollamaChunks);
    const output = transformStream(input, "gpt-4");
    const result = await readStream(output);

    const contentLines = result.split("\n\n").filter(l => l.includes('"delta"'));
    expect(contentLines.length).toBe(1);
  });

  it("cancels the underlying reader when stream is cancelled", async () => {
    let cancelCalled = false;
    const encoder = new TextEncoder();
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(
          JSON.stringify({ model: "llama3.1:8b", message: { role: "assistant", content: "Hi" }, done: false }) + "\n"
        ));
      },
      cancel() {
        cancelCalled = true;
      },
    });

    const output = transformStream(input, "gpt-4");
    await output.cancel();

    expect(cancelCalled).toBe(true);
  });
});
