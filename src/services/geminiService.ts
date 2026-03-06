import { GoogleGenAI, Type } from "@google/genai";

export interface FoodItem {
  name: string;
  calories: number;
  amount?: string;
}

const getAI = () => {
  // Support both standard Vite env vars and the process.env defined in vite.config.ts
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  // Debug info (safe to log existence and length, but not the key itself)
  console.log("[GeminiService] API Key check:", { 
    hasViteKey: !!import.meta.env.VITE_GEMINI_API_KEY, 
    hasProcessKey: !!process.env.GEMINI_API_KEY,
    keyLength: apiKey?.length || 0,
    envMode: import.meta.env.MODE
  });

  if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY" || apiKey === "" || apiKey === "null") {
    const errorMsg = "API Key não encontrada. Se você estiver no AI Studio, certifique-se de que a chave está configurada nos 'Secrets'. Se estiver no GitHub/Vercel, configure GEMINI_API_KEY ou VITE_GEMINI_API_KEY.";
    console.error("[GeminiService] " + errorMsg);
    throw new Error(errorMsg);
  }
  return new GoogleGenAI({ apiKey });
};

export async function extractFoodFromText(text: string): Promise<FoodItem[]> {
  try {
    console.log("[GeminiService] Extracting food from text:", text);
    const ai = getAI();
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Using the model from original server.ts for stability
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
    
    // Robust JSON extraction
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
    alert(`Erro ao processar texto: ${e.message}`);
    return [];
  }
}

export async function searchFoodCalories(description: string): Promise<FoodItem[]> {
  try {
    console.log("[GeminiService] Searching food calories:", description);
    const ai = getAI();
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Using the model from original server.ts for stability
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
    
    // Robust JSON extraction
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
    alert(`Erro ao buscar calorias: ${e.message}`);
    return [];
  }
}

