
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { processPdfs } from './services/pdfService';
import { SpinnerIcon } from './components/Icons';
import Dropzone from './components/Dropzone';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { PDFDocument } from 'pdf-lib';

// Add type declarations for CDN scripts
declare const pdfjsLib: any;

// Define the structure for slide previews
interface Slide {
  file: File;
  pageNum: number; // 1-based
  imageDataUrl: string;
}

// === START: Embedded Components ===
// To avoid creating new files, helper components are defined here.

const DeleteIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);
  
interface SlidePreviewProps {
    previews: Slide[];
    selectedSlides: Set<number>;
    onSlideSelect: (index: number) => void;
    onDeleteSelected: () => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
}
  
const SlidePreview: React.FC<SlidePreviewProps> = ({
    previews,
    selectedSlides,
    onSlideSelect,
    onDeleteSelected,
    onSelectAll,
    onDeselectAll,
}) => {
    const allSelected = previews.length > 0 && selectedSlides.size === previews.length;

    return (
        <div className="flex flex-col h-full">
            <h2 className="text-3xl font-extrabold mb-4 text-center">Slide Preview & Edit</h2>
            <div className="mb-4 flex justify-center gap-4">
                <button onClick={allSelected ? onDeselectAll : onSelectAll} className="px-4 py-2 text-sm bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                    {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button
                    onClick={onDeleteSelected}
                    disabled={selectedSlides.size === 0}
                    className="px-4 py-2 text-sm bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <DeleteIcon /> Delete ({selectedSlides.size})
                </button>
            </div>
            <div className="flex-grow bg-white/5 p-2 rounded-2xl overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 status-box">
                {previews.map((preview, index) => (
                    <div
                        key={`${preview.file.name}-${preview.pageNum}-${index}`}
                        onClick={() => onSlideSelect(index)}
                        className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedSlides.has(index) ? 'border-pink-400 ring-2 ring-pink-400' : 'border-transparent'
                        }`}
                    >
                        <img src={preview.imageDataUrl} alt={`Slide ${index + 1}`} className="w-full h-auto aspect-[4/3] object-contain bg-gray-800" />
                        <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                            {index + 1}
                        </div>
                        {selectedSlides.has(index) && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <svg className="w-10 h-10 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <p className="text-xs text-center mt-2 text-white/70">Total Slides: {previews.length}</p>
        </div>
    );
};
// === END: Embedded Components ===

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [chapterName, setChapterName] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [theme, setTheme] = useState('Minimalist Abstract');
  const [status, setStatus] = useState<React.ReactNode[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedPdfBlob, setProcessedPdfBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // New states for preview feature
  const [uiState, setUiState] = useState<'idle' | 'previewsLoading' | 'previewing' | 'processing' | 'done' | 'error'>('idle');
  const [slidePreviews, setSlidePreviews] = useState<Slide[]>([]);
  const [selectedSlides, setSelectedSlides] = useState<Set<number>>(new Set());

  const getInitialStatusMessage = () => [
      <div key="initial-status" className="text-sm">
        <p className="text-base text-white">✅ Upload PDF files serially from the left panel and check preview from the right panel.</p>
        <p className="ml-4 text-white">👉 you can also delete unnecessary slides from the preview.</p>
        <div className="mt-4">
            <p className="text-white">This site creates:</p>
            <p className="ml-2">👉 AI-generated cover page</p>
            <p className="ml-2">👉 Inverted, merged, and formatted slides in a printable layout</p>
        </div>
        <p className="mt-4">🛠️ This process may take a while.</p>
        <p className="mt-4 text-red-500 font-bold">NOTE: AI cover page creation may not work for some users! We will fix it soon.</p>
    </div>
  ];

  const resetState = useCallback(() => {
    setFiles([]);
    setChapterName('');
    setInstructorName('');
    setTheme('Minimalist Abstract');
    setStatus(getInitialStatusMessage());
    setIsProcessing(false);
    setProcessedPdfBlob(null);
    setError(null);
    // Reset new states
    setUiState('idle');
    setSlidePreviews([]);
    setSelectedSlides(new Set());
  }, []);

  useState(resetState);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.substr(base64data.indexOf(',') + 1));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleDownload = async () => {
    if (!processedPdfBlob) {
      setError("No file to download.");
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const base64Data = await blobToBase64(processedPdfBlob);
        const fileName = "converted.pdf";
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });
        setStatus(prev => [...prev, `✅ Saved to Documents folder as ${fileName}`]);
      } else {
        const url = URL.createObjectURL(processedPdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
       console.error(err);
       setError(`❌ Download failed: ${err.message}`);
    }
  };

  const handleFilesSelected = (selectedFiles: FileList) => {
      if (selectedFiles.length > 0) {
        setFiles(Array.from(selectedFiles));
        setUiState('previewsLoading');
        setError(null);
        setProcessedPdfBlob(null);
        setStatus([]);
      }
  };
  
  const generateSlidePreviews = useCallback(async (filesToProcess: File[]) => {
      setStatus(['⏳ Generating slide previews... This might take a moment.']);
      const allPreviews: Slide[] = [];
      
      for (const file of filesToProcess) {
          try {
              const fileBytes = await file.arrayBuffer();
              const loadingTask = pdfjsLib.getDocument({ data: fileBytes });
              const pdf = await loadingTask.promise;
              
              for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const viewport = page.getViewport({ scale: 0.5 });
                  
                  const canvas = document.createElement('canvas');
                  const context = canvas.getContext('2d');
                  if (!context) continue;
                  
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  
                  await page.render({ canvasContext: context, viewport: viewport }).promise;
                  
                  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                  allPreviews.push({ file, pageNum: i, imageDataUrl });
              }
          } catch (e) {
              console.error("Error processing file for preview:", file.name, e);
              setError(`❌ Failed to generate previews for ${file.name}. It might be corrupted or password-protected.`);
              setUiState('error');
              return;
          }
      }
      
      setSlidePreviews(allPreviews);
      setSelectedSlides(new Set());
      setUiState('previewing');
  }, []);

  useEffect(() => {
      if (uiState === 'previewsLoading' && files.length > 0) {
          generateSlidePreviews(files);
      }
  }, [uiState, files, generateSlidePreviews]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (slidePreviews.length === 0) {
      setError("No slides to process. Please upload PDFs and keep at least one slide.");
      return;
    }

    setIsProcessing(true);
    setUiState('processing');
    setError(null);
    setStatus([]);
    setProcessedPdfBlob(null);
    abortControllerRef.current = new AbortController();

    try {
      setStatus(prev => [...prev, "📄 Preparing selected slides..."]);
      const mergedPdfDoc = await PDFDocument.create();
      const loadedDocs = new Map<File, PDFDocument>();

      for (const slide of slidePreviews) {
        if (abortControllerRef.current.signal.aborted) throw new DOMException("Aborted", "AbortError");
        if (!loadedDocs.has(slide.file)) {
          const fileBytes = await slide.file.arrayBuffer();
          const doc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
          loadedDocs.set(slide.file, doc);
        }
        const sourceDoc = loadedDocs.get(slide.file)!;
        const [copiedPage] = await mergedPdfDoc.copyPages(sourceDoc, [slide.pageNum - 1]);
        mergedPdfDoc.addPage(copiedPage);
      }

      const preProcessedPdfBytes = await mergedPdfDoc.save();
      const preProcessedFile = new File([preProcessedPdfBytes], "processed_slides.pdf", { type: 'application/pdf' });
      
      const { pdfBlob } = await processPdfs(
        [preProcessedFile],
        chapterName,
        instructorName,
        theme,
        (newMessage) => setStatus(prev => [...prev, newMessage]),
        abortControllerRef.current.signal
      );
      
      setProcessedPdfBlob(pdfBlob);
      setUiState('done');
      setStatus(prev => [...prev, "📦 File is ready! Click the download button below."]);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError("🚫 Process canceled by user.");
        setStatus([]);
        setUiState('previewing');
      } else {
        console.error(err);
        setError(`❌ Error: ${err.message}`);
        setStatus([]);
        setUiState('error');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [slidePreviews, chapterName, instructorName, theme]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleSlideSelect = (index: number) => {
    setSelectedSlides(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
      return newSelection;
    });
  };

  const handleDeleteSelected = () => {
    setSlidePreviews(prev => prev.filter((_, index) => !selectedSlides.has(index)));
    setSelectedSlides(new Set());
  };

  const handleSelectAll = () => {
    setSelectedSlides(new Set(slidePreviews.map((_, index) => index)));
  };

  const handleDeselectAll = () => {
    setSelectedSlides(new Set());
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-5 md:p-10">
      <main className="main-layout glass-box rounded-3xl shadow-2xl p-8 w-full max-w-6xl flex flex-col lg:flex-row gap-8">
        {/* Left Box */}
        <div className="box glass-box-inner rounded-2xl p-6 flex flex-col justify-center items-center w-full lg:w-1/2 min-h-[420px]">
          <h2 className="text-3xl font-extrabold mb-6 text-center">Upload & Configure</h2>
            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center justify-center space-y-5">
              <Dropzone onFilesSelected={handleFilesSelected} files={files} />
              <input 
                type="text" 
                value={chapterName}
                onChange={(e) => setChapterName(e.target.value)}
                placeholder="Enter Chapter Name (Optional)"
                className="w-full p-3 rounded-lg border border-white/20 bg-white/10 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
              />
              <div className="w-full">
                <label htmlFor="theme-select" className="w-full text-sm text-white/80 mb-2 block">Choose cover page type:</label>
                <select
                  id="theme-select"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  required
                  className="w-full p-3 rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem',
                  }}
                >
                  <option value="Minimalist Abstract">Minimalist Abstract Theme</option>
                  <option value="Geometric Patterns">Geometric Patterns Theme</option>
                  <option value="Nature & Organic">Nature & Organic Theme</option>
                  <option value="Tech & Circuits">Tech & Circuits Theme</option>
                  <option value="Vintage & Parchment">Vintage & Parchment Theme</option>
                  <option value="Cosmic & Nebula">Cosmic & Nebula Theme</option>
                  <option value="Blueprint Grid">Blueprint Grid Theme</option>
                  <option value="Art Deco">Art Deco Theme</option>
                </select>
              </div>
              <input 
                type="text" 
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="Enter Instructor Name (Optional)"
                className="w-full p-3 rounded-lg border border-white/20 bg-white/10 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
              />
              <button 
                type="submit" 
                disabled={isProcessing || uiState === 'previewsLoading'}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-purple-600 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl font-bold py-4 px-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
              >
                {isProcessing && <SpinnerIcon />}
                {isProcessing ? 'Converting...' : 'Convert PDF'}
              </button>
            </form>
        </div>

        {/* Right Box */}
        <div className="box glass-box-inner rounded-2xl p-6 flex flex-col w-full lg:w-1/2 min-h-[420px]">
          {uiState === 'previewing' ? (
              <SlidePreview
                previews={slidePreviews}
                selectedSlides={selectedSlides}
                onSlideSelect={handleSlideSelect}
                onDeleteSelected={handleDeleteSelected}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />
          ) : (
            <>
              <h2 className="text-3xl font-extrabold mb-6 text-center">
                {uiState === 'previewsLoading' ? 'Generating Previews' : 'Conversion Status'}
              </h2>
              <div className="status-box w-full flex-grow bg-white/5 p-4 rounded-2xl min-h-[200px] max-h-[300px] overflow-y-auto text-sm flex flex-col">
                {uiState === 'previewsLoading' ? (
                    <div className="text-center flex-grow flex flex-col items-center justify-center">
                        <SpinnerIcon />
                        <p className="mt-4 text-white/80">Reading PDFs & creating previews...</p>
                    </div>
                ) : (
                  <>
                    {error && <p className="text-red-400 font-bold mb-2">{error}</p>}
                    {status.map((msg, index) => {
                      if (typeof msg === 'string') {
                        return (
                          <p key={index} className={`mb-1 ${msg.startsWith('⚠️') ? 'text-yellow-300' : ''} ${msg.startsWith('✅') ? 'text-green-300' : ''} ${msg.startsWith('❌') ? 'text-red-400' : ''}`}>
                            {msg}
                          </p>
                        );
                      }
                      return <div key={index}>{msg}</div>;
                    })}
                  </>
                )}
              </div>
            </>
          )}

          <div className="mt-5 text-center flex flex-col items-center space-y-4">
            {isProcessing ? (
                <button 
                    onClick={handleCancel} 
                    className="w-60 text-center py-3 px-5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                    ❌ Cancel Conversion
                </button>
            ) : (
                <>
                    {processedPdfBlob && (
                        <button 
                            onClick={handleDownload}
                            className="w-60 text-center py-3 px-5 bg-gradient-to-r from-green-400 to-cyan-500 text-black font-bold rounded-xl shadow-md hover:shadow-lg transition-all inline-block"
                        >
                            📄 Download PDF
                        </button>
                    )}
                    <button 
                        onClick={resetState} 
                        className="w-60 text-center py-3 px-5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-purple-600 hover:to-pink-500 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
                    >
                        🔄 Start Over
                    </button>
                </>
            )}
          </div>
        </div>
      </main>
      <footer className="fixed top-2 right-3 text-white font-semibold text-sm opacity-80 text-shadow">
        PDF Slide Converter
      </footer>
    </div>
  );
};

export default App;
