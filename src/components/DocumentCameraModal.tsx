import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  AlertTriangle,
  Upload,
  SwitchCamera,
  Check,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface DocumentCameraModalProps {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
  onFallbackToFileUpload: () => void;
}

export const DocumentCameraModal: React.FC<DocumentCameraModalProps> = ({
  onCapture,
  onClose,
  onFallbackToFileUpload,
}) => {
  const { language, theme } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isShutterActive, setIsShutterActive] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  // Initialize and attach camera stream
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraLoading(true);
    setCameraError(null);

    // Stop any existing stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) is not supported on this browser.');
      }

      // Try environment facing camera first, fallback to user camera
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('Initial camera constraints failed, attempting fallback to basic video:', firstErr);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch((playErr) => {
          console.warn('Video autoPlay prevented:', playErr);
        });
      }

      setCameraLoading(false);
    } catch (err: any) {
      console.error('Error opening camera stream:', err);
      let message = 'Unable to access the camera device.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message =
          language === 'hi'
            ? 'कैमरा अनुमति अस्वीकृत है। कृपया ब्राउज़र सेटिंग्स में कैमरा की अनुमति दें या नीचे दिए गए विकल्प से फ़ाइल अपलोड करें।'
            : 'Camera permission was denied. Please allow camera access in your browser settings or use the file upload option below.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message =
          language === 'hi'
            ? 'कोई कैमरा नहीं मिला। कृपया दस्तावेज़ की फोटो या पीडीएफ अपलोड करें।'
            : 'No camera hardware found on this device. Please upload an image or PDF instead.';
      } else {
        message =
          language === 'hi'
            ? `कैमरा त्रुटि: ${err.message || 'कैमरा शुरू नहीं हो सका'}। कृपया फ़ाइल अपलोड का उपयोग करें।`
            : `Camera error: ${err.message || 'Failed to start camera'}. Please use the file upload option.`;
      }
      setCameraError(message);
      setCameraLoading(false);
    }
  };

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      // Cleanup all media tracks on unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  // Flip between front and back camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture frame to canvas
  const handleSnapPhoto = () => {
    if (!videoRef.current || cameraLoading || cameraError) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Trigger flash animation
    setIsShutterActive(true);

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Convert to high-quality JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPreview(dataUrl);

    // Stop video tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    setTimeout(() => {
      setIsShutterActive(false);
      onCapture(dataUrl);
    }, 450);
  };

  return (
    <div
      id="document-camera-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 text-left animate-fadeIn"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto relative">
        {/* Shutter Flash Animation Overlay */}
        {isShutterActive && (
          <div className="absolute inset-0 bg-white z-40 animate-fadeOut pointer-events-none" />
        )}

        {/* Hidden canvas for capturing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Modal Header */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-600 text-white">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                {language === 'hi' ? 'लाइव दस्तावेज़ कैमरा स्कैनर' : 'Live Document Optical Camera'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {language === 'hi'
                  ? 'पर्ची या लैब रिपोर्ट को गाइड फ्रेम के अंदर रखें'
                  : 'Hold past prescription or lab report inside the framing box'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close camera"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Camera Viewfinder / Preview View */}
        <div className="relative bg-black aspect-4/3 sm:aspect-16/10 flex items-center justify-center overflow-hidden">
          {cameraLoading && !cameraError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900 text-cyan-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <p className="text-sm font-bold text-slate-200">
                {language === 'hi' ? 'कैमरा शुरू हो रहा है...' : 'Initializing optical camera...'}
              </p>
            </div>
          )}

          {cameraError ? (
            <div className="p-6 text-center space-y-4 max-w-md mx-auto z-10">
              <div className="w-14 h-14 bg-rose-950/80 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-800">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {language === 'hi' ? 'कैमरा उपलब्ध नहीं है' : 'Camera Access Unavailable'}
                </h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{cameraError}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{language === 'hi' ? 'पुनः प्रयास करें' : 'Try Again'}</span>
                </button>

                <button
                  id="btn-camera-fallback-upload"
                  type="button"
                  onClick={() => {
                    onClose();
                    onFallbackToFileUpload();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Upload className="w-4 h-4" />
                  <span>{language === 'hi' ? 'फ़ाइल / फोटो चुनें' : 'Upload Image / PDF Instead'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder Target Framing Box */}
              {!cameraLoading && (
                <div className="absolute inset-4 sm:inset-8 border-2 border-cyan-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-3 sm:p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Top corner brackets */}
                  <div className="flex justify-between items-start">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                    <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-bold text-cyan-300 border border-cyan-500/40 uppercase tracking-wider">
                      {language === 'hi' ? 'दस्तावेज़ संरेखित करें' : 'Document Scanner'}
                    </span>
                    <div className="w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                  </div>

                  {/* Center Scanning Line Animation */}
                  <div className="w-full h-0.5 bg-cyan-400/60 shadow-[0_0_8px_#22d3ee] animate-pulse my-auto" />

                  {/* Bottom corner brackets */}
                  <div className="flex justify-between items-end">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                    <span className="text-[10px] text-slate-300 bg-black/60 px-2 py-0.5 rounded font-medium">
                      {language === 'hi'
                        ? 'दवा पर्ची को सीधा रखें'
                        : 'Keep report flat and well-lit'}
                    </span>
                    <div className="w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Camera Controls Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-white shrink-0">
          {/* Flip Camera Button */}
          <button
            type="button"
            onClick={handleToggleFacingMode}
            disabled={cameraLoading || !!cameraError}
            className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-2xl flex items-center gap-2 text-xs font-bold cursor-pointer transition-colors"
            title={language === 'hi' ? 'कैमरा बदलें' : 'Switch Camera'}
          >
            <SwitchCamera className="w-5 h-5" />
            <span className="hidden sm:inline">
              {facingMode === 'environment' ? 'Back Cam' : 'Front Cam'}
            </span>
          </button>

          {/* Shutter Snap Button */}
          <button
            id="btn-snap-document-photo"
            type="button"
            onClick={handleSnapPhoto}
            disabled={cameraLoading || !!cameraError}
            className="px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 disabled:opacity-40 text-white rounded-2xl font-black text-base flex items-center gap-3 shadow-lg shadow-cyan-900/40 cursor-pointer transform active:scale-95 transition-all"
          >
            <div className="w-4 h-4 rounded-full bg-white animate-ping shrink-0" />
            <Camera className="w-6 h-6 shrink-0" />
            <span>{language === 'hi' ? 'फोटो लें (Capture)' : 'Snap Document'}</span>
          </button>

          {/* Fallback to upload from modal */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onFallbackToFileUpload();
            }}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl flex items-center gap-2 text-xs font-bold cursor-pointer transition-colors"
            title={language === 'hi' ? 'फ़ाइल चुनें' : 'Upload File'}
          >
            <Upload className="w-5 h-5 text-amber-400" />
            <span className="hidden sm:inline">
              {language === 'hi' ? 'फ़ाइल' : 'Upload'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
