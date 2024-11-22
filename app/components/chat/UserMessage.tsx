import { useState } from 'react';
import { modificationsRegex } from '~/utils/diff';
import { Markdown } from './Markdown';
import { ImageViewer } from '../common/ImageViewer';

interface ImageContent {
  type: 'image';
  content: string;
}

type ContentItem = string | ImageContent;

interface UserMessageProps {
  content: string | ContentItem[];
}

export function UserMessage({ content }: UserMessageProps) {
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  console.log('content',content);
  if (typeof content === 'string') {
    return (
      <div className="overflow-hidden pt-[4px]">
        <Markdown limitedMarkdown>{sanitizeUserMessage(content)}</Markdown>
      </div>
    );
  }

  return (
    <div className="overflow-hidden pt-[4px] space-y-4">
      {content.map((item, index) => {
        console.log('item',item);
        if (typeof item === 'string') {
          return (
            <div key={index}>
              <Markdown limitedMarkdown>{sanitizeUserMessage(item)}</Markdown>
            </div>
          );
        }
        
        if (item.type === 'image') {
          return (
            <div key={index} className="relative group">
              <img 
                src={item.content} 
                alt="用户上传的图片" 
                className="max-w-[300px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setViewerImage(item.content)}
              />
              <ImageViewer
                src={item.content}
                alt="用户上传的图片"
                isOpen={viewerImage === item.content}
                onClose={() => setViewerImage(null)}
              />
            </div>
          );
        }
        
        return null;
      })}
    </div>
  );
}

function sanitizeUserMessage(content: string) {
  return content.replace(modificationsRegex, '').trim();
}
