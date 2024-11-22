import { useStore } from '@nanostores/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { shortcutEventEmitter } from '~/lib/hooks';
import type { FileMap } from '~/lib/stores/files';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { Terminal, type TerminalRef } from './terminal/Terminal';
import JSZip from 'jszip';
import { PdfViewPanel } from './PdfViewPanel';
import { ImageViewPanel } from './ImageViewPanel';

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
}

const MAX_TERMINALS = 3;
const DEFAULT_TERMINAL_SIZE = 25;
const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    files,
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const theme = useStore(themeStore);
    const showTerminal = useStore(workbenchStore.showTerminal);

    const terminalRefs = useRef<Array<TerminalRef | null>>([]);
    const terminalPanelRef = useRef<ImperativePanelHandle>(null);
    const terminalToggledByShortcut = useRef(false);

    const [activeTerminal, setActiveTerminal] = useState(0);
    const [terminalCount, setTerminalCount] = useState(1);

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      return editorDocument !== undefined && unsavedFiles?.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    useEffect(() => {
      const unsubscribeFromEventEmitter = shortcutEventEmitter.on('toggleTerminal', () => {
        terminalToggledByShortcut.current = true;
      });

      const unsubscribeFromThemeStore = themeStore.subscribe(() => {
        for (const ref of Object.values(terminalRefs.current)) {
          ref?.reloadStyles();
        }
      });

      return () => {
        unsubscribeFromEventEmitter();
        unsubscribeFromThemeStore();
      };
    }, []);

    useEffect(() => {
      const { current: terminal } = terminalPanelRef;

      if (!terminal) {
        return;
      }

      const isCollapsed = terminal.isCollapsed();

      if (!showTerminal && !isCollapsed) {
        terminal.collapse();
      } else if (showTerminal && isCollapsed) {
        terminal.resize(DEFAULT_TERMINAL_SIZE);
      }

      terminalToggledByShortcut.current = false;
    }, [showTerminal]);

    const addTerminal = () => {
      if (terminalCount < MAX_TERMINALS) {
        setTerminalCount(terminalCount + 1);
        setActiveTerminal(terminalCount);
      }
    };

    const isPdfFile = useMemo(() => {
      if (!selectedFile) return false;
      return selectedFile.toLowerCase().endsWith('.pdf');
    }, [selectedFile]);

    const isImageFile = useMemo(() => {
      if (!selectedFile) return false;
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      return imageExtensions.some(ext => selectedFile.toLowerCase().endsWith(ext));
    }, [selectedFile]);
    
    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={10} collapsible>
              <div className="flex flex-col border-r border-bolt-elements-borderColor h-full">
                <PanelHeader>
                  <div className="i-ph:tree-structure-duotone shrink-0" />
                  Files
                  <div className="ml-auto flex gap-2">
                    <label className="cursor-pointer">
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        onChange={async (event) => {
                          const files = event.target.files;
                          if (!files?.length) return;

                          try {
                            // Process each selected file
                            for (const file of Array.from(files)) {
                              if (file.name.toLowerCase().endsWith('.zip')) {
                                const zip = new JSZip();
                                const zipContent = await zip.loadAsync(file);
                                
                                // Process each file in the zip
                                for (const [path, zipEntry] of Object.entries(zipContent.files)) {
                                  const cur_path = path.replace('/home/project/', '');
                                  if (!zipEntry.dir) {
                                    await workbenchStore.filesStore?.ensureDirectory(cur_path);
                                    const content = await zipEntry.async('uint8array');
                                    if (content && content.length > 0) {
                                      await workbenchStore.filesStore?.createFile(cur_path, content);
                                    }
                                  }
                                }
                              } else {
                                const reader = new FileReader();
                                
                                reader.onload = async () => {
                                  const filePath = `${file.name}`;
                                  const content = reader.result;
                                  
                                  const isBinary = file.type && !file.type.startsWith('text/');
                                  
                                  if (isBinary) {
                                    const buffer = content as ArrayBuffer;
                                    const uint8Array = new Uint8Array(buffer);
                                    await workbenchStore.filesStore?.createFile(filePath, uint8Array);
                                  } else {
                                    const text = content as string;
                                    await workbenchStore.filesStore?.createFile(filePath, text);
                                  }
                                  
                                  onFileSelect?.(filePath);
                                };

                                if (file.type && !file.type.startsWith('text/')) {
                                  reader.readAsArrayBuffer(file);
                                } else {
                                  reader.readAsText(file);
                                }
                              }
                            }
                          } catch (error) {
                            console.error('Failed to upload files:', error);
                          }
                        }}
                      />
                      <span className="i-ph:upload-simple text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive scale-120" />
                    </label>
                    <button
                      className="cursor-pointer"
                      onClick={async () => {
                        try {
                          const zip = new JSZip();
                          
                          if (files) {
                            for (const [path, fileInfo] of Object.entries(files)) {
                              const cur_path = path.replace('/home/project/', '');
                              if (typeof fileInfo?.content === 'string') {
                                zip.file(cur_path, fileInfo.content);
                              } else {
                                zip.file(cur_path, fileInfo?.content);
                              }
                            }
                          }
                          
                          const zipBlob = await zip.generateAsync({type: 'blob'});
                          
                          const formData = new FormData();
                          const projectName = window.location.pathname.split('/').pop() || 'project';
                          formData.append('file', zipBlob, `${projectName}.zip`);
                          
                          const response = await fetch('http://127.0.0.1:33111/upload', {
                            method: 'POST',
                            body: formData,
                          });
                          
                          if (!response.ok) {
                            throw new Error('Sync failed');
                          }
                          
                          alert('Project synced successfully!');
                          
                        } catch (error) {
                          console.error('Failed to sync project:', error);
                          // alert('Failed to sync project');
                        }
                      }}
                    >
                      Sync
                      <span className="i-ph:arrows-clockwise text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive scale-120" />
                    </button>
                  </div>
                </PanelHeader>
                <FileTree
                  className="h-full"
                  files={files}
                  hideRoot
                  unsavedFiles={unsavedFiles}
                  rootFolder={WORK_DIR}
                  selectedFile={selectedFile}
                  onFileSelect={onFileSelect}
                />
              </div>
            </Panel>
            <PanelResizeHandle />
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>
              <PanelHeader className="overflow-x-auto">
                {activeFileSegments?.length && (
                  <div className="flex items-center flex-1 text-sm">
                    <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                    {activeFileUnsaved && (
                      <div className="flex gap-1 ml-auto -mr-1.5">
                        <PanelHeaderButton onClick={onFileSave}>
                          <div className="i-ph:floppy-disk-duotone" />
                          Save
                        </PanelHeaderButton>
                        <PanelHeaderButton onClick={onFileReset}>
                          <div className="i-ph:clock-counter-clockwise-duotone" />
                          Reset
                        </PanelHeaderButton>
                      </div>
                    )}
                  </div>
                )}
              </PanelHeader>
              <div className="h-full flex-1 overflow-hidden">
              {isPdfFile ? (
        <PdfViewPanel selectedFile={selectedFile || null} />
      ) : isImageFile ? (
        <ImageViewPanel selectedFile={selectedFile || null} />
      ) : (
        <CodeMirrorEditor
          theme={theme}
          editable={!isStreaming && editorDocument !== undefined}
          settings={editorSettings}
          doc={editorDocument}
          autoFocusOnDocumentChange={!isMobile()}
          onScroll={onEditorScroll}
          onChange={onEditorChange}
          onSave={onFileSave}
        />
      )}
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <Panel
          ref={terminalPanelRef}
          defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
          minSize={10}
          collapsible
          onExpand={() => {
            if (!terminalToggledByShortcut.current) {
              workbenchStore.toggleTerminal(true);
            }
          }}
          onCollapse={() => {
            if (!terminalToggledByShortcut.current) {
              workbenchStore.toggleTerminal(false);
            }
          }}
        >
          <div className="h-full">
            <div className="bg-bolt-elements-terminals-background h-full flex flex-col">
              <div className="flex items-center bg-bolt-elements-background-depth-2 border-y border-bolt-elements-borderColor gap-1.5 min-h-[34px] p-2">

              <button
                      key={99}
                      className={classNames(
                        'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                        {
                          'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': activeTerminal===99,
                          'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                            !(activeTerminal===99),
                        },
                      )}
                      onClick={() => setActiveTerminal(99)}
                    >
                      <div className="i-ph:terminal-window-duotone text-lg" />
                      Base
                    </button>

                {Array.from({ length: terminalCount }, (_, index) => {
                  const isActive = activeTerminal === index;

                  return (
                    <button
                      key={index}
                      className={classNames(
                        'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                        {
                          'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': isActive,
                          'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                            !isActive,
                        },
                      )}
                      onClick={() => setActiveTerminal(index)}
                    >
                      <div className="i-ph:terminal-window-duotone text-lg" />
                      Terminal {terminalCount > 1 && index + 1}
                    </button>
                  );
                })}
                {terminalCount < MAX_TERMINALS && <IconButton icon="i-ph:plus" size="md" onClick={addTerminal} />}
                <IconButton
                  className="ml-auto"
                  icon="i-ph:caret-down"
                  title="Close"
                  size="md"
                  onClick={() => workbenchStore.toggleTerminal(false)}
                />
              </div>

              <Terminal
                    key={99}
                    className={classNames('h-full overflow-hidden', {
                      hidden: !(activeTerminal===99),
                    })}
                    ref={(ref) => {
                      terminalRefs.current.push(ref);
                    }}
                    onTerminalReady={(terminal) => workbenchStore.attachTerminal(terminal)}
                    onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                    theme={theme}
                  />

              {Array.from({ length: terminalCount }, (_, index) => {
                const isActive = activeTerminal === index;

                return (
                  <Terminal
                    key={index}
                    className={classNames('h-full overflow-hidden', {
                      hidden: !isActive,
                    })}
                    ref={(ref) => {
                      terminalRefs.current.push(ref);
                    }}
                    onTerminalReady={(terminal) => workbenchStore.attachTerminal(terminal)}
                    onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                    theme={theme}
                  />
                );
              })}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    );
  },
);
