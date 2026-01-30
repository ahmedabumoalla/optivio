'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

type TargetPos = { xPct: number; yPct: number; rPx: number };

export default function FixedTargetEyeMVP() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // “ثابتة” على الشاشة — تتحكم فيها كنسبة من عرض/ارتفاع الكادر
  const [target, setTarget] = useState<TargetPos>({ xPct: 62, yPct: 42, rPx: 18 });

  // لو false: نخلي الدائرة "مقفولة" بدون سحب/تعديل
  const [editMode, setEditMode] = useState(true);

  const [faceDetected, setFaceDetected] = useState(false);
  const [fps, setFps] = useState(0);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  const styles = useMemo(() => {
    return {
      wrap: {
        minHeight: '100vh',
        background: '#0b0f19',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      } as React.CSSProperties,
      card: {
        width: 'min(980px, 100%)',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
      } as React.CSSProperties,
      header: {
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.10)',
      } as React.CSSProperties,
      title: { fontSize: 16, fontWeight: 700 } as React.CSSProperties,
      badge: (ok: boolean) =>
        ({
          padding: '6px 10px',
          borderRadius: 999,
          fontSize: 12,
          border: `1px solid ${ok ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'}`,
          background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: ok ? '#86efac' : '#fca5a5',
          whiteSpace: 'nowrap',
        }) as React.CSSProperties,
      body: {
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr',
        gap: 0,
      } as React.CSSProperties,
      stage: {
        position: 'relative',
        background: '#000',
        aspectRatio: '16/9',
      } as React.CSSProperties,
      video: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)', // مرآة
      } as React.CSSProperties,
      canvas: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      } as React.CSSProperties,
      controls: {
        padding: 16,
        background: 'rgba(255,255,255,0.04)',
        borderLeft: '1px solid rgba(255,255,255,0.10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      } as React.CSSProperties,
      row: { display: 'flex', gap: 10, flexWrap: 'wrap' } as React.CSSProperties,
      btn: (variant: 'primary' | 'ghost') =>
        ({
          padding: '10px 12px',
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.14)',
          background: variant === 'primary' ? 'rgba(255,255,255,0.14)' : 'transparent',
          color: '#fff',
        }) as React.CSSProperties,
      label: { fontSize: 12, opacity: 0.85 } as React.CSSProperties,
      slider: { width: '100%' } as React.CSSProperties,
      note: {
        fontSize: 12,
        lineHeight: 1.6,
        opacity: 0.85,
        marginTop: 6,
      } as React.CSSProperties,
      footer: {
        padding: '10px 16px',
        borderTop: '1px solid rgba(255,255,255,0.10)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        opacity: 0.9,
      } as React.CSSProperties,
      small: { opacity: 0.75 } as React.CSSProperties,
    };
  }, []);

  async function start() {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('المتصفح لا يدعم تشغيل الكاميرا.');
      return;
    }

    try {
      // 1) شغّل الكاميرا
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // 2) جهّز FaceLandmarker (للتحقق من وجود وجه/عينين فقط)
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      setRunning(true);
      loop();
    } catch (e: any) {
      setError(e?.message ?? 'فشل تشغيل الكاميرا.');
    }
  }

  function stop() {
    setRunning(false);
    setFaceDetected(false);
    setFps(0);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const video = videoRef.current;
    if (video?.srcObject) {
      const tracks = (video.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      video.srcObject = null;
    }

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    // نظّف الكانفس
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawFixedTarget() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // اضبط أبعاد الكانفس حسب عرض العنصر
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // دائرة ثابتة على الشاشة (لا تتبع الوجه)
    const cx = (target.xPct / 100) * rect.width;
    const cy = (target.yPct / 100) * rect.height;

    // Glow خفيف + دائرة
    ctx.beginPath();
    ctx.arc(cx, cy, target.rPx + 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,0,0,0.10)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, target.rPx, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // نقطة مركزية صغيرة
    ctx.beginPath();
    ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 60, 60, 0.95)';
    ctx.fill();
  }

  let lastT = 0;
  let frames = 0;

  function loop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker) return;

    const now = performance.now();
    const res: FaceLandmarkerResult = landmarker.detectForVideo(video, now);

    setFaceDetected((res.faceLandmarks?.length ?? 0) > 0);

    // FPS بسيط
    frames += 1;
    if (now - lastT > 500) {
      setFps(Math.round((frames * 1000) / (now - lastT)));
      frames = 0;
      lastT = now;
    }

    // ارسم الدائرة الثابتة كل فريم
    drawFixedTarget();

    if (running) rafRef.current = requestAnimationFrame(loop);
  }

  // إعادة رسم الدائرة عند تغيير السلايدرز حتى لو توقفت الحلقة
  useEffect(() => {
    if (!running) return;
    drawFixedTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.xPct, target.yPct, target.rPx, running]);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.title}>Eye Placement MVP — Live Camera + Fixed Target</div>
          <div style={styles.badge(faceDetected)}>
            {running ? (faceDetected ? 'Face detected' : 'No face') : 'Stopped'}
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.stage}>
            <video ref={videoRef} playsInline muted style={styles.video} />
            <canvas ref={canvasRef} style={styles.canvas} />
          </div>

          <div style={styles.controls}>
            <div style={styles.row}>
              {!running ? (
                <button style={styles.btn('primary')} onClick={start}>
                  تشغيل الكاميرا
                </button>
              ) : (
                <button style={styles.btn('primary')} onClick={stop}>
                  إيقاف
                </button>
              )}
              <button
                style={styles.btn('ghost')}
                onClick={() => setEditMode((v) => !v)}
                disabled={!running}
                title={!running ? 'شغّل الكاميرا أولاً' : ''}
              >
                {editMode ? 'قفل الموضع' : 'تعديل الموضع'}
              </button>
            </div>

            <div>
              <div style={styles.label}>Target X (٪ من عرض الشاشة): {target.xPct}</div>
              <input
                style={styles.slider}
                type="range"
                min={0}
                max={100}
                value={target.xPct}
                onChange={(e) => editMode && setTarget((t) => ({ ...t, xPct: Number(e.target.value) }))}
                disabled={!running || !editMode}
              />
            </div>

            <div>
              <div style={styles.label}>Target Y (٪ من ارتفاع الشاشة): {target.yPct}</div>
              <input
                style={styles.slider}
                type="range"
                min={0}
                max={100}
                value={target.yPct}
                onChange={(e) => editMode && setTarget((t) => ({ ...t, yPct: Number(e.target.value) }))}
                disabled={!running || !editMode}
              />
            </div>

            <div>
              <div style={styles.label}>Radius (px): {target.rPx}</div>
              <input
                style={styles.slider}
                type="range"
                min={8}
                max={40}
                value={target.rPx}
                onChange={(e) => editMode && setTarget((t) => ({ ...t, rPx: Number(e.target.value) }))}
                disabled={!running || !editMode}
              />
            </div>

            {error && (
              <div style={{ color: '#fecaca', fontSize: 12, lineHeight: 1.6 }}>
                {error}
              </div>
            )}

            <div style={styles.note}>
              ✅ الدائرة **ثابتة على الشاشة** (Screen-fixed) لتعطي إحساس “تحديد موضع”.<br />
              ✅ الذكاء هنا فقط لإظهار حالة “Face detected” وليس لتحريك الدائرة.<br />
              ⚠ للاختبار الأفضل استخدم HTTPS أو localhost للسماح بالكاميرا.
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <div>
            <span style={styles.small}>FPS:</span> {fps} &nbsp;·&nbsp;{' '}
            <span style={styles.small}>Mode:</span> {editMode ? 'Edit' : 'Locked'}
          </div>
          <div style={styles.small}>Next.js (app/) + MediaPipe Tasks Vision</div>
        </div>
      </div>
    </div>
  );
}
