export type ChatCompletionRequest = {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  n?: number;
  stop?: string | string[];
  frequency_penalty?: number;
  presence_penalty?: number;
};

export type ChatCompletionResponse = {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type ChatCompletionChunk = {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: 'assistant'; content?: string };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
};

export type ModelObject = {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
};

export type ModelListResponse = {
  object: 'list';
  data: ModelObject[];
};

export type OpenAIErrorResponse = {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
};

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Config = {
  port: number;
  apiKey: string;
  ollamaUrl: string;
  logLevel: LogLevel;
  logFile: string;
  dbFile: string;
  modelAliases?: Record<string, string>;
};

export type AliceConfig = {
  dbFile: string;
};

export type RunningModel = {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  expires_at: string;
  size_vram: number;
};

export type RequestContext = {
  requestId: string;
  startTime: number;
};

export type OllamaChatRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  options: { temperature?: number; num_predict?: number };
};

export type OllamaChatResponse = {
  model: string;
  message?: { role: string; content: string };
  done: boolean;
  eval_count?: number;
  prompt_eval_count?: number;
};

export type OllamaModel = {
  name: string;
  modified_at: string;
  size: number;
};

export type OllamaTagsResponse = {
  models: OllamaModel[];
};

export type OllamaStreamChunk = {
  model: string;
  message?: { role: string; content: string };
  done: boolean;
  eval_count?: number;
  prompt_eval_count?: number;
};