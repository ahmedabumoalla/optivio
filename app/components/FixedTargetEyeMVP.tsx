'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

/**
 * MediaPipe Face Landmarks (شائعة الاستخدام)
 * زاوية العين الخارجية ≈ أقرب تمثيل عملي لموضع تحفيز orbicularis oculi
 */
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

type TargetPos = { xPct: number; yPct: number; rPx: number };
type CamFacing = 'user' | 'environment';

export default function FixedTargetEyeMVP() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [facingMode, setFacingMode] = useState<CamFacing>('user');

  // نقطة المعايرة الأولية (للضبط اليدوي قبل القفل)
  const [target, setTarget] = useState<TargetPos>({ xPct: 62, yPct: 42, rPx: 18 });

  // قفل المعايرة
  const [locked, setLocked] = useState(false);

  const [faceDetected, setFaceDetected] = useState(false);
  const [fps, setFps] = useState(0);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  // أي عين نستخدم
  const eyeSideRef = useRef<'left' | 'right'>('right');

  // offset بين العين والنقطة (يُحسب وقت القفل)
  const offsetRef = useRef<{ dx: number; dy: number } | null>(null);

  // قياسات المسرح للرسم الدقيق على الجوال
  const stageSizeRef = useRef<{ w: number; h: number; dpr: number }>({
    w: 0,
    h: 0,
    dpr: 1,
  });

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
        padding: 12,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.06)',
      } as React.CSSProperties,

      title: { fontSize: 14, fontWeight: 800 } as React.CSSProperties,

      badge: (ok: boolean) =>
        ({
          padding: '6px 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${ok ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'}`,
          background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: ok ? '#86efac' : '#fca5a5',
        }) as React.CSSProperties,

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
        height: 'min(72dvh, 620px)',
      } as React.CSSProperties,

      video: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
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

      label: { fontSize: 12, opacity: 0.85, fontWeight: 700 } as React.CSSProperties,
      slider: { width: '100%' } as React.CSSProperties,

      note: { fontSize: 12, opacity: 0.85, lineHeight: 1.6 } as React.CSSProperties,
      err: { color: '#fecaca', fontSize: 12 } as React.CSSProperties,

      footer: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        opacity: 0.8,
        padding: '0 4px',
      } as React.CSSProperties,
    };
  }, [facingMode]);

  // ===== ResizeObserver =====
  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver(() => {
      const rect = stageRef.current!.getBoundingClientRect();
      stageSizeRef.current = {
        w: rect.width,
        h: rect.height,
        dpr: window.devicePixelRatio || 1,
      };
      if (running) drawAnchoredTarget(lastResultRef.current);
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [running]);

  // ===== Start / Stop =====
  async function start() {
    setError(null);
    offsetRef.current = null;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
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
    setFps(0);
    offsetRef.current = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  }

  // ===== رسم النقطة المرتبطة بالوجه =====
  const lastResultRef = useRef<FaceLandmarkerResult | null>(null);

  function drawAnchoredTarget(res: FaceLandmarkerResult | null) {
    const canvas = canvasRef.current;
    if (!canvas || !res) return;

    const { w, h, dpr } = stageSizeRef.current;
    if (!w || !h) return;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const faces = res.faceLandmarks;
    if (!faces || faces.length === 0) return; // اختفاء عند خروج الوجه

    const lm = faces[0];
    const idx = eyeSideRef.current === 'right' ? RIGHT_EYE_OUTER : LEFT_EYE_OUTER;
    const eye = lm[idx];
    if (!eye) return;

    const ex = eye.x * w;
    const ey = eye.y * h;

    // حساب offset وقت القفل فقط
    if (locked && !offsetRef.current) {
      offsetRef.current = {
        dx: (target.xPct / 100) * w - ex,
        dy: (target.yPct / 100) * h - ey,
      };
    }

    const dx = offsetRef.current?.dx ?? 0;
    const dy = offsetRef.current?.dy ?? 0;

    const cx = ex + dx;
    const cy = ey + dy;

    // Glow
    ctx.beginPath();
    ctx.arc(cx, cy, target.rPx + 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,0,0,0.12)';
    ctx.fill();

    // Ring
    ctx.beginPath();
    ctx.arc(cx, cy, target.rPx, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,60,60,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,60,60,0.95)';
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
    const res = landmarker.detectForVideo(video, now);
    lastResultRef.current = res;

    setFaceDetected((res.faceLandmarks?.length ?? 0) > 0);

    frames += 1;
    if (now - lastT > 500) {
      setFps(Math.round((frames * 1000) / (now - lastT)));
      frames = 0;
      lastT = now;
    }

    drawAnchoredTarget(res);

    if (running) rafRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.header}>
          <div style={styles.title}>Optivio MVP — Eye Muscle Anchoring</div>
          <div style={styles.badge(faceDetected)}>
            {running ? (faceDetected ? 'Face detected' : 'No face') : 'Stopped'}
          </div>
        </div>

        <div style={styles.main}>
          <div ref={stageRef} style={styles.stage}>
            <video ref={videoRef} style={styles.video} />
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
                onClick={() => {
                  setLocked((v) => !v);
                  if (!locked) offsetRef.current = null;
                }}
                disabled={!running}
              >
                {locked ? 'تعديل الموضع' : 'قفل الموضع'}
              </button>
            </div>

            <div>
              <div style={styles.label}>X %</div>
              <input
                style={styles.slider}
                type="range"
                min={0}
                max={100}
                value={target.xPct}
                onChange={(e) =>
                  !locked && setTarget((t) => ({ ...t, xPct: Number(e.target.value) }))
                }
                disabled={!running || locked}
              />
            </div>

            <div>
              <div style={styles.label}>Y %</div>
              <input
                style={styles.slider}
                type="range"
                min={0}
                max={100}
                value={target.yPct}
                onChange={(e) =>
                  !locked && setTarget((t) => ({ ...t, yPct: Number(e.target.value) }))
                }
                disabled={!running || locked}
              />
            </div>

            <div>
              <div style={styles.label}>Radius</div>
              <input
                style={styles.slider}
                type="range"
                min={10}
                max={48}
                value={target.rPx}
                onChange={(e) =>
                  !locked && setTarget((t) => ({ ...t, rPx: Number(e.target.value) }))
                }
                disabled={!running || locked}
              />
            </div>

            {error && <div style={styles.err}>{error}</div>}

            <div style={styles.note}>
              النقطة مرتبطة بعضلة العين وتتحرك مع الوجه. تختفي عند خروج الوجه.
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <div>FPS: {fps}</div>
          <div>MediaPipe Face Landmarks</div>
        </div>
      </div>
    </div>
  );
}
