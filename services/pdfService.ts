
import { PDFDocument, rgb, PageSizes, StandardFonts, PDFFont, PDFImage } from 'pdf-lib';
import { generateCoverImage } from './geminiService';

// A type guard for the pdfjsLib object from the CDN
declare const pdfjsLib: any;
// Fix: Add a type guard for the fontkit object from the CDN
declare const fontkit: any;

const fetchFont = (url: string) => fetch(url).then(res => res.arrayBuffer());

const createCoverPage = async (
  doc: PDFDocument, 
  chapterName: string, 
  instructorName: string,
  theme: string,
  setStatus: (message: string) => void
): Promise<void> => {
  try {
    setStatus("🤖 Generating AI cover page...");
    
    const coverImageResult = await generateCoverImage(chapterName, theme);
  
    const { data: imageBase64, mimeType } = coverImageResult;
    const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    
    let coverImage: PDFImage;
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      coverImage = await doc.embedJpg(imageBytes);
    } else if (mimeType === 'image/png') {
      coverImage = await doc.embedPng(imageBytes);
    } else {
      setStatus(`⚠️ Unsupported image format from AI: ${mimeType}. Skipping cover page.`);
      return;
    }
  
    const [holidayFontBytes, poppinsFontBytes] = await Promise.all([
      fetchFont('https://raw.githubusercontent.com/google/fonts/main/ofl/holtwoodonesc/HoltwoodOneSC-Regular.ttf'), // Holtwood One SC as "Holiday"
      fetchFont('https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf') // Poppins Bold
    ]);
    
    doc.registerFontkit(fontkit);
    const holidayFont = await doc.embedFont(holidayFontBytes, { subset: true });
    const poppinsFont = await doc.embedFont(poppinsFontBytes, { subset: true });
    
    const page = doc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    
    page.drawImage(coverImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  
    const cmToPoints = (cm: number) => cm * 28.3465;
    const margin_side = cmToPoints(3);
    const maxWidth = width - 2 * margin_side;
    const instructorFontSize = 17;
    const gap = 40;
  
    // --- Dynamic Font Sizing Logic ---
    let chapterFontSize = 65; // Start with a max font size
    const minFontSize = 10;
    const words = chapterName.split(' ');
  
    // Loop to find the largest possible font size where no single word exceeds the max width
    while (chapterFontSize > minFontSize) {
      let longestWordWidth = 0;
      for (const word of words) {
          const wordWidth = holidayFont.widthOfTextAtSize(word, chapterFontSize);
          if (wordWidth > longestWordWidth) {
              longestWordWidth = wordWidth;
          }
      }
      if (longestWordWidth > maxWidth) {
          chapterFontSize -= 1; // Decrease font size if the longest word is too wide
      } else {
          break; // Found a suitable font size
      }
    }
    // --- End of Dynamic Font Sizing Logic ---
  
    const wrapText = (text: string, font: PDFFont, fontSize: number, maxWidth: number) => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = words[0];
  
        if (!currentLine) return [];
  
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const widthOfText = font.widthOfTextAtSize(currentLine + " " + word, fontSize);
            if (widthOfText < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }
  
    const chapterLines = wrapText(chapterName, holidayFont, chapterFontSize, maxWidth);
    const chapterTextHeight = chapterLines.length * chapterFontSize;
  
    chapterLines.forEach((line, index) => {
      const textWidth = holidayFont.widthOfTextAtSize(line, chapterFontSize);
      page.drawText(line, {
        x: width / 2 - textWidth / 2,
        y: height / 2 - chapterTextHeight / 2 + (chapterLines.length - 1 - index) * chapterFontSize + 50,
        font: holidayFont,
        size: chapterFontSize,
        color: rgb(0, 0, 0), // Set to black
      });
    });
  
    if (instructorName && instructorName.trim() !== '') {
        const instructorText = `Instructor: ${instructorName}`;
        const instructorTextWidth = poppinsFont.widthOfTextAtSize(instructorText, instructorFontSize);
        page.drawText(instructorText, {
          x: width / 2 - instructorTextWidth / 2,
          y: height / 2 - chapterTextHeight / 2 - gap,
          font: poppinsFont,
          size: instructorFontSize,
          color: rgb(0, 0, 0), // Set to black
        });
    }

  } catch (error: any) {
    console.error("Error during AI cover page generation:", error);
    setStatus(`⚠️ Could not generate AI cover page. See console for details.`);
    setStatus("    - Skipping cover page and continuing...");
  }
};

