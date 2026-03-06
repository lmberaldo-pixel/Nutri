import { GoogleGenAI } from "@google/genai";

export interface FoodItem {
  name: string;
  calories: number;
  amount?: string;
}

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("[Frontend] API Key present:", !!apiKey);
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não encontrada no ambiente. Verifique as configurações do projeto.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function extractFoodFromText(text: string): Promise<FoodItem[]> {
  const modelsToTry = ["gemini-3-flash-preview", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      console.log(`Extracting food from text (frontend) using ${model}:`, text);
      const ai = getAI();

      const response = await ai.models.generateContent({
        model,
        contents: `Analise o seguinte texto e identifique todos os alimentos. Para cada item, forneça a contagem estimada de calorias com base na quantidade mencionada (ex: "20g", "uma colher"). Se a quantidade não for especificada, assuma uma porção padrão.
        Retorne APENAS um array JSON de objetos com 'name' (string), 'calories' (number) e 'amount' (string, opcional). 
        Exemplo de formato: [{"name": "Pão integral", "calories": 120, "amount": "1 fatia"}]
        Texto: ${text}`,
      });

      const responseText = response.text || "[]";
      console.log(`Gemini (${model}) extraction response:`, responseText);

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      
      const data = JSON.parse(jsonStr);
      console.log("Extraction success:", data);
      return data;
    } catch (e: any) {
      console.error(`Extraction error with model ${model}:`, e);
      lastError = e;
    }
  }

  alert(`Erro ao processar texto após tentar múltiplos modelos: ${lastError?.message}`);
  return [];
}

export async function searchFoodCalories(description: string): Promise<FoodItem[]> {
  const modelsToTry = ["gemini-3-flash-preview", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      console.log(`Searching food calories (frontend) using ${model}:`, description);
      const ai = getAI();

      const response = await ai.models.generateContent({
        model,
        contents: `O usuário disse: "${description}". Identifique os alimentos e suas contagens calóricas estimadas. Use o Google Search para encontrar informações precisas para as quantidades específicas mencionadas (ex: "20g", "uma colher", "um pote"). 
        Retorne APENAS um array JSON de objetos com 'name' (string), 'calories' (number) e 'amount' (string, opcional). 
        Exemplo de formato: [{"name": "Mel", "calories": 60, "amount": "20g"}]`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const responseText = response.text || "[]";
      console.log(`Gemini (${model}) search response:`, responseText);

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      
      const data = JSON.parse(jsonStr);
      console.log("Search success:", data);
      return data;
    } catch (e: any) {
      console.error(`Search error with model ${model}:`, e);
      lastError = e;
    }
  }

  alert(`Erro ao buscar calorias após tentar múltiplos modelos: ${lastError?.message}`);
  return [];
}

