import { GoogleGenAI, Type } from "@google/genai";

export interface FoodItem {
  name: string;
  calories: number;
  amount?: string;
}

const getAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY" || apiKey === "" || apiKey === "null") {
    const errorMsg = "API Key não encontrada.";
    console.error("[GeminiService] " + errorMsg);
    throw new Error(errorMsg);
  }
  return new GoogleGenAI({ apiKey });
};

// Helper function to handle retries and fallbacks
async function callGemini(params: any, retries = 2): Promise<any> {
  const ai = getAI();
  const models = ["gemini-3-flash-preview", "gemini-2.0-flash", "gemini-1.5-flash"];

  let lastError: any;

  for (const model of models) {
    for (let i = 0; i <= retries; i++) {
      try {
        console.log(`[GeminiService] Attempting ${model} (Try ${i + 1}/${retries + 1})...`);
        const response = await ai.models.generateContent({
          ...params,
          model: model,
        });
        return response;
      } catch (e: any) {
        lastError = e;
        const statusCode = e.status || (e.message?.includes("503") ? 503 : e.message?.includes("429") ? 429 : 0);

        console.warn(`[GeminiService] Error with ${model}:`, e.message);

        // If it's 404, the model doesn't exist, skip to next model
        if (statusCode === 404) break;

        // If it's 503 (High Demand) or 429 (Quota), wait and retry or switch model
        if (statusCode === 503 || statusCode === 429) {
          if (i < retries) {
            const waitTime = (i + 1) * 2000;
            console.log(`[GeminiService] Waiting ${waitTime}ms and retrying...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry same model
          }
        } else {
          // Other errors: try next model immediately
          break;
        }
      }
    }
  }

  throw lastError;
}

export async function extractFoodFromText(text: string): Promise<FoodItem[]> {
  try {
    console.log("[GeminiService] Extracting food from text:", text);

    const response = await callGemini({
      contents: `Analise o seguinte texto e identifique todos os alimentos. Para cada item, forneça a contagem estimada de calorias com base na quantidade mencionada (ex: "20g", "uma colher"). Se a quantidade não for especificada, assuma uma porção padrão.
      Retorne APENAS um array JSON de objetos com 'name' (string), 'calories' (number) e 'amount' (string, opcional). 
      Texto: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              calories: { type: Type.NUMBER },
              amount: { type: Type.STRING },
            },
            required: ["name", "calories"],
          },
        },
      },
    });

    const responseText = response.text || "[]";
    console.log("[GeminiService] Raw response:", responseText);

    let cleanJson = responseText.trim();
    if (cleanJson.includes("```json")) {
      cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
    } else if (cleanJson.includes("```")) {
      cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
    }

    const data = JSON.parse(cleanJson);
    console.log("[GeminiService] Extraction success:", data);
    return data;
  } catch (e: any) {
    console.error("[GeminiService] Extraction error:", e);
    alert(`Erro ao processar texto: ${e.message}. Tente novamente em instantes.`);
    return [];
  }
}

export async function searchFoodCalories(description: string): Promise<FoodItem[]> {
  try {
    console.log("[GeminiService] Searching food calories:", description);

    const response = await callGemini({
      contents: `O usuário disse: "${description}". Identifique os alimentos e suas contagens calóricas estimadas. Use o Google Search para encontrar informações precisas para as quantidades específicas mencionadas (ex: "20g", "uma colher", "um pote"). 
      Retorne APENAS um array JSON de objetos com 'name' (string), 'calories' (number) e 'amount' (string, opcional). 
      Exemplo: [{"name": "Mel", "calories": 60, "amount": "20g"}]`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              calories: { type: Type.NUMBER },
              amount: { type: Type.STRING },
            },
            required: ["name", "calories"],
          },
        },
      },
    });

    const responseText = response.text || "[]";
    console.log("[GeminiService] Raw response search:", responseText);

    let cleanJson = responseText.trim();
    if (cleanJson.includes("```json")) {
      cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
    } else if (cleanJson.includes("```")) {
      cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
    }

    const data = JSON.parse(cleanJson);
    console.log("[GeminiService] Search success:", data);
    return data;
  } catch (e: any) {
    console.error("[GeminiService] Search error:", e);
    alert(`Erro ao buscar calorias: ${e.message}. O serviço pode estar sobrecarregado.`);
    return [];
  }
}