const invertPdf = async (
    pdfBytes: ArrayBuffer,
    setStatus: (message: string) => void,
    signal: AbortSignal
): Promise<ArrayBuffer> => {
    const invertedDoc = await PDFDocument.create();
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let i = 0; i < numPages; i++) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        
        const page = await pdf.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error("Could not get canvas context");
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderTask = page.render({ canvasContext: context, viewport: viewport });
        
        const abortHandler = () => {
            renderTask.cancel();
        };

        signal.addEventListener('abort', abortHandler, { once: true });

        try {
            await renderTask.promise;
        } catch (error: any) {
            if (error.name !== 'RenderingCancelledException') {
                throw error; 
            }
        } finally {
            signal.removeEventListener('abort', abortHandler);
        }

        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        // Invert colors
        context.globalCompositeOperation = 'difference';
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        const invertedImageBytes = await new Promise<ArrayBuffer>((resolve) => {
            canvas.toBlob(blob => {
                if (!blob) throw new Error("Canvas to Blob failed");
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as ArrayBuffer);
                reader.readAsArrayBuffer(blob);
            }, 'image/jpeg', 0.8);
        });

        const image = await invertedDoc.embedJpg(invertedImageBytes);
        const newPage = invertedDoc.addPage([canvas.width, canvas.height]);
        newPage.drawImage(image, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        setStatus(`    - Inverted page ${i + 1}/${numPages}`);
    }

    return invertedDoc.save();
};

const layoutSlides = async (
  mergedPdfBytes: ArrayBuffer,
  setStatus: (message: string) => void,
  signal: AbortSignal
): Promise<ArrayBuffer> => {
    setStatus("📐 Applying 3-slides-per-page layout...");
    const srcDoc = await PDFDocument.load(mergedPdfBytes);
    const newDoc = await PDFDocument.create();
    const srcPages = srcDoc.getPages();

    const cmToPoints = (cm: number) => cm * 28.3465;

    const page_width = cmToPoints(21.2);
    const page_height = cmToPoints(29.6);
    const margin_top = cmToPoints(1.6);
    const margin_bottom = cmToPoints(1.0);
    const margin_side = cmToPoints(1.5);
    const spacing = 6; // points

    const available_height = page_height - margin_top - margin_bottom - 2 * spacing;
    const slide_height = available_height / 3;
    const slide_width = page_width - 2 * margin_side;

    const totalPages = Math.ceil(srcPages.length / 3);
    for (let i = 0; i < srcPages.length; i += 3) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        const page = newDoc.addPage([page_width, page_height]);
        for (let j = 0; j < 3; j++) {
            if (i + j < srcPages.length) {
                const [embeddedPage] = await newDoc.embedPages([srcPages[i + j]]);
                const top = page_height - margin_top - (j * (slide_height + spacing)) - slide_height;
                
                page.drawPage(embeddedPage, {
                    x: margin_side,
                    y: top,
                    width: slide_width,
                    height: slide_height,
                });
            }
        }
        
        const pageNumber = i / 3 + 1;
        const font = await newDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 13;
        const pageNumberText = `Page ${pageNumber}`;
        const textWidth = font.widthOfTextAtSize(pageNumberText, fontSize);
        
        page.drawText(pageNumberText, {
            x: page_width - margin_side - textWidth,
            y: 15,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
        });
        setStatus(`    - Laid out page ${pageNumber}/${totalPages}`);
    }

    return newDoc.save();
};


export const processPdfs = async (
  files: File[],
  chapterName: string,
  instructorName: string,
  theme: string,
  setStatus: (message: string) => void,
  signal: AbortSignal
): Promise<{ pdfBlob: Blob }> => {

    const finalPdfDoc = await PDFDocument.create();
    
    // Step 1: Create Cover Page
    if (chapterName && chapterName.trim() !== '') {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        await createCoverPage(finalPdfDoc, chapterName, instructorName, theme, setStatus);
    } else {
        setStatus("ℹ️ Skipping cover page (Chapter Name not provided).");
    }

    // Step 2: Invert and Merge PDFs
    const mergedInvertedPdf = await PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        setStatus(`🎨 Inverting colors for ${files[i].name} (${i + 1}/${files.length})...`);
        const fileBytes = await files[i].arrayBuffer();
        const invertedPdfBytes = await invertPdf(fileBytes, setStatus, signal);
        
        setStatus(`🔗 Merging ${files[i].name}...`);
        const sourcePdf = await PDFDocument.load(invertedPdfBytes);
        const copiedPages = await mergedInvertedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach(page => mergedInvertedPdf.addPage(page));
    }

    const mergedInvertedPdfBytes = await mergedInvertedPdf.save();

    // Step 3: Layout slides
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const laidOutPdfBytes = await layoutSlides(mergedInvertedPdfBytes, setStatus, signal);
    const laidOutPdf = await PDFDocument.load(laidOutPdfBytes);
    const laidOutPages = await finalPdfDoc.copyPages(laidOutPdf, laidOutPdf.getPageIndices());
    laidOutPages.forEach(page => finalPdfDoc.addPage(page));

    // Step 4: Finalize PDF
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    setStatus("💾 Finalizing PDF...");
    const finalPdfBytes = await finalPdfDoc.save();
    
    const pdfBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });

    return { pdfBlob };
};
