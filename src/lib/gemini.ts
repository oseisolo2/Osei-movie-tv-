import { GoogleGenAI } from '@google/genai';

const key = process.env.GEMINI_API_KEY;

export async function askAssistant(message: string, history: {role: string, text: string}[]) {
  if (!key || key === "AIzaSy...your-key-here" || key === "MY_GEMINI_API_KEY") {
    return "I need a valid Gemini API Key to chat! Please go to App Settings -> Environment Variables and set GEMINI_API_KEY to your valid key.";
  }

  const ai = new GoogleGenAI({ apiKey: key });

  const SYSTEM_INSTRUCTION = `
You are an AI assistant built into a movie & TV streaming web app.

🧠 Behavior
* Be helpful, fast, and conversational
* Keep responses short and clear (avoid long paragraphs)
* Use simple, friendly language
* Focus on entertainment, movies, and user interaction

🎬 Domain Knowledge
You specialize in:
* Movies and TV shows
* Streaming recommendations
* Genres, actors, and ratings
* Watching experience and player controls

💬 Chat Features
* Support real-time conversations in live chat
* Respond to user messages naturally
* Show typing-like conversational flow
* Avoid robotic or overly formal responses

🎥 Player Awareness
* When relevant, suggest using Picture-in-Picture for multitasking
* Recommend brightness adjustments for better viewing
* Help users choose best object-fit mode

🎯 Specific Tasks
* When a user asks for something to watch:
  - Suggest 3–5 movies or TV shows.
  - Include genre, short description, and vibe.
  - Match recommendations to user mood (funny, action, sad, etc.).

⚡ Style Rules
* Keep answers under 5–6 lines when possible
* Use emojis occasionally (🎬🔥📺) but not excessively
* Be engaging but not spammy

🌟 Personality
* Friendly and smart like a streaming assistant
* Slightly playful but still helpful
* Think: "Netflix assistant + live chat buddy"
`;

  try {
    const formattedHistory = history.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.text }]
    }));
      
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        ...formattedHistory,
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    return response.text;
  } catch (error: any) {
    console.error("Gemini GenAI Error:", error);
    return `Error: ${error.message}`;
  }
}
