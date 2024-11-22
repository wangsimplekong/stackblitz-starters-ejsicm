import { memo, useState, useEffect } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import type { FilesStore } from '~/lib/stores/files';

interface EngineeringWorkProps {
    filesStore: FilesStore;
    fileCount: number;
}

export const EngineeringWork = memo(({ filesStore, fileCount }: EngineeringWorkProps) => {
  const [selectedPrj, setSelectedPrj] = useState<string>('');
  const [selectedVca, setSelectedVca] = useState<string>('');
  const [prjFiles, setPrjFiles] = useState<string[]>([]);
  const [vcaFiles, setVcaFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportName, setReportName] = useState<string>('');
  

  const generateRandomString = () => {
    const chars = '0123456789';
    let result = 'REP_';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 从WebContainer文件系统获取文件列表
  useEffect(() => {
    const updateFilesList = () => {
      const files = filesStore.files.get();
      const prjSet = new Set<string>();
      const vcaSet = new Set<string>();
      
      Object.entries(files).forEach(([path, dirent]) => {
        if (dirent?.type === 'file') {
          // Get relative path by removing WORK_DIR
          const relativePath = path.replace(WORK_DIR, '').replace(/^\//, '');
          
          if (path.toLowerCase().endsWith('.prj')) {
            prjSet.add(relativePath);
          } else if (path.toLowerCase().endsWith('.vca')) {
            vcaSet.add(relativePath);
          }
        }
      });

      const prjList = Array.from(prjSet);
      const vcaList = Array.from(vcaSet);
      
      setPrjFiles(prjList);
      setVcaFiles(vcaList);

      // Set default selections if files exist but nothing is selected
      if (prjList.length > 0 && !selectedPrj) {
        setSelectedPrj(prjList[0]);
      }
      if (vcaList.length > 0 && !selectedVca) {
        setSelectedVca(vcaList[0]);
      }
    };

    updateFilesList();
    // 监听文件变化
    // filesStore.files.listen(updateFilesList);
    
    // return () => {
    //   filesStore.files.off(updateFilesList);
    // };
   
  }, [fileCount]);

  console.log('====filesCount======', fileCount);

  const handleExecute = async () => {
    if (!selectedPrj || !selectedVca) {
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    
    // 从WebContainer获取文件内容
    const prjFile = filesStore.getFile(selectedPrj);
    const vcaFile = filesStore.getFile(selectedVca);
    
    if (!prjFile || !vcaFile) {
      return;
    }

    let sessionId = generateRandomString();
    
    formData.append('prj', new Blob([prjFile.content]));
    formData.append('vc', new Blob([vcaFile.content]));

    try {
      const response = await fetch(`http://192.168.2.109:8301/Pvsyst/execute?session_id=${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('仿真执行失败');
      }

      const data = await response.json();
      setReportName(sessionId);
      
      // 如果返回了PDF内容，保存到WebContainer
      if (sessionId) {
        try {
            const response = await fetch(`http://192.168.2.109:8301/Pvsyst/download/${sessionId}`);
            if (!response.ok) {
              throw new Error('下载失败');
            }
      
            const blob = await response.blob();
            const pdfBuffer = new Uint8Array(await blob.arrayBuffer());
            console.log('pdfBuffer', pdfBuffer.length);
            await filesStore.createFile(`${sessionId}.pdf`, pdfBuffer);
        } catch (error) {
            console.error('下载错误:', error);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!reportName) return;
    
    try {
        const webcontainer = await workbenchStore.webcontainer;
        // 使用 'binary' 选项读取文件
        const buffer = await webcontainer.fs.readFile(reportName + '.pdf');
        
        if (buffer) {
            // 确保buffer是Uint8Array类型
            const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
            // 创建下载链接，明确指定PDF的MIME类型
            const blob = new Blob([uint8Array], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${reportName}.pdf`;
            
            // 使用click()方法前先添加到DOM
            document.body.appendChild(a);
            a.click();
            
            // 清理
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('下载PDF文件时出错:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">
        PVsyst 仿真工作台
      </h2>
      
      <div className="flex-1 flex gap-6">
        {/* Left Panel - File Selection */}
        <div className="w-1/3 bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-700">项目文件 (PRJ)</label>
              <select 
                value={selectedPrj}
                onChange={(e) => setSelectedPrj(e.target.value)}
                className="border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">选择PRJ文件</option>
                {prjFiles.map(file => (
                  <option key={file} value={file}>{file}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-700">仿真配置文件 (VCA)</label>
              <select
                value={selectedVca}
                onChange={(e) => setSelectedVca(e.target.value)}
                className="border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">选择VCA文件</option>
                {vcaFiles.map(file => (
                  <option key={file} value={file}>{file}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleExecute}
                disabled={isLoading || !selectedPrj || !selectedVca}
                className="flex-1 px-4 py-2 text-white rounded-md
                  bg-blue-500 hover:bg-blue-600
                  disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
              >
                {isLoading ? '执行中...' : '执行仿真'}
              </button>

              <button
                onClick={handleDownload}
                disabled={!reportName}
                className="flex-1 px-4 py-2 text-white rounded-md
                  bg-green-500 hover:bg-green-600
                  disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
              >
                下载报告
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Video Player */}
        <div className="w-2/3 bg-white rounded-lg shadow-sm p-6">
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
            <img 
              className="w-full h-full object-contain"
              src="http://192.168.2.109:31111/video_feed"
              crossOrigin="anonymous"
            >
            </img>
          </div>
          
          {reportName && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md shadow-sm">
              <p className="text-blue-700 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                仿真报告已生成: <span className="font-medium ml-2">{reportName}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}); 