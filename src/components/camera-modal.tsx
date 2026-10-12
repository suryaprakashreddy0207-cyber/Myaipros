import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, RotateCw, Check, AlertCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, name: string) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    stopStream();
    setStreamError(null);
    setIsInitializing(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Live camera stream is not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
      }
      setIsInitializing(false);
    } catch (err: any) {
      console.warn("Camera stream access warning:", err);
      setIsInitializing(false);
      setStreamError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission was denied. You can still use your device camera shutter directly below."
          : "Webcam stream unavailable. Tap below to use your native phone/device camera shutter."
      );
    }
  }, [stopStream]);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedPhoto(null);
      setStreamError(null);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  function handleSnap() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedPhoto(dataUrl);
    stopStream();
  }

  function handleConfirmPhoto() {
    if (!capturedPhoto) return;
    const filename = `photo-${Date.now()}.jpg`;
    onCapture(capturedPhoto, filename);
    toast.success("Photo captured & saved into chat!");
    onClose();
  }

  function handleRetake() {
    setCapturedPhoto(null);
    startCamera(facingMode);
  }

  function toggleFacingMode() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  function handleNativeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onCapture(dataUrl, file.name || `photo-${Date.now()}.jpg`);
      toast.success("Photo captured & saved into chat!");
      onClose();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
      {/* Native Camera Capture Fallback (Always functional on all smartphones/laptops) */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeFile}
      />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-zinc-950 text-white shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-brand" />
            <span className="text-sm font-bold">Take Photo for Chatbot</span>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Viewfinder / Captured Preview Area */}
        <div className="relative aspect-3/4 sm:aspect-4/3 w-full overflow-hidden bg-black flex items-center justify-center">
          {streamError ? (
            <div className="p-6 text-center space-y-4">
              <AlertCircle className="size-10 text-amber-400 mx-auto" />
              <p className="text-xs text-zinc-300 max-w-xs">{streamError}</p>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 mx-auto rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-brand-foreground shadow-lg hover:opacity-90 transition"
              >
                <Smartphone className="size-4" />
                <span>Open Device Camera Shutter</span>
              </button>
            </div>
          ) : capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Captured"
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />
              {/* Subtle Camera Grid Overlay */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 border border-white/20">
                <div className="border-r border-b border-white/40" />
                <div className="border-r border-b border-white/40" />
                <div className="border-b border-white/40" />
                <div className="border-r border-b border-white/40" />
                <div className="border-r border-b border-white/40" />
                <div className="border-b border-white/40" />
                <div className="border-r border-white/40" />
                <div className="border-r border-white/40" />
                <div />
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Bottom Camera Controls Bar */}
        <div className="flex items-center justify-between bg-zinc-900 px-6 py-4 border-t border-white/10">
          {capturedPhoto ? (
            <div className="flex w-full items-center justify-between gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 rounded-full border border-white/20 bg-white/5 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                Retake
              </button>
              <button
                onClick={handleConfirmPhoto}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-brand py-2.5 text-xs font-bold text-brand-foreground shadow-lg hover:opacity-90"
              >
                <Check className="size-4" /> Use Photo
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={toggleFacingMode}
                disabled={Boolean(streamError)}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-30"
                title="Switch Camera (Front/Rear)"
              >
                <RotateCw className="size-5" />
              </button>

              {/* Big Shutter Button */}
              <button
                onClick={handleSnap}
                disabled={Boolean(streamError) || isInitializing}
                className="group relative flex size-16 items-center justify-center rounded-full border-4 border-white p-1 hover:scale-105 active:scale-95 transition disabled:opacity-30"
                title="Capture Photo"
              >
                <div className="size-full rounded-full bg-white group-hover:bg-brand transition" />
              </button>

              <button
                onClick={() => nativeCameraInputRef.current?.click()}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                title="Native Camera App"
              >
                <Smartphone className="size-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
