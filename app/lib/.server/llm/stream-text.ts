import { streamText as _streamText, type CoreMessage, type TextPart, type ImagePart, type ToolContent } from 'ai';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { getAnthropicModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface ImageContent {
  type: 'image';
  content: string;
}

type ContentItem = string | ImageContent;

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentItem[];
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

type OpenAIImageUrl = {
  type: 'image_url'|'image';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
};

export function convertImagePartToOpenAIImage(part: ImagePart): OpenAIImageUrl {
  return {
    type: 'image_url',
    image_url: {
      url: 
        part.image instanceof URL 
          ? part.image.toString() 
          : `data:${part.mimeType ?? 'image/jpeg'};base64,${convertUint8ArrayToBase64(part.image)}`,
      detail: part.providerMetadata?.openai?.imageDetail,
    },
  };
}

export function convertImagePartToQwenVLImage(part: ImagePart) {
  return {
    type: 'image',
    image: part.image instanceof URL 
          ? part.image.toString() 
          : `data:${part.mimeType ?? 'image/jpeg'};base64,${convertUint8ArrayToBase64(part.image)}`,
  };
}

export function convertUint8ArrayToBase64(array: Uint8Array): string {
  let latin1string = '';
  // 使用常规 for 循环以支持不支持对 Uint8Array 使用 for..of 的旧版 JavaScript
  for (let i = 0; i < array.length; i++) {
    latin1string += String.fromCodePoint(array[i]);
  }
  return btoa(latin1string);
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'> & {
  projectType?: string;
};

export function streamTextCloude(messages: Messages, env: Env, options?: StreamingOptions) {
  return _streamText({
    model: getAnthropicModel(getAPIKey(env)),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: convertToCoreMessages(messages),
    ...options,
  });
}


export const customOpenAI2 = {
  async doStream(args) {
    const model = ''
    const messages = args.prompt
    // const url_qwen_coder = `http://192.168.3.182:19871/v1/chat/completions`
    // const url_qwen_coder = `http://192.168.3.157:19878/v1/chat/completions`
    const url_one_api = `http://127.0.0.1:33164/v1/chat/completions`
    // const url_one_api = `http://192.168.11.247:33164/v1/chat/completions`
    const url_qwen_coder = url_one_api

    const convertedMessages = messages.map(msg => ({
      role: msg.role,
      content: Array.isArray(msg.content) 
        ? msg.content.map(item => {
            if (typeof item === 'string') {
              return item;
            } else if (item.type === 'image') {
              return convertImagePartToQwenVLImage(item);
            }
            return item;
          })
        : msg.content
    }));

    const response = await fetch(url_qwen_coder, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CUSTOM_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: convertedMessages,
        stream: true
      })
    });

  
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial response metadata
        controller.enqueue({
          type: 'response-metadata',
          model,
          created: Date.now(),
        } as const);

        try {
          while (true) {
            const { done, value } = await reader!.read();
            
            if (done) {
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: {
                  promptTokens: NaN,
                  completionTokens: NaN,
                }
              } as const);
              controller.close();
              return;
            }

            // Decode the chunk and split by lines
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices[0]?.delta;

                  if (delta?.content) {
                    controller.enqueue({
                      type: 'text-delta',
                      textDelta: delta.content,
                    } as const);
                  }
                } catch (e) {
                  console.error('Error parsing chunk:', e);
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return {
      stream,
      rawCall: { rawPrompt: messages },
      rawResponse: { headers: response.headers },
      warnings: [],
    };
  }
};

export function streamTextOpenAI(messages: Messages, env: Env, options?: StreamingOptions) {
  const { projectType, ...restOptions } = options || {};
  // console.log('==========projectType ========', projectType)
  return _streamText({
    model: customOpenAI2,
    system: getSystemPrompt(projectType),
    maxTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: convertToCoreMessages(messages) as any,
    ...restOptions,
  });
}




