
import React, { useState, useRef } from 'react';
import { UploadIcon, FileIcon } from './Icons';

interface DropzoneProps {
  onFilesSelected: (files: FileList) => void;
  files: File[] | null;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFilesSelected, files }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      onFilesSelected(droppedFiles);
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const baseClasses = "relative w-full h-32 p-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/40 transition-all duration-300 cursor-pointer";
  const draggingClasses = "border-solid border-pink-400 bg-white/20";
  const hoverClasses = "hover:border-white/60 hover:bg-white/10";
  
  return (
    <div 
      className={`${baseClasses} ${isDragging ? draggingClasses : hoverClasses}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      aria-label="File upload dropzone"
    >
      <input 
        ref={fileInputRef}
        type="file" 
        multiple 
        required 
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      {(!files || files.length === 0) ? (
        <div className="text-center">
          <UploadIcon />
          <p className="text-sm text-white/80"><span className="font-semibold">Click to upload</span> or drag and drop</p>
          <p className="text-xs text-white/60">PDF files only</p>
        </div>
      ) : (
        <div className="w-full h-full overflow-y-auto">
          <p className="text-sm font-semibold text-white mb-2 text-center">Selected files:</p>
          <ul className="list-none p-0 m-0">
            {Array.from(files).map((file: File, index) => (
              <li key={index} className="text-xs text-white/90 flex items-center bg-white/10 p-1 rounded mb-1">
                <FileIcon />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Dropzone;
