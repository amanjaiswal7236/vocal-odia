import { GoogleGenAI } from '@google/genai';

/**
 * Detect the language of a given text using Google Gemini API
 * Returns the language code (e.g., 'en', 'hi', 'or', etc.) or 'unknown' if detection fails
 */
export async function detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (!apiKey || !text || text.trim().length === 0) {
    return { language: 'unknown', confidence: 0 };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: `Detect the language of this text. Return ONLY a JSON object with "language" (ISO 639-1 code like "en", "hi", "or", "mr", etc.) and "confidence" (0-1). If the text is primarily English, return "en". Text: "${text.substring(0, 500)}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object" as const,
          properties: {
            language: { type: "string" },
            confidence: { type: "number" }
          },
          required: ["language", "confidence"]
        }
      }
    });

    // Try to get response text from different possible formats
    const responseText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let result: any = {};
    
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from markdown code blocks
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').trim();
      }
      try {
        result = JSON.parse(jsonText);
      } catch (e) {
        console.error('Failed to parse language detection response:', e);
      }
    }
    
    return {
      language: result.language || 'unknown',
      confidence: result.confidence || 0
    };
  } catch (error: any) {
    // Handle quota/rate limit errors gracefully
    const isQuotaError = error?.status === 429 || error?.error?.code === 429 || 
                         error?.message?.includes('429') || error?.message?.includes('quota') ||
                         error?.message?.includes('RESOURCE_EXHAUSTED');
    const isApiKeyError = error?.status === 400 || error?.error?.code === 400 ||
                          error?.message?.includes('API key') || error?.message?.includes('INVALID_ARGUMENT');
    
    if (isQuotaError || isApiKeyError) {
      console.warn('Language detection API unavailable (quota/key issue), using fallback detection');
    } else {
      console.error('Error detecting language:', error);
    }
    
    // Fallback: simple heuristic check for English
    // Check if text contains mostly English characters
    const englishPattern = /^[a-zA-Z0-9\s.,!?'"\-:;()]+$/;
    const textTrimmed = text.trim();
    
    if (textTrimmed.length === 0) {
      return { language: 'unknown', confidence: 0 };
    }
    
    // Check if text is primarily English (at least 80% English characters)
    const englishChars = textTrimmed.match(/[a-zA-Z0-9\s.,!?'"\-:;()]/g)?.length || 0;
    const totalChars = textTrimmed.length;
    const englishRatio = englishChars / totalChars;
    
    if (englishPattern.test(textTrimmed) || englishRatio > 0.8) {
      return { language: 'en', confidence: Math.min(0.9, englishRatio) };
    }
    
    // Check for common Indian language patterns
    const devanagariPattern = /[\u0900-\u097F]/; // Hindi, Marathi, etc.
    const odiaPattern = /[\u0B00-\u0B7F]/; // Odia script
    
    if (devanagariPattern.test(textTrimmed)) {
      return { language: 'hi', confidence: 0.8 }; // Likely Hindi/Marathi
    }
    if (odiaPattern.test(textTrimmed)) {
      return { language: 'or', confidence: 0.8 }; // Likely Odia
    }
    
    return { language: 'unknown', confidence: 0 };
  }
}

/**
 * Check if a message should be flagged (non-English)
 */
export function shouldFlagMessage(language: string): boolean {
  return language !== 'en' && language !== 'unknown';
}
