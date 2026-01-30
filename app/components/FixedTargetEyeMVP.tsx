'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

/**
 * زاوية العين الخارجية
 * تمثل أقرب نقطة عملية لعضلة orbicularis oculi
 */
const RIGHT_EYE_OUTER = 263;

export default function FixedTargetEyeMVP() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  // حالة التشغيل
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  // إزاحة عضلية حقيقية (نسبة من حجم الوجه)
  const muscleOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  // حجم المسرح
  const stageSizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  /* =========================
     تشغيل الكاميرا
  ========================= */
  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });

    const video = videoRef.current!;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    setRunning(true);
    loop();
  }

  function stop() {
    setRunning(false);
    setFaceDetected(false);
    muscleOffsetRef.current = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current)
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  /* =========================
     حلقة المعالجة
  ========================= */
  function loop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    const res = landmarker.detectForVideo(video, performance.now());
    drawAnchoredTarget(res);

    if (running) rafRef.current = requestAnimationFrame(loop);
  }

  /* =========================
     منطق الربط العضلي الحقيقي
  ========================= */
  function drawAnchoredTarget(res: FaceLandmarkerResult) {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const faces = res.faceLandmarks;
    if (!faces || faces.length === 0) {
      setFaceDetected(false);
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    setFaceDetected(true);

    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const lm = faces[0];
    const eye = lm[RIGHT_EYE_OUTER];

    // موقع العين الحقيقي
    const eyeX = eye.x * rect.width;
    const eyeY = eye.y * rect.height;

    // عند القفل: نحسب الإزاحة كنسبة من الوجه
    if (locked && !muscleOffsetRef.current) {
      muscleOffsetRef.current = {
        dx: 0.06 * rect.width,  // أمام العين
        dy: 0.02 * rect.height, // أسفل بسيط
      };
    }

    if (!muscleOffsetRef.current) return;

    const cx = eyeX + muscleOffsetRef.current.dx;
    const cy = eyeY + muscleOffsetRef.current.dy;

    // رسم النقطة
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();
  }

  useEffect(() => {
    return () => stop();
  }, []);

  /* =========================
     الواجهة
  ========================= */
  return (
    <div style={{ background: '#000', minHeight: '100vh', padding: 12 }}>
      <div
        ref={stageRef}
        style={{
          position: 'relative',
          height: '70vh',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {!running ? (
          <button onClick={start}>تشغيل الكاميرا</button>
        ) : (
          <button onClick={stop}>إيقاف</button>
        )}

        <button
          onClick={() => {
            setLocked(v => !v);
            if (!locked) muscleOffsetRef.current = null;
          }}
          disabled={!running}
        >
          {locked ? 'إعادة المعايرة' : 'قفل النقطة العضلية'}
        </button>
      </div>

      <div style={{ color: faceDetected ? '#4ade80' : '#f87171', marginTop: 6 }}>
        {faceDetected ? 'Face detected' : 'No face'}
      </div>
    </div>
  );
}
