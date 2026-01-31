'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// --- إعدادات وتعاريف ---
type Point = { x: number; y: number };

export default function OptivioPro() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // حالة النظام
  const [modelLoaded, setModelLoaded] = useState(false);
  const [statusText, setStatusText] = useState('جاري تحميل الذكاء الاصطناعي...');
  const [running, setRunning] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  
  // تتبع النقطة
  const [targetPoint, setTargetPoint] = useState<Point>({ x: 0, y: 0 });
  const currentPosRef = useRef<Point>({ x: 0, y: 0 }); // للتنعيم الحركي

  // مراجع تقنية
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // ===== 1. تحميل موديل الذكاء الاصطناعي فور فتح الصفحة =====
  useEffect(() => {
    async function loadModel() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1
        });

        setModelLoaded(true);
        setStatusText('النظام جاهز. اضغط تشغيل.');
      } catch (err) {
        console.error(err);
        setStatusText('فشل تحميل الموديل. تأكد من الإنترنت.');
      }
    }
    loadModel();
  }, []);

  // ===== 2. تشغيل الكاميرا =====
  async function startCamera() {
    if (!landmarkerRef.current) return;

    try {
      // طلب الكاميرا الأمامية
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const video = videoRef.current!;
      video.srcObject = stream;
      
      // انتظار حتى تبدأ الكاميرا بالعمل فعلياً لنعرف أبعادها الحقيقية
      video.onloadedmetadata = () => {
        video.play();
        videoSizeRef.current = { w: video.videoWidth, h: video.videoHeight };
        setRunning(true);
        setStatusText('جاري المسح...');
        predictLoop();
      };

    } catch (err) {
      console.error(err);
      setStatusText('يرجى السماح للكاميرا بالعمل.');
    }
  }

  // ===== 3. حلقة التحليل (The Loop) =====
  function predictLoop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !landmarker || !canvas) return;

    const startTimeMs = performance.now();
    let results: FaceLandmarkerResult | null = null;

    if (video.currentTime > 0 && !video.paused) {
      results = landmarker.detectForVideo(video, startTimeMs);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ضبط حجم الكانفس ليطابق حجم العرض (Responsive)
    const displayWidth = containerRef.current?.clientWidth || 640;
    const displayHeight = containerRef.current?.clientHeight || 480;
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (results && results.faceLandmarks.length > 0) {
      setFaceDetected(true);
      setStatusText('تم تحديد العصب الوجهي');
      
      const landmarks = results.faceLandmarks[0];
      // النقطة 205 (Zygomatic) أو 101 أو 50
      const target = landmarks[205]; 

      // --- الخوارزمية الحرجة: تحويل إحداثيات الفيديو إلى إحداثيات الشاشة ---
      // (Mapping Logic for object-fit: cover)
      const videoW = videoSizeRef.current.w;
      const videoH = videoSizeRef.current.h;
      
      // 1. حساب نسبة التغطية (Cover Scale)
      const scale = Math.max(displayWidth / videoW, displayHeight / videoH);
      
      // 2. حساب الإزاحة (Offset) لتوسيط الفيديو
      const xOffset = (displayWidth - (videoW * scale)) / 2;
      const yOffset = (displayHeight - (videoH * scale)) / 2;

      // 3. تطبيق المعادلة: (النقطة * العرض الأصلي * التكبير) + الإزاحة
      // ملاحظة: نعكس X لأن الكاميرا الأمامية معكوسة (Mirrored)
      const realX = ((1 - target.x) * videoW * scale) + xOffset;
      const realY = (target.y * videoH * scale) + yOffset;

      // التنعيم الحركي (Lerp)
      currentPosRef.current.x = lerp(currentPosRef.current.x, realX, 0.3);
      currentPosRef.current.y = lerp(currentPosRef.current.y, realY, 0.3);

      drawElectrode(ctx, currentPosRef.current.x, currentPosRef.current.y);
      
    } else {
      setFaceDetected(false);
      if (running) setStatusText('يرجى وضع الوجه أمام الكاميرا');
    }

    rafRef.current = requestAnimationFrame(predictLoop);
  }

  // دالة التنعيم
  function lerp(start: number, end: number, amt: number) {
    return (1 - amt) * start + amt * end;
  }

  // رسم القطب
  function drawElectrode(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Glow
    const gradient = ctx.createRadialGradient(x, y, 5, x, y, 30);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.2, '#4bc7c5');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, 2 * Math.PI);
    ctx.fill();

    // Core
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fill();

    // Ring
    ctx.strokeStyle = '#4bc7c5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.stroke();

    // Connecting Line Simulation
    ctx.strokeStyle = 'rgba(75, 199, 197, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + 50, y);
    ctx.lineTo(x + 70, y - 20);
    ctx.stroke();
    
    // Data Text
    ctx.fillStyle = '#4bc7c5';
    ctx.font = '12px monospace';
    ctx.fillText('NERVE TARGET LOCKED', x + 55, y - 25);
  }

  return (
    <div style={{ 
      position: 'relative', 
      width: '100vw', 
      height: '100dvh', 
      background: '#000', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif'
    }}>
      
      {/* Container - Full Screen */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', // يملأ الشاشة بالكامل
            transform: 'scaleX(-1)' // وضع المرآة
          }} 
        />
        <canvas 
          ref={canvasRef} 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%',
            pointerEvents: 'none'
          }} 
        />
      </div>

      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: 20, left: 20, right: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{ color: '#fff', fontWeight: 'bold' }}>Optivio AI</div>
        <div style={{ 
          background: faceDetected ? 'rgba(75, 199, 197, 0.2)' : 'rgba(255, 0, 0, 0.2)',
          border: `1px solid ${faceDetected ? '#4bc7c5' : 'red'}`,
          color: faceDetected ? '#4bc7c5' : 'red',
          padding: '5px 10px',
          borderRadius: 12,
          fontSize: '12px'
        }}>
          {statusText}
        </div>
      </div>

      {/* Start Button Overlay */}
      {!running && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20
        }}>
          <h2 style={{ color: '#4bc7c5', marginBottom: 20 }}>Optivio Therapy</h2>
          {modelLoaded ? (
            <button 
              onClick={startCamera}
              style={{
                background: '#4bc7c5',
                color: '#000',
                border: 'none',
                padding: '15px 40px',
                fontSize: '18px',
                fontWeight: 'bold',
                borderRadius: '30px',
                cursor: 'pointer'
              }}
            >
              ابدأ التشخيص
            </button>
          ) : (
            <div style={{ color: '#fff' }}>جاري تهيئة الذكاء الاصطناعي...</div>
          )}
          <p style={{ color: '#888', marginTop: 20, fontSize: 12, maxWidth: 300, textAlign: 'center' }}>
            نستخدم تقنية Face Mesh عالية الدقة. يرجى السماح للكاميرا والانتظار قليلاً.
          </p>
        </div>
      )}
    </div>
  );
}