import { GoogleGenAI, Type } from "@google/genai";

export interface FoodItem {
  name: string;
  calories: number;
  amount?: string;
}

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please check your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function extractFoodFromText(text: string): Promise<FoodItem[]> {
  try {
    console.log("Extracting food from text using Gemini directly in frontend:", text);
    const ai = getAI();
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    let cleanJson = responseText.trim();
    if (cleanJson.includes("```json")) {
      cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
    } else if (cleanJson.includes("```")) {
      cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
    }

    const data = JSON.parse(cleanJson);
    console.log("Extraction success:", data);
    return data;
  } catch (e: any) {
    console.error("Extraction error in frontend:", e);
    alert(`Erro ao processar texto: ${e.message}`);
    return [];
  }
}

export async function searchFoodCalories(description: string): Promise<FoodItem[]> {
  try {
    console.log("Searching food calories using Gemini directly in frontend:", description);
    const ai = getAI();
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    let cleanJson = responseText.trim();
    if (cleanJson.includes("```json")) {
      cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
    } else if (cleanJson.includes("```")) {
      cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
    }

    const data = JSON.parse(cleanJson);
    console.log("Search success:", data);
    return data;
  } catch (e: any) {
    console.error("Search error in frontend:", e);
    alert(`Erro ao buscar calorias: ${e.message}`);
    return [];
  }
}

