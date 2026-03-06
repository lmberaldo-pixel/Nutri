import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Target, 
  Utensils, 
  Flame, 
  Loader2,
  Search,
  RotateCcw,
  Clipboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { extractFoodFromText, searchFoodCalories, FoodItem } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [goal, setGoal] = useState<number>(1500);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [lastAddedCount, setLastAddedCount] = useState<number>(0);
  const [exceededHistory, setExceededHistory] = useState<number[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [manualFood, setManualFood] = useState({ name: '', calories: '' });

  const totalConsumed = useMemo(() => foods.reduce((sum, f) => sum + f.calories, 0), [foods]);
  const isExceeded = totalConsumed > goal;
  const exceededAmount = totalConsumed - goal;
  const remaining = isExceeded ? 0 : goal - totalConsumed;

  useEffect(() => {
    const savedGoal = localStorage.getItem('calorie-goal');
    const savedFoods = localStorage.getItem('calorie-foods');
    const savedHistory = localStorage.getItem('calorie-history');
    const lastDate = localStorage.getItem('calorie-last-date');
    
    const today = new Date().toLocaleDateString();

    if (savedGoal) setGoal(parseInt(savedGoal));
    
    let currentFoods: FoodItem[] = [];
    if (savedFoods) {
      currentFoods = JSON.parse(savedFoods);
    }

    if (lastDate && lastDate !== today) {
      // Day changed! Calculate exceeded amount for the previous day
      const prevGoal = savedGoal ? parseInt(savedGoal) : 1500;
      const prevTotal = currentFoods.reduce((sum, f) => sum + f.calories, 0);
      const prevExceeded = Math.max(0, prevTotal - prevGoal);
      
      let history: number[] = savedHistory ? JSON.parse(savedHistory) : [];
      history = [prevExceeded, ...history].slice(0, 7);
      
      setExceededHistory(history);
      localStorage.setItem('calorie-history', JSON.stringify(history));
      
      // Reset foods for the new day
      setFoods([]);
      localStorage.setItem('calorie-foods', JSON.stringify([]));
    } else {
      setFoods(currentFoods);
      if (savedHistory) setExceededHistory(JSON.parse(savedHistory));
    }
    
    localStorage.setItem('calorie-last-date', today);
  }, []);

  useEffect(() => {
    localStorage.setItem('calorie-goal', goal.toString());
    localStorage.setItem('calorie-foods', JSON.stringify(foods));
    localStorage.setItem('calorie-history', JSON.stringify(exceededHistory));
  }, [foods, goal, exceededHistory]);

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFood.name || !manualFood.calories) return;
    const newFood: FoodItem = {
      name: manualFood.name,
      calories: parseInt(manualFood.calories),
    };
    setFoods(prev => [...prev, newFood]);
    setLastAddedCount(1);
    setManualFood({ name: '', calories: '' });
  };

  const handlePasteContent = async () => {
    console.log("handlePasteContent triggered with text:", pastedText);
    if (!pastedText.trim()) return;
    setIsLoading(true);
    setIsPasting(true);
    try {
      const extracted = await extractFoodFromText(pastedText);
      if (extracted.length > 0) {
        setFoods(prev => [...prev, ...extracted]);
        setLastAddedCount(extracted.length);
        setPastedText('');
      } else {
        alert("Não foram encontrados alimentos no texto colado. Certifique-se de que o texto contém nomes de alimentos e calorias.");
      }
    } catch (error) {
      console.error("Paste extraction error:", error);
      alert("Erro ao processar o texto. Tente novamente.");
    } finally {
      setIsLoading(false);
      setIsPasting(false);
    }
  };

  const clearAllFoods = () => {
    if (confirm("Deseja realmente limpar todos os alimentos de hoje?")) {
      setFoods([]);
      setLastAddedCount(0);
    }
  };

  const removeFood = (index: number) => {
    setFoods(prev => prev.filter((_, i) => i !== index));
    setLastAddedCount(0);
  };

  const clearFoods = () => {
    setFoods([]);
    setLastAddedCount(0);
  };

  const undoLastImport = () => {
    if (lastAddedCount === 0) return;
    setFoods(prev => prev.slice(0, -lastAddedCount));
    setLastAddedCount(0);
  };

  const clearHistory = () => {
    setExceededHistory([]);
  };

  const resetGoal = () => {
    setGoal(1500);
  };

  return (
    <div className="min-h-screen bg-zinc-50 relative">
      {/* Background Image with Overlay */}
      <div 
        className="fixed inset-0 z-0 opacity-90 pointer-events-none brightness-110 contrast-105"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=100&w=2400")',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      <div className="relative z-20 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-red-600 flex items-center gap-2">
              <Utensils className="w-8 h-8 text-emerald-600" />
              NutriGPT
            </h1>
            <p className="text-red-500 text-[1.2rem] font-medium">Seu contador de calorias inteligente</p>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          {/* Daily Goal Card */}
          <div className="p-6 rounded-3xl shadow-sm border backdrop-blur-sm flex items-center gap-4 transition-all bg-emerald-50/90 border-emerald-100">
            <div className="p-3 rounded-2xl text-emerald-700 bg-white shadow-sm shadow-emerald-100">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Meta Diária</p>
                <button 
                  onClick={resetGoal}
                  className="text-[10px] font-bold uppercase text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  Reset
                </button>
              </div>
              <div className="flex items-baseline gap-1">
                <input 
                  type="number" 
                  inputMode="numeric"
                  step="50"
                  value={goal} 
                  onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
                  className="w-full font-mono font-bold focus:outline-none text-2xl bg-transparent text-black"
                />
                <span className="text-sm font-normal opacity-60 text-black">kcal</span>
              </div>
            </div>
          </div>

          <StatCard 
            label="Consumido" 
            value={totalConsumed} 
            unit="kcal" 
            icon={<Flame className="w-5 h-5 text-orange-500" />}
            color="orange"
          />
          <StatCard 
            label={isExceeded ? "Ultrapassado" : "Restante"} 
            value={isExceeded ? exceededAmount : remaining} 
            unit="kcal" 
            icon={<Target className="w-5 h-5 text-emerald-700" />}
            color={isExceeded ? "red" : "emerald"}
          />
        </div>

        {/* Exceeded Alert */}
        <AnimatePresence>
          {isExceeded && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-700"
            >
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-sm">Meta Diária Ultrapassada!</p>
                <p className="text-xs opacity-80">Você excedeu sua meta em {exceededAmount} kcal. Tente equilibrar nas próximas refeições.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exceeded History Box */}
        {exceededHistory.length > 0 && (
          <section className="bg-emerald-50/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-emerald-100 space-y-4 max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2 text-emerald-900">
                <Flame className="w-5 h-5 text-red-500" />
                Histórico de Excessos (Últimos 7 dias)
              </h2>
              <button 
                onClick={clearHistory}
                className="text-red-600 hover:text-red-700 transition-colors p-1"
                title="Limpar Histórico"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {exceededHistory.map((val, i) => (
                <div key={i} className={cn(
                  "flex flex-col items-center p-3 rounded-2xl min-w-[80px] border transition-all",
                  val > 0 
                    ? "bg-red-50 border-red-100 shadow-sm shadow-red-50" 
                    : "bg-white/50 border-emerald-100 opacity-60"
                )}>
                  <span className={cn(
                    "text-[10px] uppercase font-bold mb-1",
                    val > 0 ? "text-red-400" : "text-emerald-600"
                  )}>Dia {i + 1}</span>
                  <span className={cn("font-mono font-bold text-lg", val > 0 ? "text-red-600" : "text-black")}>
                    {val}
                  </span>
                  <span className={cn("text-[8px] font-bold uppercase", val > 0 ? "text-red-300" : "text-emerald-500")}>kcal</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main Content Grid */}
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Paste Text Section */}
            <section className="bg-emerald-50/60 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-emerald-100 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-emerald-700" />
                  <div className="flex flex-col">
                    <h2 className="font-semibold text-black">Digitar/Colar</h2>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight leading-none">(Quantidade e alimento)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        setPastedText(text);
                      } catch (err) {
                        console.error('Failed to read clipboard', err);
                        // Fallback: alert user or just ignore if permission denied
                      }
                    }}
                    className="text-emerald-700 hover:bg-emerald-100 p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold uppercase"
                    title="Colar da Área de Transferência"
                  >
                    <Clipboard className="w-4 h-4" />
                    <span className="hidden sm:inline">Colar</span>
                  </button>
                  {pastedText && (
                    <button 
                      onClick={() => setPastedText('')}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Limpar Texto"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <textarea 
                  placeholder="Ex: 2 ovos cozidos e 1 fatia de pão integral..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full h-32 bg-white/50 border border-emerald-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-base resize-none placeholder:text-emerald-500"
                />
                <div className="flex justify-end">
                  <button 
                    onClick={handlePasteContent}
                    disabled={isLoading || !pastedText.trim()}
                    className="bg-emerald-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
                  >
                    {isPasting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Processar Alimentos
                  </button>
                </div>
              </div>
            </section>

            {/* Food List */}
            <section className="bg-emerald-50/50 backdrop-blur-sm rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
              <div className="p-6 border-b border-emerald-100 flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2 text-black">
                  <Utensils className="w-5 h-5 text-emerald-700" />
                  Alimentos Adicionados
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-white/80 px-2 py-1 rounded-lg text-emerald-700 border border-emerald-100">
                    {foods.length} itens
                  </span>
                  {lastAddedCount > 0 && (
                    <button 
                      type="button"
                      onClick={undoLastImport}
                      className="text-xs font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700 bg-emerald-100/50 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-emerald-200"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Desfazer última atualização
                    </button>
                  )}
                  {foods.length > 0 && (
                    <button 
                      type="button"
                      onClick={clearFoods}
                      className="text-red-600 hover:text-red-700 transition-colors flex items-center gap-1 cursor-pointer p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-100/30 text-[10px] uppercase tracking-wider font-bold text-emerald-700">
                      <th className="px-6 py-3">Alimento</th>
                      <th className="px-6 py-3">Quantidade</th>
                      <th className="px-6 py-3 text-right">Calorias</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100/50">
                    <AnimatePresence mode="popLayout">
                      {foods.map((food, index) => (
                        <motion.tr 
                          key={`${food.name}-${index}`}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="group hover:bg-emerald-100/20 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-black">{food.name}</td>
                          <td className="px-6 py-4 text-black text-sm">{food.amount || '-'}</td>
                          <td className="px-6 py-4 text-right font-mono font-medium text-black">
                            {food.calories} <span className="text-[10px] text-zinc-400">kcal</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => removeFood(index)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {foods.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic text-sm">
                          Nenhum alimento adicionado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Manual Add Form */}
              <form onSubmit={handleAddManual} className="p-4 bg-emerald-100/20 border-t border-emerald-100 flex gap-2">
                <input 
                  type="text" 
                  placeholder="Nome do alimento..."
                  value={manualFood.name}
                  onChange={(e) => setManualFood({ ...manualFood, name: e.target.value })}
                  className="flex-1 bg-white/80 border border-emerald-200 rounded-xl px-3 py-1.5 text-[0.9625rem] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <input 
                  type="number" 
                  inputMode="numeric"
                  placeholder="kcal"
                  value={manualFood.calories}
                  onChange={(e) => setManualFood({ ...manualFood, calories: e.target.value })}
                  className="w-20 bg-white/80 border border-emerald-200 rounded-xl px-3 py-1.5 text-[0.9625rem] focus:outline-none font-mono focus:ring-2 focus:ring-emerald-500/20"
                />
                <button 
                  type="submit"
                  className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, icon, color }: { 
  label: string, 
  value: number, 
  unit: string, 
  icon: React.ReactNode,
  color: 'orange' | 'emerald' | 'red'
}) {
  const colorClasses = {
    orange: {
      card: "bg-orange-50/90 border-orange-100",
      icon: "text-orange-600 bg-white shadow-sm shadow-orange-100",
      text: "text-orange-950",
      label: "text-orange-500"
    },
    emerald: {
      card: "bg-emerald-50/90 border-emerald-100",
      icon: "text-emerald-700 bg-white shadow-sm shadow-emerald-100",
      text: "text-black",
      label: "text-emerald-700"
    },
    red: {
      card: "bg-red-50/90 border-red-100",
      icon: "text-red-600 bg-white shadow-sm shadow-red-100",
      text: "text-red-950",
      label: "text-red-500"
    }
  };

  const current = colorClasses[color];

  return (
    <div className={cn("p-6 rounded-3xl shadow-sm border backdrop-blur-sm flex items-center gap-4 transition-all", current.card)}>
      <div className={cn("p-3 rounded-2xl", current.icon)}>
        {icon}
      </div>
      <div>
        <p className={cn("text-[0.825rem] font-bold uppercase tracking-wider", current.label)}>{label}</p>
        <p className={cn("text-[1.65rem] font-mono font-bold", current.text)}>
          {value} <span className="text-[0.9625rem] font-normal opacity-60">{unit}</span>
        </p>
      </div>
    </div>
  );
}
