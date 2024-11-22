import { memo, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import JSZip from 'jszip';

interface MathlibExecProps {
  filename: string|undefined;
}

export const MathlibExec = memo(({ filename }: MathlibExecProps) => {
  const [output, setOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);

  // 添加打包文件的函数
  const createZipFromSrc = async (webcontainer: any) => {
    try {
      // 读取 src 目录下所有文件
      const srcFiles = await webcontainer.fs.readdir('src', { recursive: true });
      
      // 创建一个新的 JSZip 实例
      const zip = new JSZip();

      // 添加所有文件到 zip
      for (const file of srcFiles) {
        if (file.type === 'file') {
          const content = await webcontainer.fs.readFile(`src/${file.name}`, 'utf-8');
          zip.file(file.name, content);
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
    if (!filename) filename = 'main.R';
    
    setIsExecuting(true);
    try {
      const webcontainer = await workbenchStore.webcontainer;
      
      // 创建包含源文件的 zip
      const zipBlob = await createZipFromSrc(webcontainer);

      // 创建 FormData 对象
      const formData = new FormData();
      formData.append('zip', zipBlob, 'src.zip');
      formData.append('filename', filename);

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

    } catch (error) {
      console.error('Execution failed:', error);
      setOutput(`Error: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-4">
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
      </div>
      <div className="flex-1 bg-bolt-elements-background-depth-3 rounded-lg p-4 font-mono whitespace-pre-wrap overflow-auto">
        {output || 'Output will appear here...'}
      </div>
    </div>
  );
}); 