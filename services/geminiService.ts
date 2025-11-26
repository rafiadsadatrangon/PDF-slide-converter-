import { GoogleGenAI, Modality } from "@google/genai";

export const generateCoverImage = async (chapterName: string, theme: string): Promise<{ data: string; mimeType: string; }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `IMPORTANT RULE: The generated image is a background for a document cover. It MUST NOT contain any text, letters, words, numbers, or characters of any kind. The image must be purely graphical.

Create a highly aesthetic and stylish professional document cover image based on the chapter theme: "${chapterName}".

The visual style for the image must be: "${theme}".

The design must follow these strict visual guidelines:
- The entire image must be composed exclusively of shades of gray.
- DO NOT USE any pure white (#FFFFFF) or pure black (#000000) color.
- The background should be a very light gray to ensure high contrast for black text that will be added on top later.
- Use subtle, elegant gradients transitioning between various shades of light, medium, and dark gray to create a sense of depth and sophistication.
- Incorporate fluid, minimalist, abstract shapes and lines appropriate to the chosen style.
- The overall aesthetic must be minimalist, modern, and premium.
- The image should be an abstract, artistic interpretation inspired by the chapter theme and visual style.
- The image should have a standard A4 portrait aspect ratio.

Final Reminder: The image must be 100% free of any text or characters. It must only use shades of gray, with no pure white or pure black.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const candidate = response?.candidates?.[0];
        
        if (!candidate || !candidate.content || !candidate.content.parts) {
            if (response?.promptFeedback?.blockReason) {
                throw new Error(`AI Cover generation was blocked by safety settings. Reason: ${response.promptFeedback.blockReason}`);
            }
            throw new Error("AI Cover generation failed: The API returned an empty or invalid response. This may be due to content policy filters or an internal API error.");
        }

        for (const part of candidate.content.parts) {
            if (part.inlineData) {
                return { data: part.inlineData.data, mimeType: part.inlineData.mimeType }; // Return data and mimeType
            }
        }
        throw new Error("No image data found in Gemini API response, although the request was successful.");

    } catch (error: any) {
        console.error("Error generating cover image with Gemini API:", error);
        // Check for permission denied error which usually indicates an API key issue.
        if (error.toString().includes("PERMISSION_DENIED") || error.toString().includes("API key not valid")) {
            throw new Error("AI Cover generation failed due to an API key error. Please ensure your API key is valid, has the 'Generative Language API' enabled, and is correctly configured in your environment.");
        }
        // Re-throw the specific error if it's already an Error object, otherwise create a new one.
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to generate AI cover image due to an unknown network or API error.");
    }
};
