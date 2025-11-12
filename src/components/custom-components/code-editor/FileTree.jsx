import { useState, useRef, useEffect } from 'react';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '../../ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FolderCode,
  FolderPlus,
} from 'lucide-react';


import RenameSubmissionDialog from './file-tree/RenameSubmissionDialog';
import { toast } from 'sonner';
import { useProject } from '@/hooks/project/ProjectContext';
import { useAuth } from '@/hooks/auth/AuthContext';
import { moveSubmission } from '@/api';
import { NewSubmissionDialog } from '../NewSubmissionDialog';
import NewFolderDialog from '@/components/custom-components/NewFolderDialog';
import { DeleteSubmissionAlert } from '../DeleteSubmissionAlert';

import { useParams } from 'react-router';
import { ContextMenuLabel } from '@radix-ui/react-context-menu';

export default function FileTree({ tree, onFileSelectFromFileTree, refetchFileTree, onFileRenamed }) {
  const { projectId } = useParams();
  const { createFolderInProject, renameFolderInProject, loadFoldersFromBackend } = useProject();
  const { user } = useAuth();
  const [treeKey, setTreeKey] = useState(0); // For forcing re-render

  const [persistedFolders, setPersistedFolders] = useState(() => {
    try {
      const raw = sessionStorage.getItem(`secureBYTE_custom_folders_${projectId}`);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error('Error loading persisted folders', err);
      return {};
    }
  });

  // Load folders from backend on mount
  useEffect(() => {
    if (projectId && loadFoldersFromBackend) {
      loadFoldersFromBackend(projectId).then((folders) => {
        if (Object.keys(folders).length > 0) {
          setPersistedFolders(folders);
          setTreeKey(prev => prev + 1);
        }
      });
    }
  }, [projectId, loadFoldersFromBackend]);

  // Helper to update persistedFolders state and sessionStorage
  const persistFolders = (next) => {
    try {
      sessionStorage.setItem(`secureBYTE_custom_folders_${projectId}`, JSON.stringify(next));
      setPersistedFolders(next);
      setTreeKey(prev => prev + 1); // Force re-render without page reload
    } catch (err) {
      console.error('Error persisting folders', err);
    }
  };

  // Merge persisted folders into the server-derived tree so UI shows them
  const mergedTree = { ...tree };
  Object.entries(persistedFolders || {}).forEach(([path, folderNode]) => {
    const parts = path.split('/');
    let current = mergedTree;
    let currentPath = '';
    
    parts.forEach((part, idx) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (idx === parts.length - 1) {
        // Last part - the actual folder we're creating
        if (!current[part]) {
          current[part] = { 
            type: 'folder', 
            name: part, 
            path: currentPath,
            children: {} 
          };
        } else {
          // Update path if folder already exists
          current[part].path = currentPath;
        }
      } else {
        // Intermediate folder in the path
        if (!current[part]) {
          current[part] = { 
            type: 'folder', 
            name: part, 
            path: currentPath,
            children: {} 
          };
        } else if (!current[part].children) {
          // Ensure children object exists
          current[part].children = {};
        }
        current = current[part].children;
      }
    });
  });

  // Root-level drop zone state
  const [isRootDragOver, setIsRootDragOver] = useState(false);

  // Handle dropping items back to root level
  const handleRootDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsRootDragOver(true);
  };

  const handleRootDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDragOver(false);
  };

  const handleRootDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDragOver(false);

    const draggedType = e.dataTransfer.getData('type');
    const draggedPath = e.dataTransfer.getData('path');

    // If already at root level, do nothing
    if (!draggedPath.includes('/')) return;

    try {
      if (draggedType === 'folder') {
        // Move folder to root level
        const folderName = draggedPath.split('/').pop();
        
        await renameFolderInProject({ projectId, oldPath: draggedPath, newPath: folderName });
        
        // Update sessionStorage - move folder and all children to root
        const raw = sessionStorage.getItem(`secureBYTE_custom_folders_${projectId}`);
        const persisted = raw ? JSON.parse(raw) : {};
        
        const updatedFolders = {};
        Object.keys(persisted).forEach((path) => {
          if (path === draggedPath) {
            // This is the folder being moved to root
            updatedFolders[folderName] = { ...persisted[path], path: folderName };
          } else if (path.startsWith(draggedPath + '/')) {
            // This is a child folder - update its path relative to root
            const childSuffix = path.substring(draggedPath.length + 1);
            const newChildPath = `${folderName}/${childSuffix}`;
            updatedFolders[newChildPath] = { ...persisted[path], path: newChildPath };
          } else {
            // Keep other folders as-is
            updatedFolders[path] = persisted[path];
          }
        });
        
        persistFolders(updatedFolders);
        
        // Find and move all files within this folder to root level
        const filesToMove = [];
        const findFilesInFolder = (node, currentPath) => {
          if (!node || !node.children) return;
          Object.entries(node.children).forEach(([key, value]) => {
            if (value.type === 'file') {
              const filePath = value.path || `${currentPath}/${value.name}`;
              filesToMove.push({
                id: value.id,
                oldPath: filePath,
                fileName: value.name
              });
            } else if (value.type === 'folder') {
              const folderPath = value.path || `${currentPath}/${value.name}`;
              findFilesInFolder(value, folderPath);
            }
          });
        };
        
        // Find the dragged folder in the tree
        const findFolderNode = (tree, targetPath) => {
          const parts = targetPath.split('/');
          let current = tree;
          for (const part of parts) {
            if (current[part]) {
              if (current[part].type === 'folder') {
                if (current[part].path === targetPath) {
                  return current[part];
                }
                current = current[part].children || {};
              }
            }
          }
          return null;
        };
        
        const draggedFolderNode = findFolderNode(mergedTree || {}, draggedPath);
        if (draggedFolderNode) {
          findFilesInFolder(draggedFolderNode, draggedPath);
        }
        
        // Update all file paths in the backend
        if (user && filesToMove.length > 0) {
          console.log(`🔄 Moving ${filesToMove.length} file(s) to root - syncing to backend...`);
          await Promise.all(
            filesToMove.map(async (file) => {
              // Calculate the new path relative to root
              let relativePath;
              if (file.oldPath.startsWith(draggedPath + '/')) {
                relativePath = file.oldPath.substring(draggedPath.length + 1);
              } else {
                relativePath = file.fileName;
              }
              const newFilePath = `${folderName}/${relativePath}`;
              
              try {
                await moveSubmission(user.uid, file.id, newFilePath);
                console.log(`✅ Backend synced: ${file.oldPath} → ${newFilePath}`);
              } catch (err) {
                console.error(`❌ Failed to move file ${file.oldPath} to ${newFilePath}`, err);
              }
            })
          );
        }
        
        toast.success(`Folder moved to root${filesToMove.length > 0 ? ` with ${filesToMove.length} file(s)` : ''}`);
        
        if (refetchFileTree) {
          await refetchFileTree();
        }
      } else if (draggedType === 'file') {
        // Move file to root level
        const fileId = e.dataTransfer.getData('fileId');
        const fileName = draggedPath.split('/').pop();
        
        if (user && fileId) {
          console.log(`🔄 Moving file to root - syncing to backend: ${draggedPath} → ${fileName}`);
          await moveSubmission(user.uid, fileId, fileName);
          console.log(`✅ Backend synced: File moved to root as ${fileName}`);
          toast.success('File moved to root');
          
          if (refetchFileTree) {
            await refetchFileTree();
          }
        } else {
          toast.error('Unable to move file - missing user or file ID');
        }
      }
    } catch (err) {
      console.error('Error moving to root:', err);
      toast.error('Failed to move to root level');
    }
  };

  return (
    <div 
      className="flex flex-col text-sm h-full relative"
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
    >
      {/* Root drop indicator */}
      {isRootDragOver && (
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-primary bg-accent/10 z-10 flex items-center justify-center">
          <div className="bg-background/90 px-4 py-2 rounded-lg border border-primary">
            <p className="text-sm font-medium">Drop here to move to root</p>
          </div>
        </div>
      )}
      {' '}
      <SidebarHeader className="flex flex-row items-center justify-between bg-secondary">
        <h2 className="font-medium">Project Name</h2>
        <div className="flex flex-row items-center gap-2">
          {/* <FilePlus className="size-4" /> */}
          <NewSubmissionDialog variant={'icon'} projectId={projectId} />
          <NewFolderDialog
            variant="icon"
            onCreate={async (folderName) => {
              // Check if folder already exists
              if (persistedFolders[folderName]) {
                toast.error('A folder with this name already exists');
                throw new Error('Folder already exists');
              }
              
              try {
                console.log('Creating folder:', folderName, 'in project:', projectId);
                const result = await createFolderInProject({ projectId, folderPath: folderName });
                console.log('createFolderInProject result:', result);
                const next = { ...persistedFolders, [folderName]: { path: folderName } };
                persistFolders(next);
                toast.success('Folder created');
              } catch (err) {
                console.error('Error creating folder:', err);
                console.error('Error details:', err.message, err.stack);
                toast.error('Failed to create folder: ' + err.message);
                throw err;
              }
            }}
          />
        </div>
      </SidebarHeader>
      <SidebarContent 
        className="h-2/3"
      >
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {Object.entries(mergedTree).map(([key, value]) =>
                value.type === 'folder' ? (
                  <Folder
                    folder={value}
                    key={key}
                    onFileSelect={onFileSelectFromFileTree}
                    projectId={projectId}
                    renameFolderInProject={renameFolderInProject}
                    persistFolders={persistFolders}
                    persistedFolders={persistedFolders}
                    user={user}
                    refetchFileTree={refetchFileTree}
                    fullTree={mergedTree}
                    onFileRenamed={onFileRenamed}
                  />
                ) : (
                  <File
                    file={value}
                    index={key}
                    onFileSelect={onFileSelectFromFileTree}
                    projectId={projectId}
                    user={user}
                    refetchFileTree={refetchFileTree}
                    onFileRenamed={onFileRenamed}
                  />
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </div>
  );
}

function Folder({ folder, index, onFileSelect, projectId, renameFolderInProject, persistFolders, persistedFolders, user, refetchFileTree, fullTree, onFileRenamed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // Only show the folder name, not the full path, for renaming
  const folderPath = folder.path || folder.name;
  const folderName = folderPath.split('/').pop();
  const [renameValue, setRenameValue] = useState(folderName);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      // Use setTimeout to ensure DOM has updated after context menu closes
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [renaming]);

  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('type', 'folder');
    e.dataTransfer.setData('path', folder.path || folder.name);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const draggedType = e.dataTransfer.getData('type');
    const draggedPath = e.dataTransfer.getData('path');
    const targetFolderPath = folder.path || folder.name;

    // Prevent dropping into itself
    if (draggedPath === targetFolderPath) return;
    if (draggedPath.startsWith(targetFolderPath + '/')) return;

    try {
      if (draggedType === 'folder') {
        // Move folder into this folder
        const pathParts = draggedPath.split('/');
        const folderName = pathParts[pathParts.length - 1];
        const newPath = `${targetFolderPath}/${folderName}`;
        
        // Check if folder with same name already exists in target
        const rawStorage = sessionStorage.getItem(`secureBYTE_custom_folders_${projectId}`);
        const existingFolders = rawStorage ? JSON.parse(rawStorage) : {};
        if (existingFolders[newPath]) {
          toast.error('A folder with this name already exists in the target folder');
          return;
        }
        
        await renameFolderInProject({ projectId, oldPath: draggedPath, newPath });
        
        // Update sessionStorage - remove old path and add new path, plus update all child folders
        const updatedFolders = {};
        Object.keys(existingFolders).forEach((path) => {
          if (path === draggedPath) {
            // This is the folder being moved
            updatedFolders[newPath] = { ...existingFolders[path], path: newPath };
          } else if (path.startsWith(draggedPath + '/')) {
            // This is a child folder - update its path too
            const childSuffix = path.substring(draggedPath.length);
            const newChildPath = newPath + childSuffix;
            updatedFolders[newChildPath] = { ...existingFolders[path], path: newChildPath };
          } else {
            // Keep other folders as-is
            updatedFolders[path] = existingFolders[path];
          }
        });
        
        persistFolders(updatedFolders);
        
        // Find and move all files within this folder and its subfolders
        const filesToMove = [];
        const findFilesInFolder = (node, currentPath) => {
          if (!node || !node.children) return;
          Object.entries(node.children).forEach(([key, value]) => {
            if (value.type === 'file') {
              const filePath = value.path || `${currentPath}/${value.name}`;
              filesToMove.push({
                id: value.id,
                oldPath: filePath,
                fileName: value.name
              });
            } else if (value.type === 'folder') {
              const folderPath = value.path || `${currentPath}/${value.name}`;
              findFilesInFolder(value, folderPath);
            }
          });
        };
        
        // Find the dragged folder in the tree
        const findFolderNode = (tree, targetPath) => {
          const parts = targetPath.split('/');
          let current = tree;
          for (const part of parts) {
            if (current[part]) {
              if (current[part].type === 'folder') {
                if (current[part].path === targetPath) {
                  return current[part];
                }
                current = current[part].children || {};
              }
            }
          }
          return null;
        };
        
        const draggedFolderNode = findFolderNode(fullTree || {}, draggedPath);
        if (draggedFolderNode) {
          findFilesInFolder(draggedFolderNode, draggedPath);
        }
        
        // Update all file paths in the backend
        if (user && filesToMove.length > 0) {
          console.log(`🔄 Syncing ${filesToMove.length} file(s) to backend...`);
          await Promise.all(
            filesToMove.map(async (file) => {
              // Calculate the relative path from the dragged folder
              let relativePath;
              if (file.oldPath.startsWith(draggedPath + '/')) {
                // File is nested in the folder
                relativePath = file.oldPath.substring(draggedPath.length + 1);
              } else if (file.oldPath === `${draggedPath}/${file.fileName}`) {
                // File is directly in the folder
                relativePath = file.fileName;
              } else {
                // Fallback - just use the filename
                relativePath = file.fileName;
              }
              const newFilePath = `${newPath}/${relativePath}`;
              
              try {
                await moveSubmission(user.uid, file.id, newFilePath);
                console.log(`✅ Backend synced: ${file.oldPath} → ${newFilePath}`);
              } catch (err) {
                console.error(`❌ Failed to move file ${file.oldPath} to ${newFilePath}`, err);
              }
            })
          );
        }
        
        toast.success(`Folder moved${filesToMove.length > 0 ? ` with ${filesToMove.length} file(s)` : ''}`);
        
        // Refetch file tree to update UI
        if (refetchFileTree) {
          await refetchFileTree();
        }
      } else if (draggedType === 'file') {
        // Move file into this folder - need to update submission filename
        const fileId = e.dataTransfer.getData('fileId');
        const fileName = draggedPath.split('/').pop();
        const newPath = `${targetFolderPath}/${fileName}`;
        
        if (user && fileId) {
          console.log(`🔄 Syncing file to backend: ${draggedPath} → ${newPath}`);
          await moveSubmission(user.uid, fileId, newPath);
          console.log(`✅ Backend synced: File moved to ${newPath}`);
          toast.success('File moved');
          
          // Refetch file tree to update UI
          if (refetchFileTree) {
            await refetchFileTree();
          }
        } else {
          toast.error('Unable to move file - missing user or file ID');
        }
      }
    } catch (err) {
      console.error('Drop failed', err);
      toast.error('Failed to move item');
    }
  };

  return (
    <Collapsible key={index} defaultOpen={false} className="group/collapsible">
      <SidebarMenuItem>
        <ContextMenu>
          <CollapsibleTrigger asChild onClick={() => setIsOpen(!isOpen)}>
            <div
              draggable
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={isDragOver ? 'bg-blue-100 dark:bg-blue-900' : ''}
            >
              <ContextMenuTrigger>
                <SidebarMenuButton className="overflow-hidden">
                  {isOpen ? (
                      <ChevronDown className="stroke-secure-orange flex-shrink-0" />
                    ) : (
                      <ChevronRight className="stroke-secure-orange flex-shrink-0" />
                    )}
                    <FolderCode className="size-3 flex-shrink-0" />

                    {renaming ? (
                      <input
                        ref={inputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            
                            const currentPath = folder.path || folder.name;
                            const pathParts = currentPath.split('/');
                            const parentPath = pathParts.slice(0, -1).join('/');
                            const newPath = parentPath ? `${parentPath}/${renameValue}` : renameValue;
                            
                            // Validate: Check if new name is empty
                            if (!renameValue.trim()) {
                              toast.error('Folder name cannot be empty');
                              return;
                            }
                            
                            // Validate: Cannot rename to any ancestor folder's name
                            const ancestorNames = currentPath.split('/').slice(0, -1); // All parts except current folder
                            if (ancestorNames.includes(renameValue)) {
                              toast.error('Cannot rename to an ancestor folder name');
                              return;
                            }
                            
                            // Validate: Check if folder with new name already exists in the same parent
                            const raw = sessionStorage.getItem(`secureBYTE_custom_folders_${projectId}`);
                            const persisted = raw ? JSON.parse(raw) : {};
                            if (persisted[newPath] && newPath !== currentPath) {
                              toast.error('A folder with this name already exists');
                              return;
                            }
                            
                            try {
                              await renameFolderInProject({ projectId, oldPath: currentPath, newPath: newPath });
                              
                              // Update session storage for this folder and all child folders
                              const updatedFolders = {};
                              Object.keys(persisted).forEach((path) => {
                                if (path === currentPath) {
                                  // This is the folder being renamed
                                  updatedFolders[newPath] = { ...persisted[path], path: newPath };
                                } else if (path.startsWith(currentPath + '/')) {
                                  // This is a child folder - update its path too
                                  const childSuffix = path.substring(currentPath.length);
                                  const newChildPath = newPath + childSuffix;
                                  updatedFolders[newChildPath] = { ...persisted[path], path: newChildPath };
                                } else {
                                  // Keep other folders as-is
                                  updatedFolders[path] = persisted[path];
                                }
                              });
                              
                              persistFolders(updatedFolders);
                              
                              // Move all files within this folder
                              if (user && refetchFileTree) {
                                // Find all files in this folder from the tree
                                const filesToMove = [];
                                const findFilesInFolder = (node, currentFolderPath) => {
                                  if (!node || !node.children) return;
                                  Object.entries(node.children).forEach(([key, value]) => {
                                    if (value.type === 'file') {
                                      const filePath = value.path || `${currentFolderPath}/${value.name}`;
                                      filesToMove.push({
                                        id: value.id,
                                        oldPath: filePath,
                                        fileName: value.name
                                      });
                                    } else if (value.type === 'folder') {
                                      const folderSubPath = value.path || `${currentFolderPath}/${value.name}`;
                                      findFilesInFolder(value, folderSubPath);
                                    }
                                  });
                                };
                                
                                findFilesInFolder(folder, currentPath);
                                
                                // Update all file paths in the backend
                                if (filesToMove.length > 0) {
                                  console.log(`🔄 Moving ${filesToMove.length} file(s) after folder rename...`);
                                  await Promise.all(
                                    filesToMove.map(async (file) => {
                                      let relativePath;
                                      if (file.oldPath.startsWith(currentPath + '/')) {
                                        relativePath = file.oldPath.substring(currentPath.length + 1);
                                      } else {
                                        relativePath = file.fileName;
                                      }
                                      const newFilePath = `${newPath}/${relativePath}`;
                                      
                                      try {
                                        await moveSubmission(user.uid, file.id, newFilePath);
                                        console.log(`✅ Backend synced: ${file.oldPath} → ${newFilePath}`);
                                      } catch (err) {
                                        console.error(`❌ Failed to move file ${file.oldPath} to ${newFilePath}`, err);
                                      }
                                    })
                                  );
                                }
                                
                                await refetchFileTree();
                              }
                              
                              setRenaming(false);
                              toast.success('Folder renamed');
                            } catch (err) {
                              console.error('Rename failed', err);
                              toast.error('Failed to rename folder');
                            }
                          } else if (e.key === 'Escape') {
                            setRenaming(false);
                            setRenameValue(folderName);
                          }
                        }}
                        className="bg-transparent border-b border-gray-400 text-sm mx-2"
                      />
                    ) : (
                      <span className="truncate">{folder.name}</span>
                    )}
                </SidebarMenuButton>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-[200px]">
                <ContextMenuItem>
                  <button
                    onClick={() => {
                      setRenaming(true);
                    }}
                    className="w-full text-left"
                  >
                    Rename Folder
                  </button>
                </ContextMenuItem>
              </ContextMenuContent>
            </div>
          </CollapsibleTrigger>
        </ContextMenu>
        {isOpen &&
          Object.entries(folder.children).map(([key, value]) => (
            <CollapsibleContent key={key}>
              <SidebarMenuSub>
                {value.type === 'folder' ? (
                  <Folder
                    folder={value}
                    index={key}
                    onFileSelect={onFileSelect}
                    projectId={projectId}
                    renameFolderInProject={renameFolderInProject}
                    persistFolders={persistFolders}
                    persistedFolders={persistedFolders}
                    user={user}
                    refetchFileTree={refetchFileTree}
                    fullTree={fullTree}
                    onFileRenamed={onFileRenamed}
                  />
                ) : (
                  <File
                    file={value}
                    index={key}
                    onFileSelect={onFileSelect}
                    projectId={projectId}
                    user={user}
                    refetchFileTree={refetchFileTree}
                    onFileRenamed={onFileRenamed}
                  />
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          ))}
      </SidebarMenuItem>
    </Collapsible>
  );
}

function File({ file, index, onFileSelect, projectId, user, refetchFileTree, onFileRenamed }) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(file.name);
  const inputRef = useRef(null);

  // Auto-focus input when renaming starts
  useEffect(() => {
    if (renaming && inputRef.current) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [renaming]);

  const handleRename = async () => {
    if (!renameValue.trim() || renameValue === file.name) {
      setRenaming(false);
      setRenameValue(file.name);
      return;
    }

    try {
      // Preserve folder path when renaming
      const filePath = file.path || file.name;
      const pathParts = filePath.split('/');
      
      // Replace just the filename (last part) with the new name
      pathParts[pathParts.length - 1] = renameValue;
      const newPath = pathParts.join('/');
      
      // Update filename via backend API
      await moveSubmission(user.uid, file.id, newPath);
      
      // Notify parent component to update open tabs
      if (onFileRenamed) {
        onFileRenamed(file, renameValue, newPath);
      }
      
      toast.success('File renamed');
      setRenaming(false);
      
      // Refetch file tree to update UI
      if (refetchFileTree) {
        await refetchFileTree();
      }
    } catch (err) {
      console.error('Failed to rename file', err);
      toast.error('Failed to rename file');
      setRenameValue(file.name);
      setRenaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    } else if (e.key === 'Escape') {
      setRenaming(false);
      setRenameValue(file.name);
    }
  };

  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('type', 'file');
    e.dataTransfer.setData('path', file.path || file.name);
    e.dataTransfer.setData('fileId', file.id);
  };

  return (
    <SidebarMenuItem
      key={index}
      onClick={() => !renaming && onFileSelect(file)}
      className="rounded-lg"
      draggable
      onDragStart={handleDragStart}
    >
      <ContextMenu>
        <ContextMenuTrigger className="flex gap-2 items-center">
          <SidebarMenuButton>
            <FileCode className="size-4 flex-shrink-0" />
            {renaming ? (
              <input
                ref={inputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-b border-input focus:outline-none focus:border-ring"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{file.name}</span>
            )}
          </SidebarMenuButton>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setRenaming(true)}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem>
            <DeleteSubmissionAlert submission={file} />
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuItem>
  );
}
