import { memo, useState, useEffect } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import type { FilesStore } from '~/lib/stores/files';

interface ImageMergeTo3DProps {
    filesStore: FilesStore;
    fileCount: number;
}

export const ImageMergeTo3D = memo(({ filesStore, fileCount }: ImageMergeTo3DProps) => {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelName, setModelName] = useState<string>('');

  const generateRandomString = () => {
    const chars = '0123456789';
    let result = 'MODEL_';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  useEffect(() => {
    const updateFilesList = () => {
      const files = filesStore.files.get();
      const imageSet = new Set<string>();
      
      Object.entries(files).forEach(([path, dirent]) => {
        if (dirent?.type === 'file') {
          const relativePath = path.replace(WORK_DIR, '').replace(/^\//, '');
          if (/\.(jpg|jpeg|png)$/i.test(path)) {
            imageSet.add(relativePath);
          }
        }
      });

      const imageList = Array.from(imageSet);
      setImageFiles(imageList);
    };

    updateFilesList();
  }, [fileCount]);

  const handleExecute = async () => {
    if (selectedImages.length === 0) {
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    
    // 获取所有选中图片的内容
    const imageBlobs = await Promise.all(
      selectedImages.map(async (imagePath) => {
        const file = filesStore.getFile(imagePath);
        const buffer = file?.content;
        // console.log('======buffer====', buffer?.length);
        if (!buffer) return null;
        const blob = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        return file ? new File([blob], imagePath, {
            type: file.type || 'image/jpeg', // 根据实际情况设置 MIME 类型
            lastModified:  Date.now()
          }) : null;
      })
    );

    // 过滤掉空值并添加到formData
    imageBlobs.forEach((blob, index) => {
      if (blob) {
        formData.append(`images`, blob);
      }
    });

    let sessionId = generateRandomString();

    try {
      const response = await fetch(`http://192.168.2.109:8301/HeliconFocusPro/execute?session_id=${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('3D重建失败');
      }

      const data = await response.json();
      setModelName(sessionId);
      
      if (sessionId) {
        try {
          const response = await fetch(`http://192.168.2.109:8301/HeliconFocusPro/download/${sessionId}`);
          if (!response.ok) {
            throw new Error('下载失败');
          }
    
          const blob = await response.blob();
          const modelBuffer = new Uint8Array(await blob.arrayBuffer());
          await filesStore.createFile(`${sessionId}.tiff`, modelBuffer);
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
    if (!modelName) return;
    
    try {
      const webcontainer = await workbenchStore.webcontainer;
      const buffer = await webcontainer.fs.readFile(modelName + '.jpg');
      
      if (buffer) {
        const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const blob = new Blob([uint8Array], { type: 'image/jpg' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${modelName}.jpg`;
        
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('下载3D模型文件时出错:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">
        图像3D重建工作台
      </h2>
      
      <div className="flex-1 flex gap-6">
        <div className="w-1/3 bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-700">选择图片文件</label>
              <select 
                multiple
                value={selectedImages}
                onChange={(e) => setSelectedImages(Array.from(e.target.selectedOptions, option => option.value))}
                className="border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-48"
              >
                {imageFiles.map(file => (
                  <option key={file} value={file}>{file}</option>
                ))}
              </select>
              <p className="text-sm text-gray-500">按住Ctrl键可选择多张图片</p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleExecute}
                disabled={isLoading || selectedImages.length === 0}
                className="flex-1 px-4 py-2 text-white rounded-md
                  bg-blue-500 hover:bg-blue-600
                  disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
              >
                {isLoading ? '处理中...' : '开始重建'}
              </button>

              <button
                onClick={handleDownload}
                disabled={!modelName}
                className="flex-1 px-4 py-2 text-white rounded-md
                  bg-green-500 hover:bg-green-600
                  disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
              >
                下载模型
              </button>
            </div>
          </div>
        </div>

        <div className="w-2/3 bg-white rounded-lg shadow-sm p-6">
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
            <img 
              className="w-full h-full object-contain"
              src="http://192.168.2.109:31111/video_feed"
              crossOrigin="anonymous"
            >
            </img>
          </div>
          
          {modelName && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md shadow-sm">
              <p className="text-blue-700 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                3D模型已生成: <span className="font-medium ml-2">{modelName}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});