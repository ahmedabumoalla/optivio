'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Battery, Bluetooth, Zap, Clock, ChevronLeft, Send, X, Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; // استيراد مكون الصور

export default function MedicalDashboard() {
  const router = useRouter();
  
  // --- محاكاة بيانات حية ---
  const [pulseValue, setPulseValue] = useState(0);
  const [impedance, setImpedance] = useState(2.4);
  const [battery, setBattery] = useState(98);
  const [sessionTime, setSessionTime] = useState(0);

  // تحديث البيانات وهمياً
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseValue(Math.floor(Math.random() * (40 - 20 + 1) + 20));
      setImpedance(prev => +(prev + (Math.random() * 0.1 - 0.05)).toFixed(2));
      setSessionTime(t => t + 1);
      setBattery(prev => (sessionTime > 0 && sessionTime % 60 === 0 ? prev - 1 : prev)); 
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#4bc7c5] selection:text-black relative pb-12">
      
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(75,199,197,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(75,199,197,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-5 border-b border-[#333] bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-white/10 transition">
             <ChevronLeft className="text-[#4bc7c5]" />
          </button>
          
          {/* ===== تعديل الشعار هنا ===== */}
          {/* تأكد من وضع صورة الشعار باسم logo.png داخل مجلد public */}
          <div className="relative h-12 w-40 flex items-center">
             {/* إذا لم تضع صورة بعد، سيظهر النص البديل، بمجرد وضع الصورة ستظهر هنا */}
             <Image 
               src="/logo.png" 
               alt="Optivio Logo" 
               width={160} 
               height={48} 
               className="object-contain object-left"
               priority
             />
          </div>
          {/* =========================== */}
        </div>
        
        <div className="flex items-center gap-6 text-xs font-mono text-gray-400">
          <div className="flex items-center gap-2">
            <Bluetooth size={14} className="text-[#4bc7c5] animate-pulse" />
            <span>CONNECTED</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
               <Battery size={14} className={battery < 20 ? 'text-red-500' : ''} />
               <div className={`absolute top-[3px] left-[2px] h-[8px] rounded-sm ${battery < 20 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${(battery/100)*10}px` }}></div>
            </div>
            <span>{battery}%</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4bc7c5] to-[#0e908e] flex items-center justify-center text-black font-bold shadow-[0_0_10px_rgba(75,199,197,0.3)]">
            A
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        
        {/* Left Column: Device Visualization */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Glasses Visualizer */}
          <div className="bg-[#111] rounded-3xl border border-[#333] relative overflow-hidden flex flex-col items-center justify-center min-h-[450px] p-8 group shadow-[0_0_50px_rgba(75,199,197,0.05)]">
            <div className="absolute top-6 left-6 flex flex-col gap-1 z-20">
              <span className="text-[10px] text-gray-500 uppercase">Status</span>
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-[#4bc7c5] animate-pulse shadow-[0_0_8px_#4bc7c5]"></span>
                 <span className="text-[#4bc7c5] font-mono text-sm glow-text">ACTIVE THERAPY</span>
              </div>
            </div>

            {/* SVG Glasses */}
            <div className="relative w-full max-w-2xl aspect-[16/9] flex items-center justify-center">
               <svg viewBox="0 0 600 250" className="w-full drop-shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
                  <defs>
                     <linearGradient id="frameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#444" />
                        <stop offset="50%" stopColor="#222" />
                        <stop offset="100%" stopColor="#333" />
                     </linearGradient>
                     <radialGradient id="lensGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stopColor="rgba(75,199,197,0.15)" />
                        <stop offset="80%" stopColor="rgba(0,0,0,0.4)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
                     </radialGradient>
                     <linearGradient id="lensShine" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                        <stop offset="100%" stopColor="transparent" />
                     </linearGradient>
                     <filter id="dropShadow" height="130%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="5"/> 
                        <feOffset dx="2" dy="5" result="offsetblur"/> 
                        <feMerge> 
                          <feMergeNode/>
                          <feMergeNode in="SourceGraphic"/> 
                        </feMerge>
                     </filter>
                  </defs>

                  <path d="M100,80 C100,40 220,40 220,80 C220,130 100,130 100,80 Z M380,80 C380,40 500,40 500,80 C500,130 380,130 380,80 Z M220,75 C240,65 360,65 380,75" fill="none" stroke="url(#frameGradient)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" filter="url(#dropShadow)" />
                  <path d="M105,80 C105,45 215,45 215,80 C215,125 105,125 105,80 Z" fill="url(#lensGradient)" />
                  <path d="M105,80 C105,45 215,45 215,80 C215,125 105,125 105,80 Z" fill="url(#lensShine)" />
                  <path d="M385,80 C385,45 495,45 495,80 C495,125 385,125 385,80 Z" fill="url(#lensGradient)" />
                  <path d="M385,80 C385,45 495,45 495,80 C495,125 385,125 385,80 Z" fill="url(#lensShine)" />
                  <motion.path d="M100,80 C100,40 220,40 220,80 C220,130 100,130 100,80 Z M380,80 C380,40 500,40 500,80 C500,130 380,130 380,80 Z M220,75 C240,65 360,65 380,75" fill="none" stroke="#4bc7c5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1.2, 0], opacity: [0, 1, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} filter="drop-shadow(0 0 8px #4bc7c5)" />
               </svg>

               <div className="absolute right-[15%] top-[68%] w-[110px] h-[70px] z-20">
                  <div className="absolute -top-6 left-1/2 w-[2px] h-6 bg-gradient-to-b from-[#4bc7c5] to-transparent opacity-60"></div>
                  <div className="w-full h-full bg-black/90 border border-[#4bc7c5]/40 rounded-lg overflow-hidden relative p-2 shadow-[0_0_20px_rgba(75,199,197,0.15)]">
                      <PulseWave />
                      <div className="absolute bottom-1 right-2 text-[9px] text-[#4bc7c5] font-mono flex items-center gap-1">
                        <Activity size={10} /> {pulseValue} Hz
                      </div>
                  </div>
               </div>
            </div>

            <div className="absolute bottom-6 w-full px-8 flex justify-between text-xs font-mono text-gray-500">
               <div>MODEL: OP-X1 PRO</div>
               <div>SN: 8823-11A</div>
            </div>
          </div>

          {/* Graph */}
          <div className="h-48 bg-[#111] rounded-3xl border border-[#333] p-6 flex items-center justify-between shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
             <div className="flex flex-col gap-3">
                <span className="text-sm text-gray-400 font-medium uppercase tracking-wider">Current Intensity</span>
                <div className="flex items-baseline gap-2">
                   <span className="text-4xl font-bold text-white font-mono">1.2</span>
                   <span className="text-lg text-[#4bc7c5] font-mono">mA</span>
                </div>
                <span className="text-xs text-emerald-500 flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full w-fit">
                   <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                   </span>
                   Optimal Range
                </span>
             </div>
             
             <div className="flex items-end gap-1 h-28 w-56 p-2 bg-[#0a0a0a] rounded-xl border border-[#222] inner-shadow">
                {[40, 65, 45, 75, 55, 85, 60, 95, 70, 50, 80, 60].map((h, i) => (
                   <motion.div key={i} className="flex-1 bg-[#222] rounded-t-sm relative overflow-hidden" animate={{ height: `${h}%` }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse", delay: i * 0.08, ease: "easeInOut" }}>
                     <div className="absolute bottom-0 w-full h-full bg-gradient-to-t from-[#4bc7c5] via-[#4bc7c5]/40 to-transparent"></div>
                   </motion.div>
                ))}
             </div>
          </div>

        </div>

        {/* Right Column: KPIs */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <KPICard icon={<Clock className="text-[#4bc7c5]" size={20} />} label="Session Duration" value={formatTime(sessionTime)} unit="MIN" active />
          <KPICard icon={<Zap className="text-yellow-400" size={20} />} label="Impulses Delivered" value={Math.floor(sessionTime / 2.5)} unit="COUNT" />
          <KPICard icon={<Activity className="text-rose-400" size={20} />} label="Skin Impedance" value={impedance} unit="kΩ" footer={<span className="text-xs text-gray-500">Good Contact</span>} />

          <div className="bg-[#151515] rounded-3xl border border-[#333] p-6 flex flex-col justify-between gap-6 shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
             <div>
                <h3 className="text-gray-400 text-sm mb-6 font-bold uppercase tracking-wider">DAILY GOAL</h3>
                <div className="relative w-48 h-48 mx-auto">
                   <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_10px_rgba(75,199,197,0.2)]">
                      <circle cx="96" cy="96" r="88" stroke="#222" strokeWidth="14" fill="none" />
                      <motion.circle cx="96" cy="96" r="88" stroke="url(#progressGradient)" strokeWidth="14" fill="none" strokeDasharray={2 * Math.PI * 88} strokeDashoffset={2 * Math.PI * 88} animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - 0.65) }} transition={{ duration: 2.5, ease: "easeOut", delay: 0.5 }} strokeLinecap="round" />
                      <defs>
                         <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#4bc7c5" />
                            <stop offset="100%" stopColor="#3baea2" />
                         </linearGradient>
                      </defs>
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-white">65<span className="text-2xl text-[#4bc7c5]">%</span></span>
                      <span className="text-xs text-gray-500 uppercase tracking-widest mt-1">COMPLETED</span>
                   </div>
                </div>
             </div>
             <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#4bc7c5] to-[#3baea2] hover:from-[#42b5b3] hover:to-[#359e93] text-black font-bold transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(75,199,197,0.4)]">
                PAUSE THERAPY
             </button>
          </div>
        </div>

      </main>

      {/* ===== AI Chat Widget ===== */}
      <AIChatWidget />
      
    </div>
  );
}

// --- Component: AI Chat Widget ---
function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: 'مرحباً أنا مساعد أوبتيفيو الطبي كيف يمكنني مساعدتك اليوم في رحلة علاجك؟' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const cleanText = (text: string) => {
    return text.replace(/[.,،!؟?]/g, '').trim();
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: cleanText(userMsg) }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let aiResponseRaw = "";
      
      if (userMsg.includes('شلل') || userMsg.includes('السابع')) {
        aiResponseRaw = "الشلل السابع هو ضعف مفاجئ في عضلات الوجه يجعل نصف الوجه يبدو مرتخياً تقنيتنا تساعد في استعادة النغمة العضلية عن طريق التحفيز الكهربائي الموجه";
      } else if (userMsg.includes('نظارة') || userMsg.includes('تعمل')) {
        aiResponseRaw = "تعمل النظارة عبر حساسات دقيقة تلتقط حركة العين السليمة وترسل إشارة فورية للجهة المصابة لعمل رمشة متزامن هذا يحمي العين من الجفاف ويعيد التناسق للوجه";
      } else {
        aiResponseRaw = "أنا هنا للإجابة على استفساراتك الطبية بخصوص الشلل الوجهي وآلية عمل نظارة أوبتيفيو هل لديك سؤال محدد حول جلسات العلاج";
      }

      const cleanResponse = cleanText(aiResponseRaw);
      
      setMessages(prev => [...prev, { role: 'ai', text: cleanResponse }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-[#4bc7c5] hover:bg-[#3baea2] text-black shadow-[0_0_20px_rgba(75,199,197,0.4)] transition-all transform hover:scale-110 flex items-center justify-center"
      >
        {isOpen ? <X size={28} strokeWidth={2.5} /> : <Bot size={28} strokeWidth={2.5} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-50 w-[350px] h-[500px] bg-[#0a0a0a]/95 backdrop-blur-xl border border-[#333] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-[#222] bg-[#111] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#4bc7c5]/20 flex items-center justify-center border border-[#4bc7c5]/30">
                <Bot className="text-[#4bc7c5]" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Optivio AI Assistant</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4bc7c5] animate-pulse"></span>
                  <span className="text-[10px] text-gray-400">Online | Medical Mode</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-[#333]">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-[#4bc7c5] text-black font-medium rounded-tr-none' 
                        : 'bg-[#1a1a1a] text-gray-200 border border-[#333] rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-2xl rounded-tl-none flex gap-1 items-center h-10">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-[#222] bg-[#111]">
              <div className="flex items-center gap-2 bg-[#050505] border border-[#333] rounded-full px-4 py-2 focus-within:border-[#4bc7c5] transition-colors">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="اسأل عن الشلل السابع..." 
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-gray-600"
                />
                <button 
                  onClick={handleSend}
                  className={`p-2 rounded-full transition-all ${input.trim() ? 'text-[#4bc7c5] hover:bg-[#4bc7c5]/10' : 'text-gray-600 cursor-not-allowed'}`}
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="text-[10px] text-center text-gray-600 mt-2">
                AI can make mistakes. Verify medical info.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// --- Sub Components ---

function KPICard({ icon, label, value, unit, active = false, footer }: any) {
   return (
      <div className={`p-6 rounded-3xl border transition-all duration-300 ${active ? 'bg-gradient-to-br from-[#4bc7c5]/20 to-[#151515] border-[#4bc7c5]/40 shadow-[0_0_30px_rgba(75,199,197,0.15)]' : 'bg-[#151515] border-[#333] hover:border-[#444] shadow-[0_5px_15px_rgba(0,0,0,0.3)]'}`}>
         <div className="flex items-center justify-between mb-3">
            <div className={`p-3 rounded-2xl ${active ? 'bg-[#4bc7c5]/20' : 'bg-[#222]'}`}>
               {icon}
            </div>
            {active && <span className="w-2.5 h-2.5 rounded-full bg-[#4bc7c5] animate-pulse shadow-[0_0_8px_#4bc7c5]"></span>}
         </div>
         <div className="text-xs text-gray-500 uppercase font-bold tracking-widest">{label}</div>
         <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">{value}</span>
            <span className="text-sm text-gray-400 font-mono font-medium">{unit}</span>
         </div>
         {footer && <div className="mt-3 pt-3 border-t border-[#222]">{footer}</div>}
      </div>
   );
}

function PulseWave() {
   return (
      <div className="flex items-center justify-between h-full w-full overflow-hidden px-1 gap-[1px]">
         {[...Array(24)].map((_, i) => (
            <motion.div
               key={i}
               className="w-[3px] bg-[#4bc7c5] rounded-full"
               animate={{ height: ["15%", "85%", "40%", "15%"], opacity: [0.4, 1, 0.6, 0.4], backgroundColor: ["#4bc7c5", "#86efac", "#4bc7c5"] }}
               transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.04, ease: "easeInOut" }}
            />
         ))}
      </div>
   );
}