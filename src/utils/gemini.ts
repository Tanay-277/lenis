import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

declare module "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_KEY);
const flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const proModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

interface ChatModel {
  sendMessage(message: string): Promise<{
    response: {
      text(): string;
    };
  }>;
}

// Response type is defined by the ChatModel interface above

// Rate limiting implementation - OPTIMIZED
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequestsPerMinute = 30; // Increased from 15
  private readonly timeWindow = 60000;
  private lastRequestTime = 0;
  private readonly minInterval = 1000; // Reduced from 4000ms to 1000ms

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
  requestFn: (model: GenerativeModel) => Promise<T>,
  useFlashFirst: boolean = true
): Promise<T> {
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before making another request.`);
  }

  const models = useFlashFirst ? [flashModel, proModel] : [proModel, flashModel];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      rateLimiter.recordRequest();
      const result = await requestFn(model);
      return result;
    } catch (error) {
      console.error(`Request failed with model:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message?.includes('429') || lastError.message?.includes('quota')) {
        console.log('Quota exceeded for this model, trying fallback...');
        continue;
      }

      throw lastError;
    }
  }

  if (lastError?.message?.includes('429') || lastError?.message?.includes('quota')) {
    throw new Error('All Gemini models have exceeded their quotas. Please try again later or upgrade your plan.');
  }

  throw lastError || new Error('Unknown error occurred');
}

/**
 * Get structured legal chat response - FIXED VERSION
 */
