
import { createClient } from '@supabase/supabase-js';
import { Meal, Workout, DailyStats } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing. Please check your .env.local file.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export const fetchDailyData = async (date: string): Promise<DailyStats> => {
  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('*')
    .eq('date', date);

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('*')
    .eq('date', date);

  if (mealsError || workoutsError) {
    console.error("Error fetching data:", mealsError || workoutsError);
    return {
      date,
      meals: [],
      workouts: [],
      calorieGoal: 1800, // Default fallback
      proteinGoal: 150
    };
  }

  return {
    date,
    meals: (meals || []).map(m => ({
      ...m,
      originalText: m.original_text
    })),
    workouts: (workouts || []).map(w => ({
      ...w,
      originalText: w.original_text,
      caloriesBurned: w.calories_burned,
      durationMinutes: w.duration_minutes
    })),
    calorieGoal: 1800,
    proteinGoal: 150
  };
};

export const addMealRecord = async (meal: Omit<Meal, 'id'>, date: string) => {
  const { data, error } = await supabase
    .from('meals')
    .insert([{
      name: meal.name,
      original_text: meal.originalText,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      timestamp: meal.timestamp,
      date: date
    }])
    .select();

  if (error) throw error;
  return data?.[0];
};

export const addWorkoutRecord = async (workout: Omit<Workout, 'id'>, date: string) => {
  const { data, error } = await supabase
    .from('workouts')
    .insert([{
      name: workout.name,
      original_text: workout.originalText,
      calories_burned: workout.caloriesBurned,
      duration_minutes: workout.durationMinutes,
      intensity: workout.intensity,
      timestamp: workout.timestamp,
      date: date
    }])
    .select();

  if (error) throw error;
  return data?.[0];
};

export const deleteMealRecord = async (id: string) => {
  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const deleteWorkoutRecord = async (id: string) => {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
