import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mic,
  MicOff,
  Plus, 
  Trash2, 
  Target, 
  Utensils, 
  Flame, 
  Link as LinkIcon, 
  Loader2,
  Search,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { extractFoodFromText, searchFoodCalories, transcribeAudio, FoodItem } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [goal, setGoal] = useState<number>(1500);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [lastAddedCount, setLastAddedCount] = useState<number>(0);
  const [exceededHistory, setExceededHistory] = useState<number[]>([]);
  const [chatGptUrl, setChatGptUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualFood, setManualFood] = useState({ name: '', calories: '' });
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

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
    setFoods([...foods, newFood]);
    setLastAddedCount(1);
    setManualFood({ name: '', calories: '' });
  };

  const handleImportUrl = async () => {
    if (!chatGptUrl) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/proxy-fetch?url=${encodeURIComponent(chatGptUrl)}`);
      if (response.ok) {
        const data = await response.json();
        const text = data.content;
        const extracted = await extractFoodFromText(text);
        if (extracted.length > 0) {
          setFoods([...foods, ...extracted]);
          setLastAddedCount(extracted.length);
          setChatGptUrl('');
        } else {
          alert("Não foram encontrados alimentos no conteúdo do link.");
        }
      } else {
        const errorData = await response.json();
        alert(`Erro ao buscar o link: ${errorData.error || "Tente copiar e colar o texto manualmente."}`);
      }
    } catch (error) {
      console.error(error);
      alert("Erro de conexão ao tentar buscar o link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteContent = async () => {
    if (!pastedText.trim()) return;
    setIsLoading(true);
    try {
      const extracted = await extractFoodFromText(pastedText);
      setFoods([...foods, ...extracted]);
      setLastAddedCount(extracted.length);
      setPastedText('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFood = (index: number) => {
    setFoods(prev => prev.filter((_, i) => i !== index));
    setLastAddedCount(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Find supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/ogg') 
          ? 'audio/ogg' 
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsLoading(true);
          setVoiceStatus('Transcrevendo áudio...');
          try {
            const transcription = await transcribeAudio(base64Audio, mimeType);
            if (transcription) {
              setVoiceStatus(`Ouvido: "${transcription}". Buscando calorias...`);
              const extracted = await searchFoodCalories(transcription);
              if (extracted.length > 0) {
                setFoods(prev => [...prev, ...extracted]);
                setLastAddedCount(extracted.length);
                setVoiceStatus('');
              } else {
                setVoiceStatus('Nenhum alimento identificado no áudio.');
                setTimeout(() => setVoiceStatus(''), 3000);
              }
            } else {
              setVoiceStatus('Não foi possível entender o áudio.');
              setTimeout(() => setVoiceStatus(''), 3000);
            }
          } catch (error) {
            console.error("Voice processing error:", error);
            setVoiceStatus('Erro ao processar voz.');
            setTimeout(() => setVoiceStatus(''), 3000);
          } finally {
            setIsLoading(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setVoiceStatus('Gravando...');
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
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
        className="fixed inset-0 z-0 opacity-60 pointer-events-none"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80&w=1920")',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      <div className="relative z-10 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Utensils className="w-8 h-8 text-emerald-600" />
              NutriGPT
            </h1>
            <p className="text-zinc-500">Seu contador de calorias inteligente</p>
          </div>
          
          <div className="flex items-center gap-4 bg-emerald-50/80 backdrop-blur-sm p-2 rounded-2xl shadow-sm border border-emerald-100">
            <div className="flex items-center gap-2 px-3 border-r border-emerald-100">
              <Target className="w-5 h-5 text-emerald-500" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Meta Diária</span>
                <input 
                  type="number" 
                  value={goal} 
                  onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
                  className="w-20 font-mono font-medium focus:outline-none text-lg bg-transparent text-emerald-900"
                />
              </div>
            </div>
            <button 
              onClick={resetGoal}
              className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-600 transition-colors"
              title="Resetar meta para 1500"
            >
              Resetar
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
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
            icon={<Target className="w-5 h-5 text-emerald-500" />}
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
                className="text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-red-500 transition-colors"
              >
                Limpar Histórico
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
                    val > 0 ? "text-red-400" : "text-emerald-400"
                  )}>Dia {i + 1}</span>
                  <span className={cn("font-mono font-bold text-lg", val > 0 ? "text-red-600" : "text-emerald-900")}>
                    {val}
                  </span>
                  <span className={cn("text-[8px] font-bold uppercase", val > 0 ? "text-red-300" : "text-emerald-300")}>kcal</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main Content Grid */}
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Voice Capture Section */}
            <section className="bg-emerald-50/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-emerald-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-emerald-900">Adicionar por Voz</h2>
                </div>
                {isRecording && (
                  <motion.div 
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Gravando...
                  </motion.div>
                )}
              </div>
              
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading && !isRecording}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg",
                    isRecording 
                      ? "bg-emerald-600 hover:bg-emerald-700 scale-110" 
                      : "bg-emerald-800 hover:bg-emerald-900"
                  )}
                >
                  {isRecording ? (
                    <MicOff className="w-8 h-8 text-white" />
                  ) : (
                    <Mic className="w-8 h-8 text-white" />
                  )}
                </button>
                <div className="text-center space-y-1">
                  <p className="text-sm text-emerald-700 max-w-xs">
                    {isRecording 
                      ? "Clique para parar e processar" 
                      : "Clique no microfone e diga o que você comeu"}
                  </p>
                  {voiceStatus && (
                    <p className="text-xs font-medium text-emerald-600 animate-pulse">
                      {voiceStatus}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Import Link Section */}
            <section className="bg-emerald-50/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-emerald-100 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-emerald-900">Importar do ChatGPT</h2>
                </div>
                {chatGptUrl && (
                  <button 
                    onClick={() => setChatGptUrl('')}
                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-red-500 transition-colors"
                  >
                    Limpar Link
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="Cole o link de compartilhamento..."
                    value={chatGptUrl}
                    onChange={(e) => setChatGptUrl(e.target.value)}
                    className="w-full bg-white/50 border border-emerald-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-emerald-300"
                  />
                  {chatGptUrl && (
                    <button 
                      onClick={() => setChatGptUrl('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-emerald-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button 
                  onClick={handleImportUrl}
                  disabled={isLoading || !chatGptUrl}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-emerald-200"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Importar
                </button>
              </div>
            </section>

            {/* Paste Text Section */}
            <section className="bg-emerald-50/60 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-emerald-100 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-emerald-500" />
                  <h2 className="font-semibold text-emerald-800">Colar Texto</h2>
                </div>
                {pastedText && (
                  <button 
                    onClick={() => setPastedText('')}
                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-red-500 transition-colors"
                  >
                    Limpar Texto
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <textarea 
                  placeholder="Cole o texto da conversa aqui para extrair alimentos..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full h-24 bg-white/50 border border-emerald-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm resize-none placeholder:text-emerald-300"
                />
                <div className="flex justify-end">
                  <button 
                    onClick={handlePasteContent}
                    disabled={isLoading || !pastedText.trim()}
                    className="bg-emerald-800 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Processar Texto
                  </button>
                </div>
              </div>
            </section>

            {/* Food List */}
            <section className="bg-emerald-50/50 backdrop-blur-sm rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
              <div className="p-6 border-b border-emerald-100 flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2 text-emerald-900">
                  <Utensils className="w-5 h-5 text-emerald-500" />
                  Alimentos Adicionados
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-white/80 px-2 py-1 rounded-lg text-emerald-600 border border-emerald-100">
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
                      className="text-xs font-bold uppercase tracking-wider text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-100/30 text-[10px] uppercase tracking-wider font-bold text-emerald-600">
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
                          <td className="px-6 py-4 font-medium text-zinc-900">{food.name}</td>
                          <td className="px-6 py-4 text-zinc-500 text-sm">{food.amount || '-'}</td>
                          <td className="px-6 py-4 text-right font-mono font-medium text-zinc-700">
                            {food.calories} <span className="text-[10px] text-zinc-400">kcal</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => removeFood(index)}
                              className="text-zinc-300 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-4 h-4" />
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
                  className="flex-1 bg-white/80 border border-emerald-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <input 
                  type="number" 
                  placeholder="kcal"
                  value={manualFood.calories}
                  onChange={(e) => setManualFood({ ...manualFood, calories: e.target.value })}
                  className="w-20 bg-white/80 border border-emerald-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none font-mono focus:ring-2 focus:ring-emerald-500/20"
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
      card: "bg-green-50/90 border-green-100",
      icon: "text-green-600 bg-white shadow-sm shadow-green-100",
      text: "text-green-900",
      label: "text-green-500"
    },
    emerald: {
      card: "bg-emerald-50/90 border-emerald-100",
      icon: "text-emerald-600 bg-white shadow-sm shadow-emerald-100",
      text: "text-emerald-900",
      label: "text-emerald-500"
    },
    red: {
      card: "bg-red-50/90 border-red-100",
      icon: "text-red-600 bg-white shadow-sm shadow-red-100",
      text: "text-red-900",
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
        <p className={cn("text-xs font-bold uppercase tracking-wider", current.label)}>{label}</p>
        <p className={cn("text-2xl font-mono font-bold", current.text)}>
          {value} <span className="text-sm font-normal opacity-60">{unit}</span>
        </p>
      </div>
    </div>
  );
}
