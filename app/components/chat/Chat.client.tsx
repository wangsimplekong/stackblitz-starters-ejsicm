import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

interface ImageContent {
  type: 'image';
  content: string;
}

type ContentItem = string | ImageContent;

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  return (
    <>
      {ready && <ChatImpl initialMessages={initialMessages} storeMessageHistory={storeMessageHistory} />}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

export const ChatImpl = memo(({ initialMessages, storeMessageHistory }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);

  const { showChat } = useStore(chatStore);

  const { projectType } = useStore(chatStore);
  const setSelectedProjectType = (type: string) => {
    chatStore.setKey('projectType', type);
    const { id } = chatStore.get();
    if (id) {
      localStorage.setItem(id + '_project_type', type);
    }
  };

  const [animationScope, animate] = useAnimate();

  const { messages, isLoading, input, handleInputChange, setInput, stop, append } = useChat({
    api: '/api/chat2',
    body: {
      projectType: projectType,
    },
    onError: (error) => {
      logger.error('Request failed\n\n', error);
      toast.error('There was an error processing your request');
    },
    onFinish: () => {
      logger.debug('Finished streaming');
    },
    initialMessages,
  });

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  useEffect(() => {
    chatStore.setKey('started', initialMessages.length > 0);
  }, []);

  useEffect(() => {
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  }, [messages, isLoading, parseMessages]);

  const scrollTextArea = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const abort = () => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
  };

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef]);

  const runAnimation = async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    chatStore.setKey('started', true);

    setChatStarted(true);
  };

  const [pendingImages, setPendingImages] = useState<string[]>([]);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    
    const newImages: string[] = [];
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} 不是图片文件`);
        continue;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB 限制
        toast.error(`${file.name} 超过5MB大小限制`);
        continue;
      }

      try {
        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        newImages.push(imageData);
      } catch (err) {
        toast.error(`处理图片 ${file.name} 时出错`);
        console.error(err);
      }
    }

    if (newImages.length > 0) {
      setPendingImages(prev => [...prev, ...newImages]);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (const item of items) {
      console.log('item.type',item.type);
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleImageUpload(imageFiles as unknown as FileList);
    }
  };

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;

    if ((_input.length === 0 && pendingImages.length === 0) || isLoading) {
      return;
    }

    await workbenchStore.saveAllFiles();
    const fileModifications = workbenchStore.getFileModifcations();
    chatStore.setKey('aborted', false);
    runAnimation();

    let content: ContentItem[] = [];

    if (fileModifications !== undefined) {
      const diff = fileModificationsToHTML(fileModifications);
      if (diff) {
        content.push(diff);
      }
    }

    content.push(...pendingImages.map(base64Image => ({
      type: 'image' as const,
      content: base64Image
    })));

    if (_input.length > 0) {
      content.push(_input);
    }

    append({
      role: 'user',
      content: content.length === 1 ? content[0] : content
    } as Message);

    setPendingImages([]);
    setInput('');
    resetEnhancer();
    textareaRef.current?.blur();

    if (fileModifications !== undefined) {
      workbenchStore.resetAllFileModifications();
    }
  };

  const [messageRef, scrollRef] = useSnapScroll();

  const [isChatVisible, setIsChatVisible] = useState(true);

  const { pendingMessage } = useStore(chatStore);

  useEffect(() => {
    if (pendingMessage) {
      sendMessage({} as React.UIEvent, pendingMessage);
      chatStore.setKey('pendingMessage', null);
    }
  }, [pendingMessage]);

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      showChat={showChat}
      chatStarted={chatStarted}
      isStreaming={isLoading}
      enhancingPrompt={enhancingPrompt}
      promptEnhanced={promptEnhanced}
      sendMessage={sendMessage}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={handleInputChange}
      handleStop={abort}
      messages={messages.map((message, i) => {
        if (message.role === 'user') {
          return message;
        }

        return {
          ...message,
          content: parsedMessages[i] || '',
        };
      })}
      enhancePrompt={() => {
        enhancePrompt(input, (input) => {
          setInput(input);
          scrollTextArea();
        });
      }}
      selectedProjectType={projectType}
      onProjectTypeChange={setSelectedProjectType}
      onPaste={handlePaste}
      onImageUpload={handleImageUpload}
      pendingImages={pendingImages}
      setPendingImages={setPendingImages}
      isChatVisible={isChatVisible}
      onToggleChat={() => setIsChatVisible(!isChatVisible)}
    />
  );
});
