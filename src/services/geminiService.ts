import * as GenAI from "@google/genai";

const API_KEY = (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || "";

export const getGeminiRecommendations = async (history: string[], favorites: string[], allChannels: any[]) => {
  if (!API_KEY) {
    console.warn("GEMINI_API_KEY is not set.");
    return null;
  }

  const genAI = new GenAI.GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
    Based on the following user viewing history and favorites, recommend 3 channels from the available list.
    
    User History: ${history.join(", ")}
    User Favorites: ${favorites.join(", ")}
    
    Available Channels:
    ${allChannels.map(c => `${c.id}: ${c.name} (${c.category}) - ${c.description}`).join("\n")}
    
    Return ONLY a JSON array of the recommended channel IDs.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Extract JSON array from potential markdown markers
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Gemini recommendation error:", error);
    return null;
  }
};