export const customSonnect35 = {
  async doStream(args) {
    const model = 'claude-3-5-sonnet-20240620'
    const messages = args.prompt
    const bodyString = JSON.stringify({
      model:model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      // top_p: 0.85,
      // presence_penalty: 0.0,
      // min_p: 0.85,
      // frequency_penalty: 0.0,
      // n: 1,
      max_tokens: MAX_TOKENS,
      stream: true
    })

    console.log('==================', bodyString.length, bodyString)
    const response = await fetch(`http://one-api-cq.laibokeji.com/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CUSTOM_OPENAI_API_KEY}`,
        // 'Content-Length': Buffer.byteLength(bodyString).toString(),
      },
      body: bodyString
    });

   

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial response metadata
        controller.enqueue({
          type: 'response-metadata',
          model,
          created: Date.now(),
        } as const);

        try {
          while (true) {
            const { done, value } = await reader!.read();
            
            if (done) {
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: {
                  promptTokens: NaN,
                  completionTokens: NaN,
                }
              } as const);
              controller.close();
              return;
            }

            // Decode the chunk and split by lines
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices[0]?.delta;

                  if (delta?.content) {
                    controller.enqueue({
                      type: 'text-delta',
                      textDelta: delta.content,
                    } as const);
                  }
                } catch (e) {
                  console.error('Error parsing chunk:', e);
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return {
      stream,
      rawCall: { rawPrompt: messages },
      rawResponse: { headers: response.headers },
      warnings: [],
    };
  }
};

export function streamTextOneApiSonnect35(messages: Messages, env: Env, options?: StreamingOptions) {
  return _streamText({
    model: customSonnect35,
    system: '',//getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: convertToCoreMessages(messages),
    ...options,
  });
}

function convertToCoreMessages(messages: Messages): CoreMessage[] {
  return messages.map(msg => {
    // 处理 content 字段
    let content: string | Array<TextPart | ImagePart>;

    // 如果 content 是数组,需要转换格式
    if (Array.isArray(msg.content)) {
      content = msg.content.map(item => {
        if (typeof item === 'string') {
          return {
            type: 'text',
            text: item
          } as TextPart;
        } else if (item.type === 'image') {
           // 检测并处理 base64 图片
           let base64Data = item.content;
          
           // 尝试自动检测 MIME 类型
           let mimeType = 'image/png'; // 默认为 PNG
           if (base64Data.startsWith('data:image/jpeg;base64,')) {
             mimeType = 'image/jpeg';
             base64Data = base64Data.replace('data:image/jpeg;base64,', '');
           } else if (base64Data.startsWith('data:image/png;base64,')) {
             mimeType = 'image/png';
             base64Data = base64Data.replace('data:image/png;base64,', '');
           } else if (base64Data.startsWith('data:image/gif;base64,')) {
             mimeType = 'image/gif';
             base64Data = base64Data.replace('data:image/gif;base64,', '');
           }
 
           return {
             type: 'image',
             image: base64Data, // 移除 data URL 前缀
             mimeType: mimeType
           };
        }
        throw new Error(`Unsupported content type: ${JSON.stringify(item).slice(0, 100)}`);
      });
    } else {
      // 如果是字符串,直接使用
      content = msg.content;
    }

    // 基础消息转换
    const coreMessage: CoreMessage = {
      role: msg.role,
      content
    };

    // 处理工具调用结果
    if (msg.toolInvocations?.length) {
      const toolResults: ToolContent = msg.toolInvocations.map(tool => ({
        type: 'tool-result' as const,
        toolCallId: tool.toolCallId,
        toolName: tool.toolName,
        result: tool.result
      }));
      
      // 如果有工具调用结果,将角色改为 tool
      if (toolResults.length) {
        coreMessage.role = 'tool';
        coreMessage.content = toolResults;
      }
    }

    return coreMessage;
  });
}

export type { Message, Messages, ImageContent, ContentItem };