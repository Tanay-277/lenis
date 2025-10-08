import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_KEY);
const flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const proModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Rate limiting implementation
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequestsPerMinute = 15;
  private readonly timeWindow = 60000;
  private lastRequestTime = 0;
  private readonly minInterval = 4000;

  canMakeRequest(): boolean {
    const now = Date.now();
    
    if (now - this.lastRequestTime < this.minInterval) {
      return false;
    }

    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return this.requests.length < this.maxRequestsPerMinute;
  }

  recordRequest(): void {
    const now = Date.now();
    this.requests.push(now);
    this.lastRequestTime = now;
  }

  getTimeUntilNextRequest(): number {
    const now = Date.now();
    
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minInterval) {
      return this.minInterval - timeSinceLastRequest;
    }

    if (this.requests.length >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...this.requests);
      return this.timeWindow - (now - oldestRequest);
    }

    return 0;
  }
}

const rateLimiter = new RateLimiter();

// Legal-specific interfaces (removed budget stuff)
export interface ChatResponseItem {
  type: "text" | "list" | "suggestion" | "resource" | "warning" | "code";
  content: string;
  items?: string[];
  title?: string;
  url?: string;
  language?: string;
}

export interface StructuredChatResponse {
  title: string;
  summary: string;
  content: ChatResponseItem[];
}

// Enhanced error handling with model fallback
async function makeAPIRequestWithFallback<T>(
  requestFn: (model: any) => Promise<T>,
  useFlashFirst: boolean = true
): Promise<T> {
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before making another request.`);
  }

  const models = useFlashFirst ? [flashModel, proModel] : [proModel, flashModel];
  let lastError: any;

  for (const model of models) {
    try {
      rateLimiter.recordRequest();
      const result = await requestFn(model);
      return result;
    } catch (error: any) {
      console.error(`Request failed with model:`, error);
      lastError = error;

      if (error.message?.includes('429') || error.message?.includes('quota')) {
        console.log('Quota exceeded for this model, trying fallback...');
        continue;
      }

      throw error;
    }
  }

  if (lastError.message?.includes('429') || lastError.message?.includes('quota')) {
    throw new Error('All Gemini models have exceeded their quotas. Please try again later or upgrade your plan.');
  }

  throw lastError;
}

/**
 * Get structured legal chat response - FIXED VERSION
 */
export const getStructuredChatResponse = async (prompt: string): Promise<StructuredChatResponse> => {
  const requestFn = async (model: any) => {
    // Simplified prompt that forces JSON response
    const jsonPrompt = `You are a legal advisor for Indian law. Answer this question: ${prompt}

CRITICAL: You must respond with ONLY valid JSON in this exact format with no other text before or after:

{
  "title": "Brief title about the legal topic (max 50 characters)",
  "summary": "One sentence summary of your answer (max 100 characters)",
  "content": [
    {
      "type": "text",
      "content": "Main legal information and explanation"
    },
    {
      "type": "list",
      "title": "Key Points" ,
      "items": ["Point 1", "Point 2", "Point 3"]
    },
    {
      "type": "suggestion",
      "content": "Practical advice or next steps"
    },
    {
      "type": "warning",
      "content": "This is general legal information only, not specific legal advice. Consult a qualified lawyer for your specific situation."
    }
  ]
}

Respond with ONLY the JSON, no explanations, no markdown, no other text.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: jsonPrompt }] }],
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.1, // Very low temperature for consistent JSON
        topP: 0.8,
        topK: 10
      }
    });
    
    const response = await result.response;
    let text = (await response.text()).trim();
    
    // Clean up the response - remove markdown code blocks if present
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    text = text.replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, ''); // Remove leading/trailing whitespace
    
    console.log("Raw response:", text); // Debug log
    
    try {
      const parsed = JSON.parse(text);
      
      // Validate structure
      if (!parsed.title || !parsed.summary || !parsed.content) {
        throw new Error("Invalid response structure");
      }
      
      return parsed as StructuredChatResponse;
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Response text:", text);
      
      // Try to extract JSON from response if it contains other text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.title && parsed.summary && parsed.content) {
            return parsed as StructuredChatResponse;
          }
        } catch (extractError) {
          console.error("Failed to extract JSON:", extractError);
        }
      }
      
      // Fallback: create structured response from plain text
      return createFallbackResponse(text, prompt);
    }
  };

  return makeAPIRequestWithFallback(requestFn, true);
};

/**
 * Create a fallback structured response when JSON parsing fails
 */
function createFallbackResponse(text: string, originalPrompt: string): StructuredChatResponse {
  // Extract a reasonable title from the prompt
  let title = "Legal Information";
  if (originalPrompt.toLowerCase().includes('tenant')) title = "Tenant Rights";
  else if (originalPrompt.toLowerCase().includes('property')) title = "Property Law";
  else if (originalPrompt.toLowerCase().includes('divorce')) title = "Divorce Procedure";
  else if (originalPrompt.toLowerCase().includes('consumer')) title = "Consumer Rights";
  else if (originalPrompt.toLowerCase().includes('fir')) title = "FIR and Police Rights";

  // Create summary from first sentence or first 100 chars
  const sentences = text.split('.').filter(s => s.trim().length > 0);
  const summary = sentences.length > 0 
    ? sentences[0].substring(0, 100) + (sentences[0].length > 100 ? '...' : '.')
    : text.substring(0, 100) + (text.length > 100 ? '...' : '');

  return {
    title,
    summary,
    content: [
      {
        type: "text",
        content: text
      },
      {
        type: "warning",
        content: "This is general legal information only, not specific legal advice. Consult a qualified lawyer for your specific situation."
      }
    ]
  };
}

/**
 * Simple text response for when you just need basic text
 */
export const getGeminiResponse = async (prompt: string): Promise<string> => {
  const requestFn = async (model: any) => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `You are a legal advisor for Indian law. ${prompt}` }] }],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.3,
        topP: 0.8,
        topK: 20
      }
    });
    const response = await result.response;
    return response.text();
  };

  return makeAPIRequestWithFallback(requestFn, true);
};

// Utility functions
export const canMakeRequest = (): boolean => {
  return rateLimiter.canMakeRequest();
};

export const getTimeUntilNextRequest = (): number => {
  return rateLimiter.getTimeUntilNextRequest();
};

// Chat functions
export const startGeminiChat = (systemInstruction?: string) => {
  try {
    const chat = flashModel.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.3,
        topP: 0.8,
        topK: 20,
      },
      systemInstruction: systemInstruction || "You are a legal advisor assistant for Indian law. Provide helpful, accurate legal information.",
    });
    return chat;
  } catch (error) {
    console.error("Error starting Gemini chat:", error);
    throw error;
  }
};

export const sendChatMessage = async (chat: any, message: string): Promise<string> => {
  const requestFn = async () => {
    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
  };

  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  rateLimiter.recordRequest();
  return requestFn();
};