export const getStructuredChatResponse = async (prompt: string): Promise<StructuredChatResponse> => {
  const requestFn = async (model: GenerativeModel) => {
    // Simplified prompt that forces JSON response
    const jsonPrompt = `You are a legal advisor for Indian law. Analyze this legal question and provide a structured response: ${prompt}

CRITICAL: Respond with ONLY valid JSON in this exact format with no other text before or after:

{
  "title": "Brief title about the legal topic (max 50 characters)",
  "summary": "Clear one-sentence summary of the case and main conclusion (max 100 characters)",
  "content": [
    {
      "type": "text",
      "content": "Detailed legal analysis of the situation, focusing on key legal principles, relevant laws, and precedents."
    },
    {
      "type": "list",
      "title": "Key Legal Issues",
      "items": [
        "Issue 1: Clear statement of each major legal issue",
        "Issue 2: Focus on statutory provisions and legal principles",
        "Issue 3: Include relevant case law or precedents"
      ]
    },
    {
      "type": "list",
      "title": "Rights and Obligations",
      "items": [
        "Legal right/obligation 1: Explain specific rights under applicable laws",
        "Legal right/obligation 2: Detail corresponding obligations",
        "Legal right/obligation 3: Include timeframes and conditions"
      ]
    },
    {
      "type": "list",
      "title": "Recommended Actions",
      "items": [
        "Action 1: Specific, actionable step with timeframe",
        "Action 2: Include required documents or procedures",
        "Action 3: Consider alternative approaches"
      ]
    },
    {
      "type": "list",
      "title": "Potential Risks",
      "items": [
        "Risk 1: Legal implications and challenges",
        "Risk 2: Procedural complications",
        "Risk 3: Timeline and cost considerations"
      ]
    },
    {
      "type": "suggestion",
      "content": "Clear, prioritized next steps with specific guidance on documentation and procedures required."
    },
    {
      "type": "warning",
      "content": "This analysis provides general legal information only. Laws vary by jurisdiction and circumstances. Consult a qualified lawyer for specific legal advice."
    }
  ]
}

IMPORTANT:
- Do NOT use markdown formatting (no **, ##, ###, etc.)
- Use only plain text in all responses
- Ensure all strings are properly escaped with double quotes
- Do not include line breaks within content strings

Respond with ONLY the JSON, no explanations, no markdown, no other text.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: jsonPrompt }] }],
      generationConfig: {
        maxOutputTokens: 4096, // Reduced from 8192 for faster responses
        temperature: 0.3,      // Optimized for balance between speed and quality
        topP: 0.9,            // Slightly reduced for faster token selection
        topK: 30              // Reduced for faster processing
      }
    });
    
    const response = await result.response;
    let text = (await response.text()).trim();
    
    // Clean up the response - remove markdown formatting and clean up the text
    text = text
      .replace(/```json\s*/g, '')  // Remove JSON code blocks
      .replace(/```\s*/g, '')      // Remove other code blocks
      .replace(/\*\*/g, '')        // Remove bold markdown
      .replace(/###\s*/g, '')      // Remove h3 headers
      .replace(/##\s*/g, '')       // Remove h2 headers
      .replace(/#\s*/g, '')        // Remove h1 headers
      .replace(/\n+/g, ' ')        // Replace multiple newlines with space
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();                     // Remove leading/trailing whitespace
    
    console.log("Raw response:", text); // Debug log
    
    // Try to find and extract a JSON object
    const jsonMatches = text.match(/\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g);
    if (jsonMatches) {
      text = jsonMatches[jsonMatches.length - 1]; // Take the last JSON object found
    }
    
    try {
      const parsed = JSON.parse(text);
      
      // Handle case where we get a single ChatResponseItem instead of full structure
      if (parsed.type && parsed.content && !parsed.title && !parsed.summary) {
        const chatItem = parsed as ChatResponseItem;
        return {
          title: "Legal Analysis",
          summary: chatItem.content.substring(0, 100) + "...",
          content: [chatItem]
        };
      }
      
      // Validate structure for full response
      if (!parsed.title || !parsed.summary || !parsed.content) {
        console.log("Received incomplete response, constructing full response");
        // Try to construct a valid response from what we received
        return {
          title: parsed.title || "Legal Analysis",
          summary: parsed.summary || (typeof parsed.content === 'string' ? 
            parsed.content.substring(0, 100) + "..." : 
            "Analysis of your legal question"),
          content: Array.isArray(parsed.content) ? parsed.content : [
            {
              type: "text",
              content: typeof parsed.content === 'string' ? 
                parsed.content : 
                JSON.stringify(parsed)
            }
          ]
        };
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
          // Try both full response and single item formats
          if (parsed.title && parsed.summary && parsed.content) {
            return parsed as StructuredChatResponse;
          } else if (parsed.type && parsed.content) {
            return {
              title: "Legal Analysis",
              summary: parsed.content.substring(0, 100) + "...",
              content: [parsed as ChatResponseItem]
            };
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
export const analyzeLegalCase = async (text: string): Promise<string> => {
  const legalAnalysisPrompt = `As a legal expert specializing in Indian law, analyze this case and provide a structured analysis. Format your response in markdown with the following sections:

### Summary
- Brief overview of the case and its context
- Identify all parties involved and their roles
- State the core legal questions to be addressed

### Legal Issues
1. Primary Legal Issues:
   - Detail each major legal issue separately
   - Explain why each issue is legally significant
   - Identify the governing laws for each issue

2. Secondary Considerations:
   - Jurisdictional requirements
   - Procedural requirements
   - Time limitations or deadlines

3. Rights and Obligations:
   - Enumerate specific legal rights of each party
   - List corresponding legal obligations
   - Note any statutory duties

### Precedents & Authority
1. Relevant Cases:
   - List similar cases with outcomes
   - Highlight key precedent-setting decisions
   - Note any conflicting judgments

2. Statutory Framework:
   - Cite specific sections of applicable laws
   - Reference relevant rules and regulations
   - Include any pertinent governmental orders

### Analysis
1. Issue Analysis:
   - Break down each legal issue
   - Apply relevant laws to the facts
   - Consider both supporting and opposing arguments

2. Evidence Assessment:
   - Evaluate available evidence
   - Identify missing crucial information
   - Assess strength of legal position

### Recommended Actions
1. Immediate Steps:
   - List urgent actions needed
   - Specify filing deadlines
   - Detail documentation requirements

2. Legal Procedures:
   - Outline court/tribunal procedures
   - List required legal forms
   - Note any mandatory waiting periods

3. Alternative Approaches:
   - Consider mediation/arbitration
   - Suggest settlement options
   - Propose alternative resolutions

### Next Steps
1. Documentation:
   - List all required documents
   - Specify format requirements
   - Note authentication needs

2. Timeline:
   - Create action item timeline
   - Note critical deadlines
   - Plan for contingencies

3. Professional Support:
   - Type of lawyer needed
   - Other experts required
   - Estimated timeframes

Please analyze the following text:
${text}`;

  const requestFn = async (model: GenerativeModel) => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: legalAnalysisPrompt }] }],
      generationConfig: {
        maxOutputTokens: 3072, // Reduced from 8192 for faster analysis
        temperature: 0.3,
        topP: 0.85,
        topK: 25
      }
    });
    const response = await result.response;
    return response.text();
  };

  return makeAPIRequestWithFallback(requestFn, true);
};

export const getGeminiResponse = async (prompt: string): Promise<string> => {
  const requestFn = async (model: GenerativeModel) => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `You are a legal advisor for Indian law. ${prompt}` }] }],
      generationConfig: {
        maxOutputTokens: 800, // Increased slightly for better responses
        temperature: 0.3,
        topP: 0.85,
        topK: 25
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
export const startGeminiChat = (systemInstruction?: string): ChatModel => {
  try {
    const chat = flashModel.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1024, // Increased from 600 for better responses
        temperature: 0.3,
        topP: 0.85,
        topK: 25,
      },
      systemInstruction: systemInstruction || "You are a legal advisor assistant for Indian law. Provide helpful, accurate legal information.",
    });
    return chat;
  } catch (error) {
    console.error("Error starting Gemini chat:", error);
    throw error;
  }
};

export const sendChatMessage = async (chat: ChatModel, message: string): Promise<string> => {
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