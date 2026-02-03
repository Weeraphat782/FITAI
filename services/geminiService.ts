
import { GoogleGenAI, Type } from "@google/genai";

// Use Vite's environment variable
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const analyzeMeal = async (text: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract nutritional data from: "${text}"`,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
        },
        required: ["name", "calories", "protein", "carbs", "fat"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const analyzeWorkout = async (text: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Estimate workout metrics for: "${text}"`,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          caloriesBurned: { type: Type.NUMBER },
          durationMinutes: { type: Type.NUMBER },
          intensity: { type: Type.STRING },
        },
        required: ["name", "caloriesBurned", "durationMinutes", "intensity"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const getDailyInsight = async (summaryData: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Provide 2-sentence motivating feedback for this fitness summary: ${summaryData}`,
    config: { temperature: 0 }
  });
  return response.text;
};
