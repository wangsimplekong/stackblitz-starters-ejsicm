import { useEffect, useState } from 'react'
import { workbenchStore } from '~/lib/stores/workbench';
import * as nodePath from 'node:path';

interface PdfViewPanelProps {
    selectedFile: string | null
}

export function PdfViewPanel({ selectedFile }: PdfViewPanelProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('')

  const readBinaryFile = async ()=> {
    if (!selectedFile) return false;
    const webcontainer = await workbenchStore.webcontainer
    const relativePath = nodePath.relative(webcontainer.workdir, selectedFile);
    const buffer = await webcontainer.fs.readFile(relativePath);
    return buffer;
  }

  useEffect(() => {
    let mounted = true;

    const loadPdf = async () => {
      const buffer = await readBinaryFile();
      if (!buffer || !mounted) return;

      const blob = new Blob([buffer.buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    };

    loadPdf();

    return () => {
      mounted = false;
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [selectedFile]);

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        没有PDF文件可以显示
      </div>
    )
  }

  return (
    <iframe 
      src={`${pdfUrl}#toolbar=1`}
      className="h-full w-full"
    />
  )
}
