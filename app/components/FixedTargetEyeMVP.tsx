'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

type CamFacing = 'user' | 'environment';

// إحداثيات النقطة (للتنعيم الحركي)
type Point = { x: number; y: number };

export default function OptivioSmartTherapy() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [facingMode, setFacingMode] = useState<CamFacing>('user');
  const [faceDetected, setFaceDetected] = useState(false);
  
  // حالة لمحاكاة "جودة الاتصال" بالقطب الكهربائي
  const [connectionQuality, setConnectionQuality] = useState(0); 

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const stageSizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });
  
  // تخزين الموقع الحالي للنقطة لعمل نعومة (Interpolation)
  const currentPosRef = useRef<Point>({ x: 0, y: 0 });

  // ===== Styles =====
  const styles = useMemo(() => {
    return {
      page: {
        minHeight: '100dvh',
        background: '#050505', // لون داكن جداً ليعطي طابع طبي/تقني
        color: '#e0e0e0',
        display: 'flex',
        justifyContent: 'center',
        padding: 12,
        fontFamily: 'Inter, sans-serif',
      } as React.CSSProperties,

      shell: {
        width: 'min(980px, 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      } as React.CSSProperties,

      header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderRadius: 16,
        background: 'linear-gradient(90deg, #111 0%, #1a1a1a 100%)',
        border: '1px solid #333',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      } as React.CSSProperties,

      title: { fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 0.5 } as React.CSSProperties,
      sub: { fontSize: 12, color: '#888', marginTop: 4 } as React.CSSProperties,

      statusBadge: (active: boolean) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 20,
        background: active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        border: `1px solid ${active ? '#10b981' : '#ef4444'}`,
        color: active ? '#10b981' : '#ef4444',
        fontSize: 12,
        fontWeight: 600,
      }) as React.CSSProperties,

      main: {
        position: 'relative',
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid #333',
        background: '#000',
        height: 'min(75dvh, 650px)', // مساحة عرض كبيرة
        boxShadow: '0 0 40px rgba(75, 199, 197, 0.05)', // وهج خفيف بلون البراند
      } as React.CSSProperties,

      video: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
        opacity: running ? 1 : 0.3,
        transition: 'opacity 0.5s',
      } as React.CSSProperties,

      canvas: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      } as React.CSSProperties,

      // واجهة البيانات فوق الفيديو (Overlay HUD)
      hudContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        bottom: 20,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      } as React.CSSProperties,

      hudBox: {
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        padding: 12,
        borderRadius: 8,
        borderLeft: '3px solid #4bc7c5',
        color: '#4bc7c5',
        fontSize: 12,
        fontFamily: 'monospace',
      } as React.CSSProperties,

      startButtonContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      } as React.CSSProperties,

      btn: {
        padding: '16px 32px',
        borderRadius: 50,
        background: 'linear-gradient(135deg, #4bc7c5 0%, #0e908e 100%)',
        border: 'none',
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 0 20px rgba(75, 199, 197, 0.4)',
        transition: 'transform 0.2s',
      } as React.CSSProperties,
    };
  }, [facingMode, running]);

  // ===== تهيئة MediaPipe =====
  useEffect(() => {
    // مراقب الحجم
    if (!stageRef.current) return;
    const ro = new ResizeObserver(() => {
      const el = stageRef.current!;
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      stageSizeRef.current = { w: rect.width, h: rect.height, dpr };
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API not supported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: 1280, height: 720 },
        audio: false,
      });

      const video = videoRef.current!;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      // إعداد نموذج الذكاء الاصطناعي
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU', // استخدام كرت الشاشة للأداء العالي
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      setRunning(true);
      loop();
    } catch (e: any) {
      setError('يرجى السماح بالوصول للكاميرا لتشغيل النظام.');
    }
  }

  // ===== خوارزمية التنعيم (Linear Interpolation) =====
  // هذه الدالة السحرية التي تجعل الحركة ناعمة وواقعية
  function lerp(start: number, end: number, factor: number) {
    return start + (end - start) * factor;
  }

  function loop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);

    // التحقق من وجود وجه
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      setFaceDetected(true);
      // زيادة مؤشر جودة الاتصال تدريجياً عند اكتشاف الوجه
      setConnectionQuality(prev => Math.min(prev + 2, 100));
      
      drawSmartElectrode(result);
    } else {
      setFaceDetected(false);
      setConnectionQuality(prev => Math.max(prev - 5, 0));
      drawScanningMode(); // رسم وضع البحث إذا لم يوجد وجه
    }

    if (running) rafRef.current = requestAnimationFrame(loop);
  }

  // ===== رسم القطب الذكي العلاجي =====
  function drawSmartElectrode(result: FaceLandmarkerResult) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { w, h, dpr } = stageSizeRef.current;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // إعدادات الرسم عالية الدقة
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const landmarks = result.faceLandmarks[0];

    // --- تحديد النقطة العضلية المستهدفة ---
    // Landmark 205: نقطة استراتيجية على الوجنة (Cheek) قريبة من مسار العصب
    // Landmark 50: بديل (تحت العين مباشرة)
    // نستخدم هنا 205 لأنها منطقة عضلية جيدة للصق
    const targetLandmark = landmarks[205]; 

    // حساب الإحداثيات بالنسبة للشاشة
    // ملاحظة: إذا كانت الكاميرا معكوسة (User)، نعكس الإحداثي السيني
    let targetX = targetLandmark.x * w;
    if (facingMode === 'user') {
      targetX = (1 - targetLandmark.x) * w; 
    }
    const targetY = targetLandmark.y * h;

    // --- تطبيق التنعيم (Smoothing) ---
    // نقرب الموقع الحالي من الموقع الجديد بنسبة 20% كل فريم
    // هذا يلغي الرعشة ويجعل اللاصق يبدو كأنه "ملتصق" بالجلد بوزن فيزيائي
    currentPosRef.current.x = lerp(currentPosRef.current.x, targetX, 0.25);
    currentPosRef.current.y = lerp(currentPosRef.current.y, targetY, 0.25);

    const x = currentPosRef.current.x;
    const y = currentPosRef.current.y;

    // --- رسم الواجهة الطبية (Sci-Fi Medical UI) ---

    // 1. دائرة التثبيت الخارجية (Lock Ring) - تدور
    const time = performance.now() / 300;
    ctx.beginPath();
    ctx.arc(x, y, 28, time, time + Math.PI * 1.5);
    ctx.strokeStyle = 'rgba(75, 199, 197, 0.6)'; // لون البراند (#4bc7c5)
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. القطب الكهربائي نفسه (Glow effect)
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, 15);
    gradient.addColorStop(0, '#fff'); // قلب أبيض
    gradient.addColorStop(0.4, '#4bc7c5'); // منتصف تركوازي
    gradient.addColorStop(1, 'rgba(75, 199, 197, 0)'); // تلاشي

    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. تأثير النبضات الكهربائية (Electric Pulse Simulation)
    // نبض عشوائي بسيط لمحاكاة العلاج
    if (Math.random() > 0.85) {
        ctx.beginPath();
        ctx.arc(x, y, 35 + Math.random() * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // 4. خطوط الربط (Data Lines)
    // خط يربط القطب ببيانات التحليل على الجانب
    ctx.beginPath();
    ctx.moveTo(x + 30, y);
    ctx.lineTo(x + 60, y);
    ctx.lineTo(x + 75, y - 15); // زاوية تقنية
    ctx.strokeStyle = 'rgba(75, 199, 197, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // نص البيانات بجانب النقطة
    ctx.fillStyle = '#4bc7c5';
    ctx.font = '10px monospace';
    ctx.fillText(`ZYG-MAJOR: ${Math.round(connectionQuality)}%`, x + 80, y - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`IMPEDANCE: 2.4kΩ`, x + 80, y);
  }

  // ===== رسم وضع المسح (عند عدم وجود وجه) =====
  function drawScanningMode() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, dpr } = stageSizeRef.current;

    // مسح الكانفس
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.scale(dpr, dpr);

    // رسم مربع مسح متحرك
    const time = performance.now() / 1000;
    const scanY = (time % 2) * (h / 2) + (h / 4); // يتحرك في المنتصف

    ctx.beginPath();
    ctx.moveTo(w * 0.2, scanY);
    ctx.lineTo(w * 0.8, scanY);
    ctx.strokeStyle = 'rgba(75, 199, 197, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(75, 199, 197, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('INITIALIZING SENSOR...', w / 2, h / 2);
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Optivio — Neural Therapy Interface</div>
            <div style={styles.sub}>AI-Driven Facial Nerve Rehabilitation System</div>
          </div>
          <div style={styles.statusBadge(faceDetected)}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: faceDetected ? '#10b981' : '#ef4444' }} />
            {running ? (faceDetected ? 'TARGET LOCKED' : 'SEARCHING...') : 'STANDBY'}
          </div>
        </div>

        {/* Main Stage */}
        <div ref={stageRef} style={styles.main}>
          <video ref={videoRef} playsInline muted style={styles.video} />
          <canvas ref={canvasRef} style={styles.canvas} />

          {/* زر التشغيل الكبير في المنتصف إذا لم يعمل بعد */}
          {!running && (
            <div style={styles.startButtonContainer}>
              <button style={styles.btn} onClick={start}>
                START THERAPY SESSION
              </button>
            </div>
          )}

          {/* HUD Overlay - يظهر فقط عند التشغيل */}
          {running && (
            <div style={styles.hudContainer}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={styles.hudBox}>
                  SYS: ONLINE<br/>
                  CAM: {facingMode.toUpperCase()}<br/>
                  AI: MEDIAPIPE MESH
                </div>
                <div style={{ ...styles.hudBox, borderLeft: 'none', borderRight: '3px solid #4bc7c5', textAlign: 'right' }}>
                  BATTERY: 98%<br/>
                  STIMULATION: OFF<br/>
                  SESSION: 00:00
                </div>
              </div>

              {/* تحذير في الأسفل */}
              <div style={{ textAlign: 'center', opacity: 0.7, fontSize: 10, color: '#4bc7c5' }}>
                 ALIGN FACE WITH CAMERA FOR MOTOR POINT DETECTION
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}