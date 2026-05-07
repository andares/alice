import { describe, it, expect } from "bun:test";
import { mockConfig } from "../../fixtures/config.mock";
import { ollamaChatResponse, ollamaStreamChunks } from "../../fixtures/ollama-responses";
import {
  createChatCompletionRequest,
  createChatCompletionResponse,
} from "../../fixtures/request-factories";

describe("fixtures compile correctly", () => {
  it("config mock is valid", () => {
    expect(mockConfig.port).toBe(3000);
    expect(mockConfig.apiKey).toBeString();
  });

  it("ollama response fixtures are valid", () => {
    expect(ollamaChatResponse.done).toBe(true);
    expect(ollamaStreamChunks.length).toBeGreaterThan(0);
  });

  it("request factory functions work", () => {
    const req = createChatCompletionRequest();
    expect(req.model).toBe("gpt-4");

    const res = createChatCompletionResponse();
    expect(res.object).toBe("chat.completion");
  });
});
