import type { Message } from 'ai';
import React, { type RefCallback, useState, useRef } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';

import styles from './BaseChat.module.scss';

// 添加项目类型定义
const PROJECT_TYPES = [
  { id: 'python', label: 'Python数据分析', icon: 'i-logos:python' },
  { id: 'r', label: 'R数据分析', icon: 'i-logos:r-lang' },
  { id: 'ai', label: 'AI计算模拟', icon: 'i-carbon:machine-learning' },
  { id: 'mathlib', label: 'mathlib计算仿真', icon: 'i-carbon:function-math' },
  { id: 'viewer', label: '界面显示', icon: 'i-carbon:view' },
  { id: 'engineering', label: '工程计算仿真', icon: 'i-carbon:calculator-scientific' },
  { id: 'molecular', label: '分子计算', icon: 'i-carbon:chemistry' },
  { id: 'bio', label: '生物信息计算仿真', icon: 'i-carbon:dna' },
  { id: '2d23d', label: '3D合成', icon: 'i-carbon:3d' },
];

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  selectedProjectType: string;
  onProjectTypeChange: (typeId: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onImageUpload: (files: FileList | null) => void;
  pendingImages?: string[];
  setPendingImages?: (images: string[] | ((prev: string[]) => string[])) => void;
  onToggleChat?: () => void;
  isChatVisible?: boolean;
}

const EXAMPLE_PROMPTS = [
  { text: 'Build a todo app in React using Tailwind' },
  { text: 'Build a simple blog using Astro' },
  { text: 'Create a cookie consent form using Material UI' },
  { text: 'Make a space invaders game' },
  { text: 'How do I center a div?' },
];

const TEXTAREA_MIN_HEIGHT = 76;

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
      selectedProjectType,
      onProjectTypeChange,
      onPaste,
      onImageUpload,
      pendingImages = [],
      setPendingImages = () => {},
      onToggleChat,
      isChatVisible = true,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full overflow-hidden bg-bolt-elements-background-depth-1 transition-all duration-300',
          isChatVisible ? 'w-full' : 'w-0'
        )}
        data-chat-visible={showChat}
      >
        <div className="absolute right-[-40px] top-1/2 -translate-y-1/2 z-50">
          <button
            onClick={onToggleChat}
            className={classNames(
              "flex items-center justify-center w-10 h-24",
              "bg-bolt-elements-background-depth-2",
              "border border-bolt-elements-borderColor",
              "rounded-r-lg",
              "hover:bg-bolt-elements-background-depth-3",
              "transition-colors"
            )}
            title={isChatVisible ? "收起聊天" : "展开聊天"}
          >
            <div className={classNames(
              isChatVisible ? 'i-ph:caret-left' : 'i-ph:caret-right',
              'text-2xl text-bolt-elements-textSecondary'
            )} />
          </button>
        </div>
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[26vh] max-w-chat mx-auto">
                <h1 className="text-5xl text-center font-bold text-bolt-elements-textPrimary mb-2">
                  Where ideas begin
                </h1>
                <p className="mb-4 text-center text-bolt-elements-textSecondary">
                  Bring ideas to life in seconds or get help on existing projects.
                </p>
                
                {/* 添加项目类型选择 */}
                <div className="max-w-xl mx-auto mb-8">
                  <p className="text-center text-bolt-elements-textSecondary mb-4">选择项目类型：</p>
                  <div className="grid grid-cols-5 gap-3 px-4">
                    {PROJECT_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => onProjectTypeChange?.(type.id)}
                        className={classNames(
                          'flex items-center gap-2 p-3 rounded-lg border transition-all',
                          selectedProjectType === type.id
                            ? 'border-bolt-elements-borderAccent bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary'
                            : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderHover text-bolt-elements-textSecondary'
                        )}
                      >
                        <div className={classNames(type.icon, 'text-xl')} />
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div
              className={classNames('pt-6 px-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                  'sticky bottom-0': chatStarted,
                })}
              >
                <div
                  className={classNames(
                    'shadow-sm border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-lg overflow-hidden',
                  )}
                >
                  <div className="flex flex-col">
                    {pendingImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 border-b border-bolt-elements-borderColor">
                        {pendingImages.map((base64Image, index) => (
                          <div key={index} className="relative group">
                            <img 
                              src={base64Image} 
                              alt="待发送的图片" 
                              className="w-20 h-20 object-cover rounded cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                setPreviewImage(base64Image);
                              }}
                            />
                            <button
                              className="absolute top-1 right-1 p-1.5 rounded-full bg-black/50 text-white 
                                         hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== index))}
                              title="删除图片"
                            >
                              <div className="i-ph:x text-sm" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="relative flex items-center">
                      <textarea
                        ref={textareaRef}
                        className={`w-full pl-4 pt-4 pr-16 focus:outline-none resize-none text-md 
                                   text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            if (event.shiftKey) {
                              return;
                            }
                            event.preventDefault();
                            sendMessage?.(event);
                          }
                        }}
                        value={input}
                        onChange={(event) => {
                          handleInputChange?.(event);
                        }}
                        style={{
                          minHeight: TEXTAREA_MIN_HEIGHT,
                          maxHeight: TEXTAREA_MAX_HEIGHT,
                        }}
                        placeholder="How can Bolt help you today?"
                        translate="no"
                        onPaste={onPaste}
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={(e) => onImageUpload(e.target.files)}
                      />
                    </div>
                  </div>
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show={input.length > 0 || isStreaming}
                        isStreaming={isStreaming}
                        onClick={(event) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          sendMessage?.(event);
                        }}
                      />
                    )}
                  </ClientOnly>
                  <div className="flex justify-between text-sm p-4 pt-2">
                    <div className="flex gap-1 items-center">
                      <IconButton
                        title="Upload images"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                      >
                        <div className="i-ph:image text-xl" />
                      </IconButton>
                      <IconButton
                        title="Enhance prompt"
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames({
                          'opacity-100!': enhancingPrompt,
                          'text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!':
                            promptEnhanced,
                        })}
                        onClick={() => enhancePrompt?.()}
                      >
                        {enhancingPrompt ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl"></div>
                            <div className="ml-1.5">Enhancing prompt...</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl"></div>
                            {promptEnhanced && <div className="ml-1.5">Prompt enhanced</div>}
                          </>
                        )}
                      </IconButton>
                    </div>
                    {input.length > 3 ? (
                      <div className="text-xs text-bolt-elements-textTertiary">
                        Use <kbd className="kdb">Shift</kbd> + <kbd className="kdb">Return</kbd> for a new line
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="bg-bolt-elements-background-depth-1 pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <div id="examples" className="relative w-full max-w-xl mx-auto mt-8 flex justify-center">
                <div className="flex flex-col space-y-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_180%)] hover:[mask-image:none]">
                  {EXAMPLE_PROMPTS.map((examplePrompt, index) => {
                    return (
                      <button
                        key={index}
                        onClick={(event) => {
                          sendMessage?.(event, examplePrompt.text);
                        }}
                        className="group flex items-center w-full gap-2 justify-center bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-theme"
                      >
                        {examplePrompt.text}
                        <div className="i-ph:arrow-bend-down-left" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} projectType={selectedProjectType} />}</ClientOnly>
        </div>
        {previewImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]">
              <img 
                src={previewImage} 
                alt="图片预览" 
                className="max-w-full max-h-[90vh] object-contain"
              />
              <button
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                onClick={() => setPreviewImage(null)}
              >
                <div className="i-ph:x text-xl" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);
