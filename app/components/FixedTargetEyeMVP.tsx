'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

type TargetPos = { xPct: number; yPct: number; rPx: number };
type CamFacing = 'user' | 'environment';

export default function FixedTargetEyeMVP() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [facingMode, setFacingMode] = useState<CamFacing>('user');

  // دائرة ثابتة على الشاشة (نسبياً)
  const [target, setTarget] = useState<TargetPos>({ xPct: 62, yPct: 42, rPx: 18 });
  const [editMode, setEditMode] = useState(true);

  const [faceDetected, setFaceDetected] = useState(false);
  const [fps, setFps] = useState(0);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  // نخزن آخر قياسات للستيج عشان الرسم يكون ثابت على كل الأجهزة
  const stageSizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });

  const styles = useMemo(() => {
    return {
      page: {
        minHeight: '100dvh',
        background: '#0b0f19',
        color: '#fff',
        display: 'flex',
        justifyContent: 'center',
        padding: 12,
      } as React.CSSProperties,

      shell: {
        width: 'min(980px, 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      } as React.CSSProperties,

      header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '12px 12px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.06)',
      } as React.CSSProperties,

      titleWrap: { display: 'flex', flexDirection: 'column', gap: 2 } as React.CSSProperties,
      title: { fontSize: 14, fontWeight: 800, letterSpacing: 0.2 } as React.CSSProperties,
      sub: { fontSize: 12, opacity: 0.8 } as React.CSSProperties,

      badge: (ok: boolean) =>
        ({
          padding: '7px 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${ok ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'}`,
          background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: ok ? '#86efac' : '#fca5a5',
          whiteSpace: 'nowrap',
        }) as React.CSSProperties,

      // layout: موبايل = عمود، ديسكتوب = صف
      main: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 10,
      } as React.CSSProperties,

      stage: {
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)',
        background: '#000',
        // موبايل: ارتفاع كبير عشان تجربة كاميرا حقيقية
        height: 'min(72dvh, 620px)',
      } as React.CSSProperties,

      video: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        // المرآة فقط للكاميرا الأمامية (user)
        transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
      } as React.CSSProperties,

      canvas: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      } as React.CSSProperties,

      controls: {
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.06)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      } as React.CSSProperties,

      row: { display: 'flex', gap: 8, flexWrap: 'wrap' } as React.CSSProperties,

      btn: (variant: 'primary' | 'ghost' | 'danger') =>
        ({
          padding: '10px 12px',
          borderRadius: 12,
          fontWeight: 800,
          fontSize: 13,
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.14)',
          background:
            variant === 'primary'
              ? 'rgba(255,255,255,0.14)'
              : variant === 'danger'
              ? 'rgba(239,68,68,0.18)'
              : 'transparent',
          color: '#fff',
          flex: '1 1 auto',
        }) as React.CSSProperties,

      chip: (active: boolean) =>
        ({
          padding: '9px 10px',
          borderRadius: 12,
          fontWeight: 800,
          fontSize: 12,
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.14)',
          background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
          color: '#fff',
        }) as React.CSSProperties,

      label: { fontSize: 12, opacity: 0.85, fontWeight: 700 } as React.CSSProperties,
      slider: { width: '100%' } as React.CSSProperties,

      note: {
        fontSize: 12,
        lineHeight: 1.6,
        opacity: 0.85,
        marginTop: 2,
      } as React.CSSProperties,

      err: { color: '#fecaca', fontSize: 12, lineHeight: 1.6 } as React.CSSProperties,

      footer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        opacity: 0.85,
        padding: '0 4px',
      } as React.CSSProperties,

      // desktop تحسين: صف عمودين
      desktopGrid: {
        gridTemplateColumns: '1.6fr 1fr',
        alignItems: 'start',
      } as React.CSSProperties,
    };
  }, [facingMode]);

  // ===== Helpers: ResizeObserver لضبط أبعاد الكانفس بدقة =====
  useEffect(() => {
    if (!stageRef.current) return;

    const ro = new ResizeObserver(() => {
      const el = stageRef.current!;
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      stageSizeRef.current = { w: rect.width, h: rect.height, dpr };
      // ارسم فورًا بعد أي resize
      if (running) drawFixedTarget();
    });

    ro.observe(stageRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // ===== Start / Stop =====
  async function start() {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('المتصفح لا يدعم تشغيل الكاميرا.');
      return;
    }

    try {
      // شغّل الكاميرا
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode }, // user أو environment
        audio: false,
      });

      const video = videoRef.current!;
      video.srcObject = stream;

      // مهم للجوال (خصوصًا iOS)
      video.muted = true;
      video.playsInline = true;

      await video.play();

      // جهز FaceLandmarker (مؤشر فقط)
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

  // ===== الرسم: دائرة ثابتة على الشاشة =====
  function drawFixedTarget() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { w, h, dpr } = stageSizeRef.current;
    if (!w || !h) return;

    // ضبط كانفس فعلي (مهم للجوال)
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ارسم بوحدات CSS px
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = (target.xPct / 100) * w;
    const cy = (target.yPct / 100) * h;

    // Glow
    ctx.beginPath();
    ctx.arc(cx, cy, target.rPx + 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,0,0,0.12)';
    ctx.fill();

    // Ring
    ctx.beginPath();
    ctx.arc(cx, cy, target.rPx, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 60, 60, 0.95)';
    ctx.fill();
  }

  // ===== Loop =====
  let lastT = 0;
  let frames = 0;

  function loop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker) return;

    const now = performance.now();
    const res: FaceLandmarkerResult = landmarker.detectForVideo(video, now);

    setFaceDetected((res.faceLandmarks?.length ?? 0) > 0);

    frames += 1;
    if (now - lastT > 500) {
      setFps(Math.round((frames * 1000) / (now - lastT)));
      frames = 0;
      lastT = now;
    }

    drawFixedTarget();

    if (running) rafRef.current = requestAnimationFrame(loop);
  }

  // إعادة رسم عند تغير الإعدادات
  useEffect(() => {
    if (!running) return;
    drawFixedTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.xPct, target.yPct, target.rPx, running]);

  // تغيير الكاميرا: لازم نوقف ونشغل من جديد
  useEffect(() => {
    if (!running) return;
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ميديا كويري بسيط بدون CSS خارجي: نحدد “desktop”
  const isDesktop =
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 900px)').matches;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.header}>
          <div style={styles.titleWrap}>
            <div style={styles.title}>Optivio MVP — Live Camera + Fixed Eye Target</div>
            <div style={styles.sub}>
              Fixed target (screen-locked) + Face detection indicator · Mobile-ready
            </div>
          </div>
          <div style={styles.badge(faceDetected)}>{running ? (faceDetected ? 'Face detected' : 'No face') : 'Stopped'}</div>
        </div>

        <div style={{ ...styles.main, ...(isDesktop ? styles.desktopGrid : {}) }}>
          <div ref={stageRef} style={styles.stage}>
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
                <button style={styles.btn('danger')} onClick={stop}>
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

            {/* اختيار الكاميرا */}
            <div style={styles.row}>
              <button
                style={styles.chip(facingMode === 'user')}
                onClick={() => setFacingMode('user')}
                disabled={running}
                title={running ? 'أوقف الكاميرا ثم بدّل' : ''}
              >
                كاميرا أمامية
              </button>
              <button
                style={styles.chip(facingMode === 'environment')}
                onClick={() => setFacingMode('environment')}
                disabled={running}
                title={running ? 'أوقف الكاميرا ثم بدّل' : ''}
              >
                كاميرا خلفية
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
                min={10}
                max={48}
                value={target.rPx}
                onChange={(e) => editMode && setTarget((t) => ({ ...t, rPx: Number(e.target.value) }))}
                disabled={!running || !editMode}
              />
            </div>

            {error && <div style={styles.err}>{error}</div>}

            <div style={styles.note}>
              ✅ الدائرة ثابتة على الشاشة (Screen-fixed) لتعطي إحساس “تحديد موضع”.<br />
              ✅ تشتغل على الجوال + فيرسال (HTTPS).<br />
              ⚠ إذا كنت على iPhone: افتح من Safari/Chrome على iOS واسمح بالوصول للكاميرا.
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <div>
            <span style={{ opacity: 0.75 }}>FPS:</span> {fps} &nbsp;·&nbsp;{' '}
            <span style={{ opacity: 0.75 }}>Mode:</span> {editMode ? 'Edit' : 'Locked'}
          </div>
          <div style={{ opacity: 0.75 }}>Next.js (app/) + MediaPipe Tasks Vision</div>
        </div>
      </div>
    </div>
  );
}
