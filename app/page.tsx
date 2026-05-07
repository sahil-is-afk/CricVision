'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Activity, Shield, Target, Plus, Play, Info, Video, Image as ImageIcon, CheckCircle, AlertCircle, RefreshCw, User, Settings, Crosshair, Map, Wind, TrendingUp, ChevronDown, ChevronRight, Navigation, BadgeCheck } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

type ShotAnalysis = {
  playerIdentification?: string;
  shotType: string;
  ballType: string;
  direction: string;
  speedEstimation: string;
  runsPredicted: number;
  qualityScore: number;
  pitchMap: {
    length: string;
    line: string;
    landingX: number;
    landingY: number;
  };
  biomechanics: {
    footwork: string;
    batPath: string;
    impactPoint: string;
    headPosition: string;
    followThrough: string;
  };
  detailedAnalysis: string;
  recommendations: string[];
};

type UploadItem = {
  id: string;
  fileUrl: string;
  type: 'image' | 'video';
  timestamp: Date;
  analysis?: ShotAnalysis;
  isAnalyzing: boolean;
  error?: string;
};

export default function CricketAnalyzer() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedBiomechanics, setExpandedBiomechanics] = useState<string | null>('footwork');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isPlayersModalOpen, setIsPlayersModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [myPlayers, setMyPlayers] = useState<string[]>(['Virat Kohli', 'Steve Smith']);
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleExport = () => {
    let content = `<html><head><title>Analysis Export</title></head><body><h1>CricVision - Session Analysis</h1>`;
    items.forEach(item => {
        if(item.analysis) {
            content += `<h2>${item.analysis.playerIdentification || 'Unknown Player'} - ${item.analysis.shotType}</h2>`;
            content += `<ul><li>Delivery: ${item.analysis.ballType} (${item.analysis.speedEstimation})</li>`;
            content += `<li>Quality Score: ${item.analysis.qualityScore}</li>`;
            content += `<li>Predicted Runs: ${item.analysis.runsPredicted}</li></ul>`;
            content += `<h3>Detailed Analysis</h3><p>${item.analysis.detailedAnalysis}</p><hr/>`;
        }
    });
    content += `</body></html>`;
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Analysis_Export.doc';
    a.click();
    showToast('Exporting Analysis to Document...');
    setIsSettingsOpen(false);
  };

  const addPlayer = () => {
    if(newPlayerName.trim()) {
        setMyPlayers([...myPlayers, newPlayerName.trim()]);
        setNewPlayerName('');
        showToast('Player added!');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find(i => i.id === selectedItemId);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      alert("Please upload an image or video file.");
      return;
    }

    const newItem: UploadItem = {
      id: Math.random().toString(36).substring(7),
      fileUrl: URL.createObjectURL(file),
      type: isImage ? 'image' : 'video',
      timestamp: new Date(),
      isAnalyzing: true
    };

    setItems(prev => [newItem, ...prev]);
    setSelectedItemId(newItem.id);

    try {
      let parts: any[] = [];
      if (isImage) {
        const base64 = await fileToBase64(file);
        parts = [{ inlineData: { data: base64, mimeType: file.type } }];
      } else {
        parts = await extractFramesFromVideo(file, 5);
      }

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API Key. Set NEXT_PUBLIC_GEMINI_API_KEY in .env");

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              { text: "Perform a highly detailed biomechanical and tactical analysis of this cricket shot sequence. Extract precise data on: 0. Identify the player if they are a popular international cricketer (or 'Unknown Player'), 1. The delivery (type, estimated speed, length, line), 2. The shot (type, direction, predicted runs 0, 1, 2, 3, 4, 6), 3. Player biomechanics (footwork, bat path, impact point, head position, follow-through), 4. A thorough tactical analysis, and 5. Actionable recommendations for improvement. Give a realistic quality score out of 100 based on technique." },
              ...parts
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              playerIdentification: { type: Type.STRING, description: "Name of the popular international player, or 'Unknown Player'" },
              shotType: { type: Type.STRING },
              ballType: { type: Type.STRING },
              direction: { type: Type.STRING },
              speedEstimation: { type: Type.STRING },
              runsPredicted: { type: Type.NUMBER },
              qualityScore: { type: Type.NUMBER },
              pitchMap: {
                type: Type.OBJECT,
                properties: {
                  length: { type: Type.STRING, description: "e.g. Good Length, Full, Short, Yorker" },
                  line: { type: Type.STRING, description: "e.g. Middle stump, Outside off" },
                  landingX: { type: Type.NUMBER, description: "Estimated X coordinate of pitch landing (0-100, 0=left of pitch, 100=right of pitch, 50=middle)" },
                  landingY: { type: Type.NUMBER, description: "Estimated Y coordinate of pitch landing (0-100, 0=Batsman popping crease, 100=Bowler popping crease. Yorker is blockhole ~0-10, Full ~15-30, Good length ~35-55, Short ~60-85)" }
                },
                required: ["length", "line", "landingX", "landingY"]
              },
              biomechanics: {
                type: Type.OBJECT,
                properties: {
                  footwork: { type: Type.STRING },
                  batPath: { type: Type.STRING },
                  impactPoint: { type: Type.STRING },
                  headPosition: { type: Type.STRING },
                  followThrough: { type: Type.STRING }
                },
                required: ["footwork", "batPath", "impactPoint", "headPosition", "followThrough"]
              },
              detailedAnalysis: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["playerIdentification", "shotType", "ballType", "direction", "speedEstimation", "runsPredicted", "qualityScore", "pitchMap", "biomechanics", "detailedAnalysis", "recommendations"]
          }
        }
      });

      const resultText = response.text || "";
      const analysisData = JSON.parse(resultText) as ShotAnalysis;

      setItems(prev => prev.map(item => 
        item.id === newItem.id ? { ...item, isAnalyzing: false, analysis: analysisData } : item
      ));

    } catch (e: any) {
      console.error("Analysis Failed:", e);
      let errorMsg = "Failed to analyze media. Please try again.";
      try {
        if (e?.status === 429 || (e?.message && e.message.includes("429")) || (e?.message && e.message.includes("quota"))) {
           errorMsg = "API Rate Limit Exceeded. Please try again in an hour or check your Gemini API key quota.";
        } else if (e?.message) {
          errorMsg = typeof e.message === 'string' ? e.message : JSON.stringify(e.message);
        } else if (typeof e === 'string') {
          errorMsg = e;
        } else if (e instanceof Event) {
          errorMsg = "Media processing error.";
        } else if (e && typeof e === 'object') {
          errorMsg = JSON.stringify(e);
        }
      } catch (stringifyError) {
        errorMsg = "An unknown error occurred during media processing.";
      }
      
      setItems(prev => prev.map(item => 
        item.id === newItem.id ? { ...item, isAnalyzing: false, error: errorMsg } : item
      ));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const extractFramesFromVideo = (file: File, numFrames: number): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.crossOrigin = "anonymous";
      video.playsInline = true;

      video.onloadeddata = () => {
        const duration = video.duration;
        if (!duration || duration === Infinity) {
          // Fallback if metadata is not properly loaded
          setTimeout(() => {
            if (video.duration) {
              extract();
            } else {
              reject(new Error("Unable to determine video duration"));
            }
          }, 500);
          return;
        }
        extract();

        function extract() {
          const duration = video.duration;
          const interval = duration / (numFrames + 1);
          let currentFrameIndex = 1;
          const frames: any[] = [];
          
          const captureFrame = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            frames.push({
              inlineData: {
                data: dataUrl.split(',')[1],
                mimeType: 'image/jpeg'
              }
            });

            currentFrameIndex++;
            if (currentFrameIndex <= numFrames) {
              video.currentTime = currentFrameIndex * interval;
            } else {
              resolve(frames);
            }
          };

          video.onseeked = () => {
            captureFrame();
          };

          video.currentTime = interval;
        }
      };

      video.onerror = (e) => reject(e);
    });
  };

  // Aggregated Stats over History
  const analyzedItems = items.filter(i => i.analysis);
  const avgQuality = analyzedItems.length > 0 
    ? Math.round(analyzedItems.reduce((acc, curr) => acc + (curr.analysis?.qualityScore || 0), 0) / analyzedItems.length) || 0
    : 0;

  const runsDistribution = [0, 1, 2, 3, 4, 6].map(runs => ({
    runs: `${runs}s`,
    count: items.filter(i => i.analysis?.runsPredicted === runs).length
  }));

  const chartColors = ['#0284c7', '#059669', '#d97706', '#7c3aed', '#e11d48'];

  // Accordion Toggle
  const toggleBiomechanics = (key: string) => {
    setExpandedBiomechanics(prev => prev === key ? null : key);
  }

  return (
    <div className="min-h-screen flex flex-col relative w-full overflow-hidden">
      {/* Top Header */}
      <header className="h-16 glass-panel !rounded-none !border-t-0 !border-l-0 !border-r-0 !border-b-white/20 z-20 px-4 md:px-8 flex items-center justify-between sticky top-0 w-full md:mb-6 mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 rounded-full glass-bubble shadow-[0_0_15px_rgba(2,132,199,0.4)] relative border-[0.5px] border-white/80">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-400 to-sky-600 rounded-full opacity-80 backdrop-blur-md"></div>
            <div className="w-4 h-4 border-2 border-white rounded-full relative z-10 blur-[0.5px]"></div>
            <div className="w-4 h-4 border-2 border-white rounded-full absolute z-10 drop-shadow-md"></div>
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-800 drop-shadow-sm">CRIC<span className="text-sky-600">VISION</span></h1>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold drop-shadow-sm">Session Mode</span>
            <span className="text-sm font-bold text-slate-700 drop-shadow-sm">Live Analytics</span>
          </div>
          <div className="hidden sm:block h-8 w-[1px] bg-white/40 drop-shadow-sm"></div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => { setIsSettingsOpen(!isSettingsOpen); setIsProfileOpen(false); }}
                className={`p-2 rounded-full transition-all glass-bubble ${isSettingsOpen ? 'bg-sky-100 text-sky-600' : 'hover:bg-white/70 text-slate-600'}`}
              >
                <Settings size={18} />
              </button>
              {isSettingsOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl shadow-lg z-50 p-2 text-sm flex flex-col gap-1 text-slate-700">
                  <div className="px-3 py-2 font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-200/50 mb-1">Settings</div>
                  <button onClick={() => { setTheme(theme === 'light' ? 'dark' : 'light'); setIsSettingsOpen(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-sky-50 transition-colors font-medium text-slate-600">Theme: {theme === 'light' ? 'Light' : 'Dark'}</button>
                  <button onClick={handleExport} className="text-left px-3 py-2 rounded-lg hover:bg-sky-50 transition-colors font-medium text-slate-600">Analysis Export</button>
                </div>
              )}
            </div>
            
            <div className="relative">
              <button 
                onClick={() => { setIsProfileOpen(!isProfileOpen); setIsSettingsOpen(false); }}
                className={`p-2 border rounded-full transition-colors shadow-sm flex items-center justify-center w-9 h-9 ${isProfileOpen ? 'bg-sky-100 border-sky-300 text-sky-600' : 'bg-white/50 border-white/40 hover:bg-white/80 text-slate-700'}`}
              >
                <User size={18} />
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl shadow-lg z-50 p-2 text-sm flex flex-col gap-1 text-slate-700">
                  <div className="px-3 py-3 border-b border-slate-200/50 mb-1 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold">
                      CO
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 leading-tight">Coach Portal</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Pro License</div>
                    </div>
                  </div>
                  <button onClick={() => { setIsPlayersModalOpen(true); setIsProfileOpen(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-sky-50 transition-colors font-medium text-slate-600">My Players</button>
                  <button onClick={() => { setIsStatsModalOpen(true); setIsProfileOpen(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-sky-50 transition-colors font-medium text-slate-600">Coaching Stats</button>
                  <button onClick={() => { showToast("Logging out..."); setIsProfileOpen(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-600 mt-1 transition-colors font-medium">Log out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6 max-w-screen-2xl mx-auto w-full relative z-10">
        
        {/* LEFT PANE: UPLOAD */}
        <div className="xl:col-span-3 glass-panel p-6 flex flex-col gap-6 h-fit">
          
          {/* Uploader */}
          <div 
            className={`glass-pill p-6 transition-all duration-300 text-center cursor-pointer flex flex-col items-center justify-center min-h-[180px] group ${
              isDragging ? 'border-sky-500 bg-sky-500/10 scale-[1.02] shadow-[0_0_20px_rgba(2,132,199,0.2)]' : 'border-white/60 hover:bg-white/40'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ boxShadow: isDragging ? undefined : 'inset 0 2px 15px rgba(0,0,0,0.03)' }}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileInput} accept="image/*,video/*" className="hidden" />
            <div className={`p-4 rounded-full mb-3 glass-bubble transition-transform group-hover:scale-110 ${isDragging ? 'text-sky-600' : 'text-slate-500'}`}>
              <Upload size={24} />
            </div>
            <p className="font-bold text-slate-800 mb-1 text-sm">{isDragging ? 'Drop it here!' : 'Drag file to upload'}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Supports Image or Video</p>
          </div>
          
          {items.length > 0 && (
            <div className="glass-pill p-5">
              <h3 className="text-[10px] text-slate-500 uppercase font-bold mb-4 tracking-wider flex items-center gap-2">
                <span className="w-1 h-3 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full shadow-[0_0_5px_rgba(168,85,247,0.5)]"></span>Session Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-check p-3 rounded-lg flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-bold mb-1">Avg Quality</span>
                  <span className="text-lg font-bold font-mono text-emerald-600 drop-shadow-sm">{avgQuality} <span className="text-[9px] text-slate-500">/ 100</span></span>
                </div>
                <div className="glass-check p-3 rounded-lg flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-bold mb-1">Total Shots</span>
                  <span className="text-lg font-bold font-mono text-sky-600 drop-shadow-sm">{items.filter(i => i.analysis).length}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT PANE: ANALYSIS & PREVIEW */}
        <div className="xl:col-span-9 flex flex-col gap-6 overflow-hidden w-full">
          
          {selectedItem ? (
            <>
              {/* Visual Preview & Timeline History */}
              <div className="flex flex-col gap-4 relative z-10 w-full">
                <div className="glass-panel overflow-hidden bg-black/10 flex items-center justify-center relative w-full h-[360px] md:h-[400px]">
                  {selectedItem.type === 'video' ? (
                    <video src={selectedItem.fileUrl} controls className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" autoPlay loop muted playsInline />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={selectedItem.fileUrl} alt="Selected Shot" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                  )}
                  
                  {/* HUD Overlay Stats */}
                  {selectedItem.analysis && (
                    <div className="absolute top-4 left-4 flex flex-wrap gap-2 md:gap-3 z-10 w-[calc(100%-2rem)]">
                      <div className="p-2 md:p-3 glass-pill floating-score flex-shrink-0 text-slate-800">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                          <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider">AI Synced</span>
                        </div>
                        <div className="text-xl md:text-2xl font-mono font-bold">{selectedItem.analysis.qualityScore} <span className="text-[9px] md:text-[10px] opacity-70 font-sans tracking-wide">SCORE</span></div>
                      </div>
                      <div className="p-2 md:p-3 flex flex-col justify-center glass-pill floating-score max-w-[150px] md:max-w-[200px] text-slate-800">
                         <span className="text-[9px] md:text-[10px] uppercase font-bold opacity-70 tracking-wider flex items-center gap-1 mb-1"><User size={10} /> Player</span>
                         <span className="text-xs md:text-sm font-bold truncate">
                           {selectedItem.analysis.playerIdentification || 'Unknown'}
                         </span>
                      </div>
                    </div>
                  )}
                  
                  {selectedItem.isAnalyzing && (
                    <div className="absolute inset-0 bg-white/40 dark:bg-black/40 flex flex-col items-center justify-center backdrop-blur-md z-10 cursor-wait">
                      <div className="w-16 h-16 relative flex items-center justify-center mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-sky-300/50 border-t-sky-500 animate-spin"></div>
                        <Target className="text-sky-600 dark:text-sky-400" size={24} />
                      </div>
                      <p className="font-bold text-xs uppercase tracking-widest text-sky-700 dark:text-sky-300 animate-pulse">Running Vision AI Modeling...</p>
                    </div>
                  )}
                </div>

                {/* Horizontal History Bar */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar w-full snap-x">
                  {items.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedItemId(item.id)}
                      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all shrink-0 w-64 snap-start border border-transparent backdrop-blur-sm ${
                        selectedItemId === item.id ? 'bg-white/60 dark:bg-slate-800/60 shadow-lg ring-1 ring-sky-400 border-white/50' : 'bg-white/20 dark:bg-slate-800/20 hover:bg-white/40 hover:border-white/30'
                      }`}
                    >
                      <div className="w-12 h-12 bg-black/10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner">
                        {item.type === 'image' ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.fileUrl} alt="Thumbnail" className="w-full h-full object-cover opacity-90" />
                        ) : (
                          <video src={item.fileUrl} className="w-full h-full object-cover opacity-90" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          {item.type === 'video' ? <Video size={14} className="text-white drop-shadow-md" /> : <ImageIcon size={14} className="text-white drop-shadow-md" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-bold text-[11px] uppercase truncate tracking-tight">
                            {item.analysis ? item.analysis.shotType : (item.isAnalyzing ? 'Analyzing...' : 'Failed')}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] opacity-60 font-bold uppercase">{item.timestamp.toLocaleTimeString()}</p>
                          {item.isAnalyzing && <RefreshCw size={10} className="animate-spin text-sky-500" />}
                          {item.analysis && <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.analysis.qualityScore}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analysis Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start relative z-10">
                
                {/* Left Column: Technical Readout & Interactive Pitch */}
                <div className="md:col-span-5 flex flex-col gap-6">
                  <div className="glass-panel p-5 flex flex-col gap-4">
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Technical Readout
                    </h3>
                    
                    {selectedItem.error ? (
                      <div className="flex items-center gap-3 text-red-600 bg-red-100/50 p-4 rounded-xl border border-red-200">
                        <AlertCircle size={20} />
                        <span className="font-bold text-xs">{selectedItem.error}</span>
                      </div>
                    ) : selectedItem.analysis ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="data-row sm:col-span-2 flex-row items-center gap-3 p-3 glass-pill !bg-emerald-50/40">
                          <div className="p-2 glass-bubble text-emerald-600 rounded-full"><Activity size={16} /></div>
                          <div>
                            <div className="data-label !text-emerald-700/70">Shot Classification</div>
                            <div className="data-value text-emerald-800 dark:text-emerald-400">{selectedItem.analysis.shotType}</div>
                          </div>
                        </div>
                        <div className="glass-pill p-3">
                          <div className="flex items-center gap-1.5 mb-1"><Target size={12} className="opacity-60" /><span className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Delivery</span></div>
                          <div className="font-bold text-sm tracking-tight">{selectedItem.analysis.ballType}</div>
                        </div>
                        <div className="glass-pill p-3">
                          <div className="flex items-center gap-1.5 mb-1"><Wind size={12} className="opacity-60" /><span className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Speed</span></div>
                          <div className="font-mono font-bold text-sm">{selectedItem.analysis.speedEstimation}</div>
                        </div>
                        <div className="glass-pill p-3">
                          <div className="flex items-center gap-1.5 mb-1"><Map size={12} className="opacity-60" /><span className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Length</span></div>
                          <div className="font-bold text-sm tracking-tight">{selectedItem.analysis.pitchMap.length}</div>
                        </div>
                        <div className="glass-pill p-3">
                          <div className="flex items-center gap-1.5 mb-1"><Crosshair size={12} className="opacity-60" /><span className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Line</span></div>
                          <div className="font-bold text-sm tracking-tight">{selectedItem.analysis.pitchMap.line}</div>
                        </div>
                        <div className="glass-pill p-3">
                          <div className="flex items-center gap-1.5 mb-1"><Navigation size={12} className="opacity-60" /><span className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Direction</span></div>
                          <div className="font-bold text-sm tracking-tight">{selectedItem.analysis.direction}</div>
                        </div>
                        <div className="glass-pill p-3 border-amber-200/50 bg-gradient-to-br from-amber-50/40 to-transparent">
                          <div className="flex items-center gap-1.5 mb-1"><TrendingUp size={12} className="text-amber-500" /><span className="text-[10px] uppercase font-bold text-amber-600/80 tracking-wider">Predicted Runs</span></div>
                          <div className="font-mono font-bold text-amber-600 text-xl">{selectedItem.analysis.runsPredicted}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center flex-1 opacity-50 font-bold text-xs uppercase text-slate-500 tracking-wider min-h-[150px]">
                        Awaiting Analysis...
                      </div>
                    )}
                  </div>

                  {/* Interactive Pitch Map Visual */}
                  {selectedItem.analysis && (
                    <div className="glass-panel p-5 flex flex-col gap-4">
                      <h3 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Pitch Zone Visual
                      </h3>
                      <div className="pitch-container w-full h-[280px] flex justify-center py-2 relative"
                           style={{
                             backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,0,0,0.05) 20px, rgba(0,0,0,0.05) 40px)'
                           }}>
                        <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/90 uppercase tracking-widest bg-black/40 px-3 py-0.5 rounded-full z-10 backdrop-blur-md border border-white/20">Batsman End</span>
                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/90 uppercase tracking-widest bg-black/40 px-3 py-0.5 rounded-full z-10 backdrop-blur-md border border-white/20">Bowler End</span>
                        
                        <div className="w-[130px] h-[96%] mt-[2%] bg-[#e3d1a3] rounded-sm relative shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                            {/* Bowling crease (top) */}
                            <div className="w-[160px] h-[2px] bg-white/90 absolute top-4 left-1/2 -translate-x-1/2"></div>
                            {/* Popping crease (top) */}
                            <div className="w-[160px] h-[2px] bg-white/90 absolute top-12 left-1/2 -translate-x-1/2"></div>
                            {/* Return creases (top) */}
                            <div className="w-[2px] h-[48px] bg-white/90 absolute top-4 left-1/2 -translate-x-[60px]"></div>
                            <div className="w-[2px] h-[48px] bg-white/90 absolute top-4 left-1/2 translate-x-[60px]"></div>
                            {/* Stumps (top) */}
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 -translate-y-[10px] flex gap-[3px]">
                              <div className="w-1.5 h-3.5 bg-yellow-100 rounded-t-[1px] shadow-sm"></div>
                              <div className="w-1.5 h-3.5 bg-yellow-100 rounded-t-[1px] shadow-sm"></div>
                              <div className="w-1.5 h-3.5 bg-yellow-100 rounded-t-[1px] shadow-sm"></div>
                            </div>
                      
                            {/* Bowling crease (bottom) */}
                            <div className="w-[160px] h-[2px] bg-white/90 absolute bottom-4 left-1/2 -translate-x-1/2"></div>
                            {/* Popping crease (bottom) */}
                            <div className="w-[160px] h-[2px] bg-white/90 absolute bottom-12 left-1/2 -translate-x-1/2"></div>
                            {/* Return creases (bottom) */}
                            <div className="w-[2px] h-[48px] bg-white/90 absolute bottom-4 left-1/2 -translate-x-[60px]"></div>
                            <div className="w-[2px] h-[48px] bg-white/90 absolute bottom-4 left-1/2 translate-x-[60px]"></div>
                            {/* Stumps (bottom) */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-[2px] flex gap-[3px]">
                              <div className="w-1.5 h-3.5 bg-yellow-100 rounded-t-[1px] shadow-sm"></div>
                              <div className="w-1.5 h-3.5 bg-yellow-100 rounded-t-[1px] shadow-sm"></div>
                              <div className="w-1.5 h-3.5 bg-yellow-100 rounded-t-[1px] shadow-sm"></div>
                            </div>
                            
                            {/* Pitch Zones (Optional Backgrounds to indicate length) */}
                            <div className="absolute top-12 bottom-12 left-0 right-0 flex flex-col opacity-20 pointer-events-none">
                              <div className="flex-[0.15] bg-blue-600 border-b-2 border-blue-900 border-dashed"></div> {/* Yorker */}
                              <div className="flex-[0.15] bg-green-600 border-b-2 border-green-900 border-dashed"></div> {/* Full */}
                              <div className="flex-[0.4] bg-yellow-600 border-b-2 border-yellow-900 border-dashed"></div> {/* Good */}
                              <div className="flex-[0.3] bg-red-600"></div> {/* Short */}
                            </div>
                      
                            {/* Dynamic Landing Spot */}
                            <div className="absolute w-5 h-5 bg-[#dc2626] border-2 border-white rounded-full shadow-[0_0_15px_rgba(220,38,38,0.9)] animate-bounce z-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center after:content-[''] after:w-1.5 after:h-1.5 after:bg-white after:rounded-full after:opacity-70" style={{
                               top: typeof selectedItem.analysis.pitchMap.landingY !== 'undefined' ? `${18 + (selectedItem.analysis.pitchMap.landingY * 0.64)}%` : (selectedItem.analysis.pitchMap.length.toLowerCase().includes('york') ? '15%' : selectedItem.analysis.pitchMap.length.toLowerCase().includes('full') ? '28%' : selectedItem.analysis.pitchMap.length.toLowerCase().includes('good') ? '50%' : '75%'),
                               left: typeof selectedItem.analysis.pitchMap.landingX !== 'undefined' ? `${selectedItem.analysis.pitchMap.landingX}%` : (selectedItem.analysis.pitchMap.line.toLowerCase().includes('leg') ? '70%' : selectedItem.analysis.pitchMap.line.toLowerCase().includes('middle') ? '50%' : '30%')
                            }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Tactical & Biomechanics */}
                <div className="md:col-span-7 flex flex-col gap-6">
                  
                  {/* Tactical Breakdown */}
                  <div className="glass-panel p-5 flex flex-col gap-4">
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Tactical Breakdown
                    </h3>
                    {selectedItem.analysis ? (
                      <div className="flex-1 text-sm leading-relaxed text-slate-700 flex flex-col gap-5">
                        <div className="glass-pill p-4">
                          <h4 className="font-bold text-[10px] uppercase text-purple-600 mb-2 tracking-widest">Execution Summary</h4>
                          <p>{selectedItem.analysis.detailedAnalysis}</p>
                        </div>
                        <div>
                          <h4 className="font-bold text-[10px] uppercase text-amber-600 mb-2 tracking-widest pl-1">Actionable Recommendations</h4>
                          <ul className="space-y-2">
                            {selectedItem.analysis.recommendations.map((rec, i) => (
                              <li key={i} className="flex gap-3 items-start glass-check p-3 transition-transform duration-200 hover:scale-[1.01]">
                                <span className="text-amber-500 mt-0.5"><CheckCircle size={14} /></span>
                                <span className="text-[13px] leading-tight font-medium">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center flex-1 opacity-50 font-bold text-xs uppercase text-slate-500 tracking-wider h-[100px]">
                        Awaiting Analysis...
                      </div>
                    )}
                  </div>
                  
                  {/* Biomechanical Telemetry (Accordion) */}
                  <div className="glass-panel p-5 flex flex-col gap-3">
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Biomechanical Telemetry
                    </h3>
                    {selectedItem.analysis ? (
                      <div className="flex flex-col gap-2">
                        {Object.entries({
                          'footwork': { label: 'Footwork & Base', color: 'bg-sky-500', pillClass: 'bg-sky-100 text-sky-700 border-sky-200', icon: <Navigation size={14}/> },
                          'headPosition': { label: 'Head Position & Balance', color: 'bg-emerald-500', pillClass: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <User size={14}/> },
                          'batPath': { label: 'Bat Path & Swing Angle', color: 'bg-purple-500', pillClass: 'bg-purple-100 text-purple-700 border-purple-200', icon: <TrendingUp size={14}/> },
                          'impactPoint': { label: 'Impact Point', color: 'bg-amber-500', pillClass: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Target size={14}/> },
                          'followThrough': { label: 'Follow-Through', color: 'bg-rose-500', pillClass: 'bg-rose-100 text-rose-700 border-rose-200', icon: <CheckCircle size={14}/> },
                        }).map(([key, config]) => (
                          <div key={key} className="glass-check overflow-hidden transition-all duration-300">
                            <button 
                              onClick={() => toggleBiomechanics(key)}
                              className="w-full flex items-center justify-between p-3 hover:bg-white/10 transition-colors text-left focus:outline-none"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 glass-bubble rounded-full flex items-center justify-center text-slate-700 opacity-80 shadow-sm relative">
                                  <div className={`absolute inset-0 rounded-full opacity-20 ${config.color}`}></div>
                                  {config.icon}
                                </div>
                                <span className="font-bold text-xs uppercase tracking-wide opacity-80">{config.label}</span>
                              </div>
                              <div className={`p-1 rounded-full border glass-bubble transition-transform duration-300 ${expandedBiomechanics === key ? 'rotate-180' : ''}`}>
                                <ChevronDown size={14} className="opacity-70" />
                              </div>
                            </button>
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedBiomechanics === key ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                              <div className="p-4 pt-1 text-[13px] opacity-80 leading-relaxed border-t border-white/10 dark:border-white/5 bg-black/5 dark:bg-black/20">
                                {selectedItem.analysis!.biomechanics[key as keyof typeof selectedItem.analysis.biomechanics]}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center flex-1 opacity-50 font-bold text-xs uppercase text-slate-500 tracking-wider h-[100px]">
                        Awaiting Analysis...
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </>
          ) : (
            <div className="glass-panel flex-1 min-h-[500px] flex flex-col items-center justify-center gap-4 text-slate-500 shadow-inner">
              <Activity size={64} className="opacity-20 text-sky-500" />
              <h2 className="text-xl font-bold text-slate-700">No Item Selected</h2>
              <p className="font-bold text-xs uppercase max-w-sm text-center tracking-wider opacity-70">Upload a video or image track of a cricket shot to generate predictive analysis.</p>
            </div>
          )}

        </div>
      </main>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 z-[60]">
          <Info size={18} className="text-sky-400" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      {isPlayersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in slide-in-from-bottom-10">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><User className="text-sky-500" /> My Players</h3>
            <div className="flex gap-2 mb-4">
              <input type="text" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} placeholder="Player Name" className="flex-1 border border-slate-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800" />
              <button onClick={addPlayer} className="bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 font-medium transition-colors shadow-sm">Add</button>
            </div>
            <ul className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {myPlayers.map((p, i) => (
                <li key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-lg font-medium text-slate-700 flex justify-between items-center shadow-sm">
                  {p} <BadgeCheck className="text-emerald-500" size={18} />
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setIsPlayersModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-in slide-in-from-bottom-10">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="text-sky-500" /> Coaching Stats Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 shadow-sm flex flex-col justify-center">
                 <p className="text-xs uppercase font-bold text-sky-600 mb-1">Avg Quality Score</p>
                 <p className="text-4xl font-bold text-slate-800 tracking-tight">{avgQuality}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                 <p className="text-xs uppercase font-bold text-emerald-600 mb-1">Total Deliveries</p>
                 <p className="text-4xl font-bold text-slate-800 tracking-tight">{items.filter(i=>i.analysis).length}</p>
              </div>
              <div className="col-span-2 bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm">
                 <p className="text-xs uppercase font-bold text-slate-500 mb-4">Predicted Runs Distribution</p>
                 <div className="flex justify-between items-end h-24 gap-2">
                    {runsDistribution.map((d, i) => {
                       const maxCount = Math.max(...runsDistribution.map(r => r.count), 1);
                       const height = `${Math.max((d.count / maxCount) * 100, 10)}%`;
                       return (
                         <div key={d.runs} className="flex flex-col items-center flex-1 gap-2">
                            <span className="text-xs font-bold text-slate-700">{d.count}</span>
                            <div className="w-full bg-slate-200 rounded-t-sm relative flex items-end overflow-hidden" style={{ height: '60px' }}>
                               <div className="w-full rounded-t-sm transition-all duration-500 shadow-sm" style={{ height, backgroundColor: chartColors[i % chartColors.length] }}></div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{d.runs}</span>
                         </div>
                       );
                    })}
                 </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setIsStatsModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
