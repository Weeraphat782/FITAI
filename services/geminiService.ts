
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

export const analyzeMealWithImage = async (base64Image: string, text?: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { role: 'user', parts: [{ text: `Analyze this food image. ${text ? 'User says: ' + text : ''} Extract nutritional data and provide a brief description (explanation).` }] },
      { role: 'user', parts: [{ inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] || base64Image } }] }
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          explanation: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
        },
        required: ["name", "explanation", "calories", "protein", "carbs", "fat"]
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

export const getDietaryAdvice = async (currentStats: any, profile: any) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on today's progress:
        - Consumed: ${currentStats.consumedCals}/${profile.calorieGoal} kcal
        - Protein: ${currentStats.protein}/${profile.proteinGoal}g
        - Carbs: ${currentStats.carbs}/${profile.carbsGoal}g
        - Fat: ${currentStats.fat}/${profile.fatGoal}g
        
        Provide 2-3 brief, helpful suggestions for what the user should eat next to reach their goal of losing weight (60kg).`,
    config: { temperature: 0.7 }
  });
  return response.text;
};
