/**
 * LLM Service using Supabase Edge Functions
 * Can be configured to use any LLM provider via Supabase Edge Functions
 */

export interface LLMOptions {
  supabaseUrl: string;
  supabaseKey: string;
  functionName?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class LLMService {
  private supabaseUrl: string;
  private supabaseKey: string;
  private functionName: string;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(options: LLMOptions) {
    this.supabaseUrl = options.supabaseUrl;
    this.supabaseKey = options.supabaseKey;
    this.functionName = options.functionName || 'generate-text';
    this.defaultModel = options.model || 'meta-llama/llama-3-8b-instruct';
    this.defaultTemperature = options.temperature ?? 0.7;
    this.defaultMaxTokens = options.maxTokens ?? 2048;
  }

  /**
   * Generate text using Supabase Edge Function
   */
  async generate(
    messages: LLMMessage[],
    systemPrompt?: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/${this.functionName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            systemPrompt,
            model: options?.model || this.defaultModel,
            temperature: options?.temperature ?? this.defaultTemperature,
            maxTokens: options?.maxTokens ?? this.defaultMaxTokens,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM service error: ${error}`);
      }

      const data = await response.json();
      return data.text || data.response || data.content || '';
    } catch (error) {
      console.error('Error calling LLM service:', error);
      throw error;
    }
  }

  /**
   * Generate text with streaming support
   */
  async generateStream(
    messages: LLMMessage[],
    systemPrompt: string | undefined,
    onChunk: (chunk: string, fullText: string) => void,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/${this.functionName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            systemPrompt,
            model: options?.model || this.defaultModel,
            temperature: options?.temperature ?? this.defaultTemperature,
            maxTokens: options?.maxTokens ?? this.defaultMaxTokens,
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM service error: ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const textChunk = data.text || data.chunk || '';
              if (textChunk) {
                fullText += textChunk;
                onChunk(textChunk, fullText);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return fullText;
    } catch (error) {
      console.error('Error calling LLM service stream:', error);
      throw error;
    }
  }
}

