import { memo, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import JSZip from 'jszip';
import { WORK_DIR } from '~/utils/constants';

interface RExecProps {
  filename: string|undefined;
  onRequestFix?: (errorMessage: string) => void;
}

export const RExec = memo(({ filename, onRequestFix }: RExecProps) => {
  const [output, setOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 添加打包文件的函数
  const createZipFromSrc = async (webcontainer: any) => {
    try {
      // 读取 src 目录下所有文件
      const srcFiles = await webcontainer.fs.readdir('src', { recursive: true });
      
    //   console.log('srcFiles',srcFiles);
      // 创建一个新的 JSZip 实例
      const zip = new JSZip();

      // 添加所有文件到 zip
      for (const file of srcFiles) {
        // if (file.type === 'file') 
        {
          const content = await webcontainer.fs.readFile(`src/${file}`, 'utf-8');
          if (content) {
            zip.file(file, content);
          }
        }
      }

      // 生成 zip 文件
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      return zipBlob;
    } catch (error) {
      console.error('Error creating zip:', error);
      throw error;
    }
  };

  const executeCode = async () => {
    // 检查文件名和扩展名
    if (!filename || !filename.toLowerCase().endsWith('.r')) {
      filename = 'main.R';
    } else {
      filename = filename.replace(WORK_DIR, '').replace(/^\//, '').replace('src/', '');
    }
    
    setIsExecuting(true);
    setHasError(false);
    try {
      const webcontainer = await workbenchStore.webcontainer;
      
      // 创建包含源文件的 zip
      const zipBlob = await createZipFromSrc(webcontainer);

      // 创建 FormData 对象
      const formData = new FormData();
      formData.append('file', zipBlob, 'src.zip');
      formData.append('main_file', filename);

      // 调用执行接口
      const response = await fetch('http://192.168.3.125:8000/execute_r', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 读取响应流
      const reader = response.body?.getReader();
      let outputText = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = new TextDecoder().decode(value);
        outputText += text;
        setOutput(outputText);
      }

      try {
        // 尝试解析 JSON
        const jsonOutput = JSON.parse(outputText);
        if (jsonOutput.error && jsonOutput.error !== '') {
          setHasError(true);
          setOutput(jsonOutput.error);
        }
      } catch (e) {
        // 如果不是有效的 JSON，继续累积输出
      }

    } catch (error: unknown) {
      console.error('Execution failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOutput(`Error: ${errorMessage}`);
      setHasError(true);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleFixRequest = () => {
    if (onRequestFix) {
      onRequestFix(`请修复这个错误：${output}`);
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-4 flex gap-2">
        <IconButton 
          onClick={executeCode}
          disabled={isExecuting}
          className="flex items-center gap-2"
        >
          {isExecuting ? (
            <>
              <div className="i-ph:spinner animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <div className="i-ph:play-circle" />
              Execute Code
            </>
          )}
        </IconButton>
        
        {hasError && (
          <button
            onClick={handleFixRequest}
            className="flex items-center gap-2 text-bolt-elements-textError hover:bg-bolt-elements-background-depth-2"
          >
            <div className="i-ph:wrench" />
            Fix Error
          </button>
        )}
      </div>
      <div className="flex-1 bg-bolt-elements-background-depth-3 rounded-lg p-4 font-mono whitespace-pre-wrap overflow-auto">
        {output || 'Output will appear here...'}
      </div>
    </div>
  );
}); 