import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface FoodItem {
  name: string;
  calories: number;
  amount?: string;
}

export async function extractFoodFromText(text: string): Promise<FoodItem[]> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract food items and their calorie counts from the following text. 
      Return ONLY a JSON array of objects with 'name' (string), 'calories' (number), and 'amount' (string, optional). 
      Text: ${text}`,
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
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.error("Failed to parse food extraction", e);
    const errorMsg = e.message || "";
    if (errorMsg.includes("429")) {
      alert("Muitas requisições! A IA está sobrecarregada. Aguarde 10 segundos.");
    } else if (errorMsg.includes("API key expired") || errorMsg.includes("API_KEY_INVALID")) {
      alert("ERRO: Sua Chave de API expirou ou é inválida. Por favor, gere uma nova chave no Google AI Studio e atualize as configurações.");
    } else {
      alert("Erro ao processar texto. Verifique sua conexão ou a validade da sua chave de API.");
    }
    return [];
  }
}

export async function getFoodSuggestions(remainingCalories: number, consumedFoods: FoodItem[]): Promise<string> {
  const consumedList = consumedFoods.map(f => f.name).join(", ");
  const prompt = `I have ${remainingCalories} calories remaining for today. So far I've eaten: ${consumedList || "nothing"}. 
  Suggest 3-5 healthy food options or small meals that fit within my remaining calorie budget. 
  Keep it concise and formatted in markdown.
  IMPORTANT: Response MUST be in Portuguese (pt-BR).`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Nenhuma sugestão disponível no momento.";
  } catch (e: any) {
    console.error("Suggestions error:", e);
    return "Não foi possível carregar sugestões agora.";
  }
}

export async function searchFoodCalories(description: string): Promise<FoodItem[]> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The user said: "${description}". Identify the food items and their estimated calorie counts. Use Google Search to find accurate information. 
      Return ONLY a JSON array of objects with 'name' (string), 'calories' (number), and 'amount' (string, optional). 
      Example: [{"name": "Banana", "calories": 89, "amount": "1 medium"}]`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.error("Failed to parse food search", e);
    const errorMsg = e.message || "";
    if (errorMsg.includes("429")) {
      alert("Limite de uso da IA atingido. Aguarde um momento.");
    } else if (errorMsg.includes("API key expired") || errorMsg.includes("API_KEY_INVALID")) {
      alert("ERRO: Chave de API expirou ou é inválida.");
    }
    return [];
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string = "audio/webm"): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio,
          },
        },
        { text: "Transcribe the audio accurately. If it's in Portuguese, transcribe in Portuguese. Only return the transcription text." },
      ],
    });
    return response.text || "";
  } catch (e: any) {
    console.error("Transcription error:", e);
    return "";
  }
}
