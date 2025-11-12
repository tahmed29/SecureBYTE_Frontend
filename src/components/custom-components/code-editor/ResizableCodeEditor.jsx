import React, { useState, useEffect } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../ui/resizable';
import CodeEditor from './CodeEditor';
import FileTree from './FileTree';
import { FileTabBar, FileTabContent } from '../../ui/file-tab';
import ReviewModal from '../ai-review-panel/ReviewModal';
import { useUpdateFiles } from '@/hooks/useUpdateFiles';

export default function ResizableCodeEditor({ 
  tree,
  refetchFileTree,
  securityReview, 
  openFiles, 
  setOpenFiles, 
  activeFile, 
  setActiveFile, 
  projectId,
  isSecReviewLoading
}) {
  const { trackFileUpdate } = useUpdateFiles(); 

  useEffect(() => {
  if (activeFile) {
    console.log("Active file updated:", activeFile);
  }
}, [activeFile]);

  // Handle file rename to update open tabs
  const handleFileRenamed = (oldFile, newName, newPath) => {
    setOpenFiles((prevFiles) =>
      prevFiles.map((file) =>
        file.id === oldFile.id
          ? { ...file, name: newName, path: newPath }
          : file
      )
    );
    
    // Update active file if it's the one being renamed
    if (activeFile && activeFile.id === oldFile.id) {
      setActiveFile({ ...activeFile, name: newName, path: newPath });
    }
  };

  const openNewFile = (targetFile) => {
    console.log('Current open files', openFiles);
    console.log('About to open a file in the FileTabBar...');
    // Check if the file is already open
    const existingFile = openFiles.find(
      (file) => file.name === targetFile.name,
    );

    // If yes, switch that file to active
    if (!existingFile) {
      setOpenFiles((prevFiles) => [...prevFiles, targetFile]); // Add the target file to the array of currently-open files
    }

    console.log(targetFile); 

    setActiveFile(targetFile);
  };

  const closeFile = (targetFileName) => {
    const existingFile = openFiles.find((file) => file.name === targetFileName);

    if (existingFile) {
      // Remove the file from the array of currently-open files
      console.log('Closing file from FileTabBar');
      setOpenFiles((prevFiles) => {
        const updatedFiles = prevFiles.filter(
          (file) => file.name !== targetFileName,
        );

        if (activeFile && activeFile.name === targetFileName) {
          if (updatedFiles.length > 0) {
            const lastOpenedFile = updatedFiles[updatedFiles.length - 1];
            setActiveFile(lastOpenedFile);
          } else {
            setActiveFile(null);
          }
        }
        return updatedFiles;
      });
    }
  };

  const switchTab = (targetFile) => {
    console.log('Switching the tab in FileTabBar... ');
    const existingFile = openFiles.find(
      (file) => file.name === targetFile.name,
    );

    // If the file is currently open, set it to be active
    if (existingFile) {
      setActiveFile(targetFile);
    }

    console.log("Currently active file", activeFile); 
  };

  // TODO: Save file content to backend when users close the file tab
  const updateFileContent = ({ targetFile, newContent }) => {
    // Check if the file is currently open
    const existingFile = openFiles.find((file) => file.id === targetFile.id);

    if (existingFile) {
      // Update activeFile content
      setActiveFile({...targetFile, content: newContent}); 
      setOpenFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.id === targetFile.id ? { ...file, content: newContent } : file,
        ),
      );

      // Save to sessionStorage 
      trackFileUpdate({fileId: targetFile.id, fileName: targetFile.name, code: newContent}); 
    }

    console.log("Active file's content is updated:", targetFile.content); 
    console.log("CURRENTLY OPEN FILES", openFiles); 
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="border rounded-lg w-full"
    >
      <ResizablePanel defaultSize={20}>
        <FileTree
          tree={tree}
          refetchFileTree={refetchFileTree}
          onFileSelectFromFileTree={openNewFile} // Callback function for selecting a file from FileTree
          onFileRenamed={handleFileRenamed} // Callback for when a file is renamed
        />{' '}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="h-screen">
        <FileTabBar
          openFiles={openFiles}
          activeFile={activeFile}
          onOpenFile={openNewFile}
          onCloseFile={closeFile}
          onSwitchTab={switchTab}
        />
        <FileTabContent 
          activeFile={activeFile} 
          isDarkTheme={false}
          onEditorChange={updateFileContent}
        />
      </ResizablePanel>
      <ResizableHandle />
       <ResizablePanel defaultSize={25}>
        <ReviewModal 
          activeFile={activeFile} 
          securityReview={securityReview}
          projectId={projectId}
          isSecReviewLoading={isSecReviewLoading}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
