import type * as React from 'react';
import { useState } from 'react';
import { Archive, BookOpen, Circle, Download, FileUp, Plus, Settings, Star, X } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { FOLDER_COLORS } from '@/lib/color-palette';
import type { Folder } from '@/lib/types';
import { cn } from '@/lib/utils';

export type LibraryFilter = 'all' | 'favorites' | 'archive' | 'unread';
export type ImportStatus = 'idle' | 'importing' | 'done' | 'error';

const FILTERS: Array<{ id: LibraryFilter; label: string; icon: React.ElementType }> = [
  { id: 'all', label: 'All documents', icon: BookOpen },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'unread', label: 'Unread', icon: Circle },
  { id: 'archive', label: 'Archive', icon: Archive },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeFilter: LibraryFilter;
  activeFolderId: string | null;
  folders: Folder[];
  importStatus: ImportStatus;
  onFilterChange: (f: LibraryFilter) => void;
  onSelectFolder: (id: string) => void;
  onFolderCreate: (name: string, color: string) => void;
  onFolderDelete: (id: string) => void;
  onExportFolder: (id: string) => void;
  onDropDocument: (docId: string, folderId: string) => void;
  onImportClick: () => void;
  onOpenSettings: () => void;
}

export function AppSidebar({
  activeFilter,
  activeFolderId,
  folders,
  importStatus,
  onFilterChange,
  onSelectFolder,
  onFolderCreate,
  onFolderDelete,
  onExportFolder,
  onDropDocument,
  onImportClick,
  onOpenSettings,
  ...props
}: AppSidebarProps) {
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);

  function submitFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    onFolderCreate(name, newFolderColor);
    setNewFolderName('');
    setNewFolderColor(FOLDER_COLORS[0]);
    setShowFolderInput(false);
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BookOpen className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold tracking-[-0.01em]">Notch</span>
                <span className="text-xs text-muted-foreground">Knowledge base</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {FILTERS.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={activeFilter === id && activeFolderId === null}
                    onClick={() => onFilterChange(id)}
                    tooltip={label}
                  >
                    <Icon
                      className={cn(
                        activeFilter === id && activeFolderId === null
                          ? 'text-primary'
                          : 'text-muted-foreground',
                      )}
                    />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Collections</SidebarGroupLabel>
          <SidebarGroupAction title="New collection" onClick={() => setShowFolderInput((v) => !v)}>
            <Plus />
            <span className="sr-only">New collection</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {showFolderInput && (
              <div className="flex flex-col gap-1.5 px-2 pb-2 group-data-[collapsible=icon]:hidden">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitFolder();
                    if (e.key === 'Escape') setShowFolderInput(false);
                  }}
                  placeholder="Collection name"
                  className="notion-input text-xs"
                />
                <div className="flex flex-wrap gap-1">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewFolderColor(c)}
                      className="size-3.5 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        outline: newFolderColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '1px',
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={submitFolder}
                  className="text-left text-xs font-medium text-primary"
                >
                  Create
                </button>
              </div>
            )}
            <SidebarMenu>
              {folders.map((folder) => (
                <SidebarMenuItem
                  key={folder.id}
                  className="group/folder"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const docId = e.dataTransfer.getData('text/plain');
                    if (docId) onDropDocument(docId, folder.id);
                  }}
                >
                  <SidebarMenuButton
                    isActive={activeFolderId === folder.id}
                    onClick={() => onSelectFolder(folder.id)}
                    tooltip={folder.name}
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: folder.color }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    title="Export collection"
                    className="right-7"
                    onClick={() => onExportFolder(folder.id)}
                  >
                    <Download />
                    <span className="sr-only">Export collection</span>
                  </SidebarMenuAction>
                  <SidebarMenuAction
                    showOnHover
                    title="Delete collection"
                    onClick={() => onFolderDelete(folder.id)}
                  >
                    <X />
                    <span className="sr-only">Delete collection</span>
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onImportClick}
              disabled={importStatus === 'importing'}
              tooltip="Import PDF"
            >
              <FileUp className={cn(importStatus === 'error' && 'text-destructive')} />
              <span className={cn(importStatus === 'error' && 'text-destructive')}>
                {importStatus === 'importing'
                  ? 'Importing\u2026'
                  : importStatus === 'done'
                    ? 'Imported'
                    : importStatus === 'error'
                      ? 'Import failed \u2014 retry'
                      : 'Import PDF'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenSettings} tooltip="Settings">
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
