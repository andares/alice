import type {
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaStreamChunk,
  OllamaTagsResponse,
  OllamaModel,
  RunningModel,
} from "../../src/types";

export const defaultOllamaChatRequest: OllamaChatRequest = {
  model: "llama3.1:8b",
  messages: [{ role: "user", content: "Hello!" }],
  stream: false,
  options: {},
};

export const ollamaChatResponse: OllamaChatResponse = {
  model: "llama3.1:8b",
  message: { role: "assistant", content: "Hello! How can I help you today?" },
  done: true,
  eval_count: 12,
  prompt_eval_count: 5,
};

export const ollamaStreamChunks: OllamaStreamChunk[] = [
  {
    model: "llama3.1:8b",
    message: { role: "assistant", content: "Hello" },
    done: false,
  },
  {
    model: "llama3.1:8b",
    message: { role: "assistant", content: "!" },
    done: false,
  },
  {
    model: "llama3.1:8b",
    message: { role: "assistant", content: " How can I help you today?" },
    done: false,
  },
  {
    model: "llama3.1:8b",
    done: true,
    eval_count: 12,
    prompt_eval_count: 5,
  },
];

export const ollamaModels: OllamaModel[] = [
  {
    name: "llama3.1:8b",
    modified_at: "2024-07-23T10:00:00Z",
    size: 4920000000,
  },
  {
    name: "qwen2.5:7b",
    modified_at: "2024-09-12T08:30:00Z",
    size: 4380000000,
  },
];

export const ollamaTagsResponse: OllamaTagsResponse = {
  models: ollamaModels,
};

export const runningModels: RunningModel[] = [
  {
    name: "llama3.1:8b",
    model: "llama3.1:8b",
    size: 4920000000,
    digest: "sha256:abc123",
    details: {
      parent_model: "",
      format: "gguf",
      family: "llama",
      families: ["llama"],
      parameter_size: "8B",
      quantization_level: "Q4_0",
    },
    expires_at: "2024-12-31T23:59:59Z",
    size_vram: 4920000000,
  },
];
