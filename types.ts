
export interface Meal {
  id: string;
  name: string;
  originalText: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: number;
}

export interface Workout {
  id: string;
  name: string;
  originalText: string;
  caloriesBurned: number;
  durationMinutes: number;
  intensity: 'Low' | 'Moderate' | 'High';
  timestamp: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  meals: Meal[];
  workouts: Workout[];
  calorieGoal: number;
  proteinGoal: number;
}

export type ViewType = 'daily' | 'weekly' | 'monthly';
