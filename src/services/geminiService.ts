export interface FoodItem {
  name: string;
  calories: number;
  amount?: string;
}

export async function extractFoodFromText(text: string): Promise<FoodItem[]> {
  try {
    const response = await fetch("/api/extract-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extract food");
    }

    return await response.json();
  } catch (e: any) {
    console.error("Extraction error:", e);
    alert("Erro ao processar texto. Por favor, tente novamente.");
    return [];
  }
}

export async function searchFoodCalories(description: string): Promise<FoodItem[]> {
  try {
    const response = await fetch("/api/search-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to search food");
    }

    return await response.json();
  } catch (e: any) {
    console.error("Search error:", e);
    alert("Erro ao buscar calorias. Por favor, tente novamente.");
    return [];
  }
}

