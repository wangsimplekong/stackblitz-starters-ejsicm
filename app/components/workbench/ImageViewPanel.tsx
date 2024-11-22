import { useEffect, useState } from 'react'
import { workbenchStore } from '~/lib/stores/workbench';
import * as nodePath from 'node:path';
import ImagePreview from './ImagePreview';

interface ImageViewPanelProps {
  selectedFile: string | null
}

export function ImageViewPanel({ selectedFile }: ImageViewPanelProps) {
  const [imageUrl, setImageUrl] = useState<string>('')

  const readBinaryFile = async () => {
    if (!selectedFile) return false;
    const webcontainer = await workbenchStore.webcontainer
    const relativePath = nodePath.relative(webcontainer.workdir, selectedFile);
    const buffer = await webcontainer.fs.readFile(relativePath);
    return buffer;
  }

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      const buffer = await readBinaryFile();
      if (!buffer || !mounted) return;

      const blob = new Blob([buffer.buffer], { type: 'image/*' });
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    };

    loadImage();

    return () => {
      mounted = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [selectedFile]);

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        No image to display
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto p-4">
      <ImagePreview src={selectedFile} />
    </div>
  )
} 