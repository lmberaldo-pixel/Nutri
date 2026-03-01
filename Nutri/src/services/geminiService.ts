import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface FoodItem {
  name: string;
  calories: number;
  amount?: string;
}

export async function extractFoodFromText(text: string): Promise<FoodItem[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract food items and their calorie counts from the following text. Return a JSON array of objects with 'name' (string), 'calories' (number), and 'amount' (string, optional). Text: ${text}`,
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

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse food extraction", e);
    return [];
  }
}

export async function getFoodSuggestions(remainingCalories: number, consumedFoods: FoodItem[]): Promise<string> {
  const consumedList = consumedFoods.map(f => f.name).join(", ");
  const prompt = `I have ${remainingCalories} calories remaining for today. So far I've eaten: ${consumedList || "nothing"}. 
  Suggest 3-5 healthy food options or small meals that fit within my remaining calorie budget. 
  Keep it concise and formatted in markdown.
  IMPORTANT: Response MUST be in Portuguese (pt-BR).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || "Nenhuma sugestão disponível no momento.";
}

export async function searchFoodCalories(description: string): Promise<FoodItem[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `The user said: "${description}". Identify the food items and their estimated calorie counts. Use Google Search to find accurate information if needed. Return a JSON array of objects with 'name' (string), 'calories' (number), and 'amount' (string, optional).`,
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

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse food search", e);
    return [];
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string = "audio/webm"): Promise<string> {
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
}
