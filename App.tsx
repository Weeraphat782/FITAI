
import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout, Plus, Activity, Utensils, Calendar, ChevronRight,
  CheckCircle2, TrendingUp, PieChart as PieChartIcon,
  Scale, User, Target, Info, Flame, Trash2, Camera, Sparkles, MessageSquare
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Meal, Workout, DailyStats, ViewType } from './types';
import { analyzeMeal, analyzeMealWithImage, analyzeWorkout, getDailyInsight, getDietaryAdvice } from './services/geminiService';
import {
  supabase,
  fetchDailyData,
  addMealRecord,
  addWorkoutRecord,
  deleteMealRecord,
  deleteWorkoutRecord
} from './services/supabaseService';

// Hardcoded User Profile for Weight Loss (80kg -> 60kg)
const USER_PROFILE = {
  name: "User",
  currentWeight: 80,
  height: 168,
  goalWeight: 60,
  calorieGoal: 1800, // Deficit for weight loss
  proteinGoal: 150,  // High protein for muscle preservation
  carbsGoal: 180,
  fatGoal: 60
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('daily');
  const [history, setHistory] = useState<DailyStats[]>([]);
  const [isLoggingMeal, setIsLoggingMeal] = useState(false);
  const [isLoggingWorkout, setIsLoggingWorkout] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dailyInsight, setDailyInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dietaryAdvice, setDietaryAdvice] = useState<string | null>(null);
  const [isGettingAdvice, setIsGettingAdvice] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const currentDay = useMemo(() => {
    const found = history.find(h => h.date === todayStr);
    return found || {
      date: todayStr,
      meals: [],
      workouts: [],
      calorieGoal: USER_PROFILE.calorieGoal,
      proteinGoal: USER_PROFILE.proteinGoal
    };
  }, [history, todayStr]);

  const stats = useMemo(() => {
    const consumedCals = currentDay.meals.reduce((sum: number, m: Meal) => sum + m.calories, 0);
    const burnedCals = currentDay.workouts.reduce((sum: number, w: Workout) => sum + w.caloriesBurned, 0);
    const protein = currentDay.meals.reduce((sum: number, m: Meal) => sum + m.protein, 0);
    const carbs = currentDay.meals.reduce((sum: number, m: Meal) => sum + m.carbs, 0);
    const fat = currentDay.meals.reduce((sum: number, m: Meal) => sum + m.fat, 0);
    const netCals = consumedCals - burnedCals;
    return { consumedCals, burnedCals, netCals, protein, carbs, fat };
  }, [currentDay]);

  useEffect(() => {
    const loadFullHistory = async () => {
      setIsLoading(true);
      try {
        // For simplicity, we fetch just today's data first, 
        // but we could fetch a range for trends.
        const dayData = await fetchDailyData(todayStr);
        setHistory(prev => {
          const otherDays = prev.filter(h => h.date !== todayStr);
          return [...otherDays, dayData];
        });
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadFullHistory();
  }, [todayStr]);

  const handleAddMeal = async () => {
    if (!inputText.trim() && !selectedImage) return;
    setIsAnalyzing(true);
    try {
      let result;
      if (selectedImage) {
        result = await analyzeMealWithImage(selectedImage, inputText);
      } else {
        result = await analyzeMeal(inputText);
      }

      const tempMeal: Omit<Meal, 'id'> = {
        name: result.name,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        originalText: inputText || `Photo: ${result.name}`,
        timestamp: Date.now()
      };

      const savedMealRaw = await addMealRecord(tempMeal, todayStr);
      const savedMeal = {
        ...savedMealRaw,
        originalText: savedMealRaw.original_text
      };

      const updatedHistory = history.some(h => h.date === todayStr)
        ? history.map(h => h.date === todayStr ? { ...h, meals: [...h.meals, savedMeal] } : h)
        : [...history, { ...currentDay, meals: [savedMeal] }];

      setHistory(updatedHistory);
      setInputText('');
      setSelectedImage(null);
      setIsLoggingMeal(false);
    } catch (e: any) {
      console.error("Add Meal Error:", e);
      alert(`Analysis failed: ${e.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetDietaryAdvice = async () => {
    setIsGettingAdvice(true);
    try {
      const advice = await getDietaryAdvice(stats, USER_PROFILE);
      setDietaryAdvice(advice);
    } catch (e) {
      console.error("Advice Error:", e);
      setDietaryAdvice("Focus on hitting your protein goal today!");
    } finally {
      setIsGettingAdvice(false);
    }
  };

  const handleAddWorkout = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeWorkout(inputText);
      const tempWorkout: Omit<Workout, 'id'> = {
        ...result,
        originalText: inputText,
        timestamp: Date.now()
      };

      const savedWorkoutRaw = await addWorkoutRecord(tempWorkout, todayStr);
      const savedWorkout = {
        ...savedWorkoutRaw,
        originalText: savedWorkoutRaw.original_text,
        caloriesBurned: savedWorkoutRaw.calories_burned,
        durationMinutes: savedWorkoutRaw.duration_minutes
      };

      const updatedHistory = history.some(h => h.date === todayStr)
        ? history.map(h => h.date === todayStr ? { ...h, workouts: [...h.workouts, savedWorkout] } : h)
        : [...history, { ...currentDay, workouts: [savedWorkout] }];

      setHistory(updatedHistory);
      setInputText('');
      setIsLoggingWorkout(false);
    } catch (e: any) {
      console.error("Add Workout Error:", e);
      alert(`Analysis failed: ${e.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      await deleteMealRecord(id);
      const updatedHistory = history.map(h => {
        if (h.date === todayStr) {
          return { ...h, meals: h.meals.filter(m => m.id !== id) };
        }
        return h;
      });
      setHistory(updatedHistory);
    } catch (e) {
      console.error("Delete Meal Error:", e);
      alert("Failed to delete meal.");
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    try {
      await deleteWorkoutRecord(id);
      const updatedHistory = history.map(h => {
        if (h.date === todayStr) {
          return { ...h, workouts: h.workouts.filter(w => w.id !== id) };
        }
        return h;
      });
      setHistory(updatedHistory);
    } catch (e) {
      console.error("Delete Workout Error:", e);
      alert("Failed to delete workout.");
    }
  };

  const generateSummary = async () => {
    const dataStr = `Meals: ${currentDay.meals.map(m => m.name).join(', ')}. Workouts: ${currentDay.workouts.map(w => w.name).join(', ')}. Consumed: ${stats.consumedCals}, Burned: ${stats.burnedCals}, Protein: ${stats.protein}g. Goal is weight loss from 80kg to 60kg.`;
    setIsAnalyzing(true);
    try {
      const insight = await getDailyInsight(dataStr);
      setDailyInsight(insight || "You're doing great! Keep it consistent.");
    } catch (e) {
      setDailyInsight("Stay focused on your protein goal to maintain muscle while losing weight.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const weeklyData = useMemo(() => {
    const data = [];
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)

    // Adjust to make Monday the first day (0) and Sunday the last day (6)
    // In JS: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    // We want: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      const day = history.find(h => h.date === ds);
      data.push({
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        calories: (day?.meals || []).reduce((sum: number, m: Meal) => sum + m.calories, 0),
        burned: (day?.workouts || []).reduce((sum: number, w: Workout) => sum + w.caloriesBurned, 0),
        protein: (day?.meals || []).reduce((sum: number, m: Meal) => sum + m.protein, 0),
      });
    }
    return data;
  }, [history]);

  const progressPercentage = ((USER_PROFILE.currentWeight - 60) / (USER_PROFILE.currentWeight - USER_PROFILE.goalWeight)) * 0; // Since we are at 80/80 start

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Desktop Sidebar / Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-xl text-white">
            <Activity size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Fit<span className="text-emerald-600">AI</span></h1>
        </div>

        <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl">
          {(['daily', 'weekly', 'monthly'] as ViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view === v ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Weight Goal</p>
            <p className="text-sm font-black text-slate-900">{USER_PROFILE.currentWeight}kg → {USER_PROFILE.goalWeight}kg</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <User size={20} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-6 pb-28 md:pb-12 space-y-6">
        {view === 'daily' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Main Stats Column */}
            <div className="lg:col-span-2 space-y-6">

              {/* Daily Progress Card */}
              <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-50" />

                <div className="flex justify-between items-start mb-8 relative">
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Net Calories Today</p>
                    <h2 className="text-5xl font-black text-slate-900 mt-1">{stats.netCals} <span className="text-xl text-slate-400 font-medium">/ {USER_PROFILE.calorieGoal}</span></h2>
                  </div>
                  <button
                    onClick={generateSummary}
                    disabled={isAnalyzing}
                    className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    AI INSIGHT
                  </button>
                </div>

                {dailyInsight && (
                  <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                    <Info size={20} className="text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-900 font-medium leading-relaxed">{dailyInsight}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase text-center">Protein</p>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${Math.min((stats.protein / USER_PROFILE.proteinGoal) * 100, 100)}%` }} />
                    </div>
                    <p className="text-xs font-bold text-center text-slate-700">{stats.protein}g / {USER_PROFILE.proteinGoal}g</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase text-center">Carbs</p>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500" style={{ width: `${Math.min((stats.carbs / USER_PROFILE.carbsGoal) * 100, 100)}%` }} />
                    </div>
                    <p className="text-xs font-bold text-center text-slate-700">{stats.carbs}g / {USER_PROFILE.carbsGoal}g</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase text-center">Fat</p>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500" style={{ width: `${Math.min((stats.fat / USER_PROFILE.fatGoal) * 100, 100)}%` }} />
                    </div>
                    <p className="text-xs font-bold text-center text-slate-700">{stats.fat}g / {USER_PROFILE.fatGoal}g</p>
                  </div>
                </div>
              </div>

              {/* Lists Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Meals */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                      <Utensils size={18} className="text-emerald-600" />
                      Meals
                    </h3>
                    <button onClick={() => setIsLoggingMeal(true)} className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                      + Add Food
                    </button>
                  </div>
                  <div className="space-y-3">
                    {currentDay.meals.length === 0 ? (
                      <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-12 flex flex-col items-center justify-center text-slate-400">
                        <Utensils size={32} className="opacity-20 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">No meals logged</p>
                      </div>
                    ) : (
                      currentDay.meals.map(m => (
                        <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow group relative">
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">{m.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">P: {m.protein}g • C: {m.carbs}g • F: {m.fat}g</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-emerald-600">+{m.calories}</span>
                            <button
                              onClick={() => handleDeleteMeal(m.id)}
                              className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Workouts */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                      <Flame size={18} className="text-orange-600" />
                      Activity
                    </h3>
                    <button onClick={() => setIsLoggingWorkout(true)} className="text-xs font-bold text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors">
                      + Add Exercise
                    </button>
                  </div>
                  <div className="space-y-3">
                    {currentDay.workouts.length === 0 ? (
                      <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-12 flex flex-col items-center justify-center text-slate-400">
                        <Activity size={32} className="opacity-20 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">No activity logged</p>
                      </div>
                    ) : (
                      currentDay.workouts.map(w => (
                        <div key={w.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow group relative">
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">{w.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{w.durationMinutes} mins • {w.intensity}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-orange-600">-{w.caloriesBurned}</span>
                            <button
                              onClick={() => handleDeleteWorkout(w.id)}
                              className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Stats Column */}
            <div className="space-y-6">
              {/* Profile/Goal Summary */}
              <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                  <Scale size={120} />
                </div>
                <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                  <Target size={20} className="text-emerald-500" />
                  Weight Progress
                </h3>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current</p>
                    <p className="text-3xl font-black">{USER_PROFILE.currentWeight}<span className="text-sm ml-1 font-medium text-slate-500">kg</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Goal</p>
                    <p className="text-3xl font-black">{USER_PROFILE.goalWeight}<span className="text-sm ml-1 font-medium text-slate-500">kg</span></p>
                  </div>
                </div>
                <div className="h-4 bg-slate-800 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '5%' }} /> {/* Placeholder progress */}
                </div>
                <p className="text-center text-[10px] font-bold text-slate-500 mt-4 uppercase tracking-widest">20kg to go. You can do this!</p>
              </div>

              {/* Macro breakdown Pie */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <h4 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <PieChartIcon size={16} className="text-indigo-600" />
                  Macro Ratio
                </h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Protein', value: stats.protein * 4 },
                          { name: 'Carbs', value: stats.carbs * 4 },
                          { name: 'Fat', value: stats.fat * 9 }
                        ]}
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        <Cell fill="#f59e0b" /> {/* Amber */}
                        <Cell fill="#0ea5e9" /> {/* Sky */}
                        <Cell fill="#f43f5e" /> {/* Rose */}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-around mt-4 text-[10px] font-black uppercase tracking-widest">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pro</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Carb</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Fat</div>
                </div>
              </div>

              {/* AI Advisor Card */}
              <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden group border border-indigo-400">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform">
                  <Sparkles size={100} />
                </div>
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <MessageSquare size={20} className="text-indigo-200" />
                  AI Advisor
                </h3>
                <p className="text-xs font-bold text-indigo-100 mb-6 leading-relaxed">
                  Need help deciding your next meal based on today's progress?
                </p>

                {dietaryAdvice ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/10 animate-in fade-in zoom-in-95 duration-300">
                    <p className="text-sm font-medium leading-relaxed italic">"{dietaryAdvice}"</p>
                  </div>
                ) : null}

                <button
                  onClick={handleGetDietaryAdvice}
                  disabled={isGettingAdvice}
                  className="w-full bg-white text-indigo-600 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGettingAdvice ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></span>
                  ) : (
                    <>Ask What to Eat Next <ChevronRight size={16} /></>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'weekly' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <TrendingUp size={28} className="text-indigo-600" />
                Weekly Overview
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: 20 }} />
                    <Bar dataKey="calories" name="Consumed" fill="#10b981" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="burned" name="Burned" fill="#f97316" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Weekly Avg Calories</p>
                <p className="text-3xl font-black text-slate-900">
                  {(weeklyData.reduce((s, d) => s + d.calories, 0) / 7).toFixed(0)}
                  <span className="text-sm font-bold text-slate-400 ml-1 italic">kcal/day</span>
                </p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Protein</p>
                <p className="text-3xl font-black text-amber-600">
                  {weeklyData.reduce((s, d) => s + d.protein, 0)}
                  <span className="text-sm font-bold text-slate-400 ml-1 italic">grams</span>
                </p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 sm:col-span-2 lg:col-span-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Minutes</p>
                <p className="text-3xl font-black text-orange-600">
                  145
                  <span className="text-sm font-bold text-slate-400 ml-1 italic">mins total</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {view === 'monthly' && (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-6">
            <div className="p-8 bg-white rounded-full shadow-inner border border-slate-100">
              <Calendar size={64} className="opacity-20" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black text-slate-900 mb-2">Build Your Streak</h3>
              <p className="max-w-xs text-sm font-medium leading-relaxed">Log your data for at least 30 days to unlock deep monthly trend analysis and AI projections.</p>
            </div>
          </div>
        )}
      </main>

      {/* Logging Modals - Mobile Optimized */}
      {(isLoggingMeal || isLoggingWorkout) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-8 sm:p-10 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className={`p-4 rounded-[1.5rem] ${isLoggingMeal ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                {isLoggingMeal ? <Utensils size={28} /> : <Activity size={28} />}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">AI Log</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isLoggingMeal ? 'Nutrition Tracker' : 'Workout Intensity'}</p>
              </div>
            </div>

            <div className="relative mb-8">
              <textarea
                autoFocus
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isLoggingMeal ? "What's on the menu? Be as descriptive as you like." : "What was the workout? Duration and how it felt..."}
                className="w-full h-40 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none resize-none font-bold text-slate-700 placeholder:text-slate-300 transition-all text-lg"
              />

              {isLoggingMeal && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    id="meal-image"
                    className="hidden"
                  />
                  {selectedImage && (
                    <div className="relative group">
                      <img src={selectedImage} alt="Selected" className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500 shadow-lg" />
                      <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md hover:bg-rose-600 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                  <label htmlFor="meal-image" className="bg-white p-3 rounded-2xl shadow-lg border border-slate-100 text-slate-600 hover:text-emerald-600 cursor-pointer hover:shadow-xl transition-all">
                    <Camera size={24} />
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setIsLoggingMeal(false); setIsLoggingWorkout(false); setInputText(''); }}
                className="flex-1 py-5 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-colors uppercase tracking-widest text-xs"
              >
                Cancel
              </button>
              <button
                disabled={isAnalyzing || (isLoggingMeal ? (!inputText.trim() && !selectedImage) : !inputText.trim())}
                onClick={isLoggingMeal ? handleAddMeal : handleAddWorkout}
                className={`flex-[2] py-5 font-black rounded-3xl text-white flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 disabled:opacity-50 uppercase tracking-widest text-sm ${isLoggingMeal ? 'bg-emerald-600 shadow-emerald-200' : 'bg-orange-600 shadow-orange-200'}`}
              >
                {isAnalyzing ? (
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                ) : (
                  <>Analyze Log <ChevronRight size={20} /></>
                )}
              </button>
            </div>
            {/* Safe area for mobile keyboards */}
            <div className="h-6 sm:hidden"></div>
          </div>
        </div>
      )}

      {/* Responsive Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around px-8 md:hidden z-40">
        <button onClick={() => setView('daily')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'daily' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
          <Layout size={26} strokeWidth={view === 'daily' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Plan</span>
        </button>

        {/* Floating AI Button Center */}
        <div className="relative -top-6">
          <div className="flex gap-4">
            <button
              onClick={() => setIsLoggingMeal(true)}
              className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-300 active:scale-90 transition-transform ring-4 ring-white"
            >
              <Utensils size={24} />
            </button>
            <button
              onClick={() => setIsLoggingWorkout(true)}
              className="w-14 h-14 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-orange-300 active:scale-90 transition-transform ring-4 ring-white"
            >
              <Activity size={24} />
            </button>
          </div>
        </div>

        <button onClick={() => setView('weekly')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'weekly' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
          <TrendingUp size={26} strokeWidth={view === 'weekly' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Trends</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
