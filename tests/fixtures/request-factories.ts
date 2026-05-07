import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ModelListResponse,
  ModelObject,
  OpenAIErrorResponse,
} from "../../src/types";

export function createChatCompletionRequest(
  overrides: Partial<ChatCompletionRequest> = {}
): ChatCompletionRequest {
  return {
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello!" }],
    temperature: 0.7,
    max_tokens: 1024,
    stream: false,
    ...overrides,
  };
}

export function createChatCompletionResponse(
  overrides: Partial<ChatCompletionResponse> = {}
): ChatCompletionResponse {
  return {
    id: "chatcmpl-test-123",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello! How can I help you today?" },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 5,
      completion_tokens: 12,
      total_tokens: 17,
    },
    ...overrides,
  };
}

export function createChatCompletionChunk(
  overrides: Partial<ChatCompletionChunk> = {}
): ChatCompletionChunk {
  return {
    id: "chatcmpl-test-123",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4",
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: "Hello" },
        finish_reason: null,
      },
    ],
    ...overrides,
  };
}

export function createModelObject(overrides: Partial<ModelObject> = {}): ModelObject {
  return {
    id: "gpt-4",
    object: "model",
    created: 1677649963,
    owned_by: "alice",
    ...overrides,
  };
}

export function createModelListResponse(
  overrides: Partial<ModelListResponse> = {}
): ModelListResponse {
  return {
    object: "list",
    data: [createModelObject()],
    ...overrides,
  };
}

export function createOpenAIErrorResponse(
  overrides: Partial<OpenAIErrorResponse> = {}
): OpenAIErrorResponse {
  return {
    error: {
      message: "An error occurred",
      type: "invalid_request_error",
      param: null,
      code: null,
      ...overrides.error,
    },
    ...overrides,
  };
}
