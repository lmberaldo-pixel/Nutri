export interface FoodItem {
  name: string;
  calories: number;
  amount?: string;
}

export async function extractFoodFromText(text: string): Promise<FoodItem[]> {
  try {
    console.log("Calling /api/extract-food with:", text);
    const response = await fetch("/api/extract-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Server error data:", errorData);
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
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
    console.log("Calling /api/search-food with:", description);
    const response = await fetch("/api/search-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Server error data:", errorData);
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Search success:", data);
    return data;
  } catch (e: any) {
    console.error("Search error in frontend:", e);
    alert(`Erro ao buscar calorias: ${e.message}`);
    return [];
  }
}

