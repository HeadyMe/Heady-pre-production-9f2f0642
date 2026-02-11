// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: HeadyAI-IDE/src/components/FileExplorer.jsx                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Folder, File } from 'lucide-react';

const { ipcRenderer } = window.require('electron');

const FileExplorer = ({ path, onSelect }) => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContents = async () => {
      setLoading(true);
      try {
        const contents = await ipcRenderer.invoke('read-dir', path);
        setContents(contents);
      } catch (error) {
        console.error('Failed to read directory', error);
      } finally {
        setLoading(false);
      }
    };

    loadContents();
  }, [path]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">{path}</h3>
        <Button variant="outline" size="sm">Refresh</Button>
      </div>
      <div>
        {contents.map((item) => (
          <div key={item.path} className="flex items-center p-1 hover:bg-gray-700 cursor-pointer" onClick={() => onSelect(item)}>
            {item.isDirectory ? <Folder className="mr-2 h-4 w-4" /> : <File className="mr-2 h-4 w-4" />}
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileExplorer;
