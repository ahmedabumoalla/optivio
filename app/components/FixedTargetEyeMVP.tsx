'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { useRouter } from 'next/navigation';

// --- إعدادات وتعاريف ---
type Point = { x: number; y: number };

export default function OptivioPro() {
  const router = useRouter();
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
  const currentPosRef = useRef<Point>({ x: 0, y: 0 }); 

  // مراجع تقنية
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // ===== 1. تحميل موديل الذكاء الاصطناعي =====
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
        setStatusText('فشل تحميل الموديل.');
      }
    }
    loadModel();
  }, []);

  // ===== 2. تشغيل الكاميرا =====
  async function startCamera() {
    if (!landmarkerRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const video = videoRef.current!;
      video.srcObject = stream;
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

    const displayWidth = containerRef.current?.clientWidth || 640;
    const displayHeight = containerRef.current?.clientHeight || 480;
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (results && results.faceLandmarks.length > 0) {
      setFaceDetected(true);
      setStatusText('تم تحديد العصب الوجهي');
      
      const landmarks = results.faceLandmarks[0];
      
      // >>> التعديل هنا فقط: تغيير الرقم من 205 إلى 50 (نقطة أعلى أقرب للعين) <<<
      const target = landmarks[50]; 

      const videoW = videoSizeRef.current.w;
      const videoH = videoSizeRef.current.h;
      const scale = Math.max(displayWidth / videoW, displayHeight / videoH);
      const xOffset = (displayWidth - (videoW * scale)) / 2;
      const yOffset = (displayHeight - (videoH * scale)) / 2;

      const realX = ((1 - target.x) * videoW * scale) + xOffset;
      const realY = (target.y * videoH * scale) + yOffset;

      currentPosRef.current.x = lerp(currentPosRef.current.x, realX, 0.3);
      currentPosRef.current.y = lerp(currentPosRef.current.y, realY, 0.3);

      drawElectrode(ctx, currentPosRef.current.x, currentPosRef.current.y);
      
    } else {
      setFaceDetected(false);
      if (running) setStatusText('يرجى وضع الوجه أمام الكاميرا');
    }

    rafRef.current = requestAnimationFrame(predictLoop);
  }

  function lerp(start: number, end: number, amt: number) {
    return (1 - amt) * start + amt * end;
  }

  function drawElectrode(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const gradient = ctx.createRadialGradient(x, y, 5, x, y, 30);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.2, '#4bc7c5');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#4bc7c5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(75, 199, 197, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + 50, y);
    ctx.lineTo(x + 70, y - 20);
    ctx.stroke();
    ctx.fillStyle = '#4bc7c5';
    ctx.font = '12px monospace';
    ctx.fillText('NERVE TARGET LOCKED', x + 55, y - 25);
  }

  // ===== 4. وظائف جديدة (التقاط + تنقل) =====
  
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
    
    const video = videoRef.current;
    const overlayCanvas = canvasRef.current;
    
    const displayWidth = containerRef.current.clientWidth;
    const displayHeight = containerRef.current.clientHeight;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = displayWidth;
    tempCanvas.height = displayHeight;
    const ctx = tempCanvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      const scale = Math.max(displayWidth / videoW, displayHeight / videoH);
      const wScaled = videoW * scale;
      const hScaled = videoH * scale;
      
      ctx.save();
      ctx.translate(displayWidth / 2, displayHeight / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(video, -wScaled / 2, -hScaled / 2, wScaled, hScaled);
      ctx.restore();

      ctx.drawImage(overlayCanvas, 0, 0, displayWidth, displayHeight);
      
      const imageSrc = tempCanvas.toDataURL('image/png');
      
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = `optivio-scan-${Date.now()}.png`;
      link.click();
    }
  };

  const handleGoDashboard = () => {
    if (videoRef.current && videoRef.current.srcObject) {
       const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
       tracks.forEach(t => t.stop());
    }
    router.push('/dashboard');
  };

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
      
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', 
            transform: 'scaleX(-1)' 
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
        </div>
      )}

      {running && (
        <div style={{
          position: 'absolute',
          bottom: 30,
          left: 0, 
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
          zIndex: 15
        }}>
          <button 
            onClick={handleCapture}
            style={{
              width: 60, height: 60,
              borderRadius: '50%',
              background: 'transparent',
              border: '4px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fff' }} />
          </button>

          <button 
            onClick={handleGoDashboard}
            style={{
              position: 'absolute',
              right: 20,
              bottom: 10,
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid #4bc7c5',
              color: '#4bc7c5',
              padding: '10px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              backdropFilter: 'blur(4px)'
            }}
          >
            لوحة التحكم &rarr;
          </button>
        </div>
      )}

    </div>
  );
}