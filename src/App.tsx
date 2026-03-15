/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { 
  Upload, 
  Download, 
  Image as ImageIcon, 
  Maximize, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Trash2,
  Monitor,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  Sliders,
  Sun,
  Crop,
  Split,
  Eye,
  Sparkles,
  Wand2,
  Eraser,
  Undo2,
  Brush
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logout, onAuthStateChanged, User } from './firebase';
import { GoogleGenAI, Type } from "@google/genai";

interface ImageState {
  file: File;
  preview: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  aspectRatio: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [image, setImage] = useState<ImageState | null>(null);
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [isLocked, setIsLocked] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resizedImage, setResizedImage] = useState<string | null>(null);
  const [quality, setQuality] = useState(0.9);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  
  // Filter states
  const [brightness, setBrightness] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  // Cropping states
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Comparison state
  const [isComparing, setIsComparing] = useState(false);

  // AI state
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Magic Eraser state
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [eraserZoom, setEraserZoom] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<number>(1);
  const eraserCanvasRef = useRef<HTMLCanvasElement>(null);
  const eraserContainerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const state: ImageState = {
          file,
          preview: e.target?.result as string,
          width: img.width,
          height: img.height,
          originalWidth: img.width,
          originalHeight: img.height,
          aspectRatio: img.width / img.height,
        };
        setImage(state);
        setTargetWidth(img.width);
        setTargetHeight(img.height);
        setResizedImage(null);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const handleWidthChange = (val: number) => {
    setTargetWidth(val);
    if (isLocked && image) {
      setTargetHeight(Math.round(val / image.aspectRatio));
    }
  };

  const handleHeightChange = (val: number) => {
    setTargetHeight(val);
    if (isLocked && image) {
      setTargetWidth(Math.round(val * image.aspectRatio));
    }
  };

  const resetDimensions = () => {
    if (image) {
      setTargetWidth(image.originalWidth);
      setTargetHeight(image.originalHeight);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const resizeImage = async () => {
    if (!image) return;
    setIsResizing(true);

    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      if (ctx) {
        // Use better image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Apply filters to canvas
        ctx.filter = `brightness(${brightness}%) grayscale(${grayscale}%) sepia(${sepia}%) contrast(${contrast}%) saturate(${saturation}%)`;
        
        if (croppedAreaPixels) {
          ctx.drawImage(
            img,
            croppedAreaPixels.x,
            croppedAreaPixels.y,
            croppedAreaPixels.width,
            croppedAreaPixels.height,
            0,
            0,
            targetWidth,
            targetHeight
          );
        } else {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        }
        
        const dataUrl = canvas.toDataURL(format, quality);
        setResizedImage(dataUrl);
        setIsResizing(false);
      }
    };
    img.src = image.preview;
  };

  const downloadImage = () => {
    if (!resizedImage) return;
    const link = document.createElement('a');
    const extension = format.split('/')[1];
    link.download = `resized-image.${extension}`;
    link.href = resizedImage;
    link.click();
  };

  const applyMagicAI = async () => {
    if (!image) return;
    
    setIsAiProcessing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Convert image to base64 without the data:image/... prefix
      const base64Data = image.preview.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: image.file.type,
                  data: base64Data
                }
              },
              {
                text: "Analyze this image and suggest the best filter settings to enhance its visual quality. Aim for a professional, vibrant, and balanced look. Return ONLY a JSON object with these properties: brightness (0-200), contrast (0-200), saturation (0-200), grayscale (0-100), sepia (0-100)."
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brightness: { type: Type.NUMBER },
              contrast: { type: Type.NUMBER },
              saturation: { type: Type.NUMBER },
              grayscale: { type: Type.NUMBER },
              sepia: { type: Type.NUMBER }
            },
            required: ["brightness", "contrast", "saturation", "grayscale", "sepia"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      if (result.brightness !== undefined) setBrightness(Math.round(result.brightness));
      if (result.contrast !== undefined) setContrast(Math.round(result.contrast));
      if (result.saturation !== undefined) setSaturation(Math.round(result.saturation));
      if (result.grayscale !== undefined) setGrayscale(Math.round(result.grayscale));
      if (result.sepia !== undefined) setSepia(Math.round(result.sepia));
      
      setResizedImage(null); // Reset resized image to show new preview
    } catch (error) {
      console.error("Magic AI failed:", error);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEraserMode) return;
    
    if ('touches' in e) {
      if (e.touches.length === 1) {
        setIsDrawing(true);
        draw(e);
      } else if (e.touches.length === 2) {
        setIsDrawing(false);
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        setInitialPinchDistance(distance);
        setInitialZoom(eraserZoom);
      }
    } else {
      setIsDrawing(true);
      draw(e);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setInitialPinchDistance(null);
    const ctx = eraserCanvasRef.current?.getContext('2d');
    ctx?.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEraserMode || !eraserCanvasRef.current) return;

    if ('touches' in e) {
      if (e.touches.length === 1 && isDrawing) {
        const canvas = eraserCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clientX = e.touches[0].clientX;
        const clientY = e.touches[0].clientY;

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (e.touches.length === 2 && initialPinchDistance !== null) {
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const zoomFactor = currentDistance / initialPinchDistance;
        const newZoom = Math.min(Math.max(initialZoom * zoomFactor, 1), 5);
        setEraserZoom(newZoom);
      }
    } else if (isDrawing) {
      const canvas = eraserCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const clientX = (e as React.MouseEvent).clientX;
      const clientY = (e as React.MouseEvent).clientY;

      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';

      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const clearMask = () => {
    const canvas = eraserCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const applyMagicEraser = async () => {
    if (!image || !eraserCanvasRef.current) return;

    setIsAiProcessing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Create a mask image (black background, white where user drew)
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = eraserCanvasRef.current.width;
      maskCanvas.height = eraserCanvasRef.current.height;
      const mCtx = maskCanvas.getContext('2d');
      if (!mCtx) return;

      mCtx.fillStyle = 'black';
      mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      // Draw the user's strokes as white
      mCtx.globalCompositeOperation = 'source-over';
      mCtx.drawImage(eraserCanvasRef.current, 0, 0);
      
      // Convert the red strokes to white for the mask
      const imgData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i] > 0) { // If there's any red
          imgData.data[i] = 255;
          imgData.data[i+1] = 255;
          imgData.data[i+2] = 255;
        }
      }
      mCtx.putImageData(imgData, 0, 0);

      const base64Image = image.preview.split(',')[1];
      const base64Mask = maskCanvas.toDataURL('image/png').split(',')[1];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: image.file.type,
                  data: base64Image
                }
              },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Mask
                }
              },
              {
                text: "The first image is the original photo. The second image is a black and white mask where the white areas indicate objects I want to remove. Please remove the objects in the white areas and fill the background seamlessly to match the surrounding environment. Return ONLY the edited image."
              }
            ]
          }
        ]
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const newImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setResizedImage(newImageUrl);
          // Update the original preview so further edits use the erased version
          setImage({
            ...image,
            preview: newImageUrl
          });
          clearMask();
          setIsEraserMode(false);
          break;
        }
      }
    } catch (error) {
      console.error("Magic Eraser failed:", error);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const clearAll = () => {
    setImage(null);
    setResizedImage(null);
    setTargetWidth(0);
    setTargetHeight(0);
    setBrightness(100);
    setGrayscale(0);
    setSepia(0);
    setContrast(100);
    setSaturation(100);
    setIsCropping(false);
    setCroppedAreaPixels(null);
    setIsComparing(false);
    setIsEraserMode(false);
    setEraserZoom(1);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Maximize className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">SnapSize</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-slate-500 text-sm font-medium mr-2">
              <span className="flex items-center gap-1"><Monitor size={16} /> Desktop</span>
              <span className="flex items-center gap-1"><Smartphone size={16} /> Mobile</span>
            </div>

            {isAuthLoading ? (
              <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-xs font-bold text-slate-800 leading-none">{user.displayName}</span>
                  <button onClick={handleLogout} className="text-[10px] text-slate-400 hover:text-indigo-600 font-medium transition-colors">Sign Out</button>
                </div>
                <img 
                  src={user.photoURL || ''} 
                  alt={user.displayName || 'User'} 
                  className="w-8 h-8 rounded-full border border-slate-200 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {!image ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto"
          >
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative group cursor-pointer
                  border-2 border-dashed rounded-3xl p-12 sm:p-20
                  flex flex-col items-center justify-center gap-6
                  transition-all duration-300
                  ${isDragging 
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' 
                    : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50'
                  }
                `}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  accept="image/*"
                  className="hidden"
                />
                <div className={`
                  w-20 h-20 rounded-2xl flex items-center justify-center
                  transition-transform duration-300 group-hover:scale-110
                  ${isDragging ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}
                `}>
                  <Upload size={40} />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Drop your photo here</h2>
                  <p className="text-slate-500">or click to browse from your device</p>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                    <ImageIcon size={14} /> JPG, PNG, WEBP
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                    <Lock size={14} /> Private & Local
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Preview Section */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 overflow-hidden">
                  <div 
                    ref={eraserContainerRef}
                    className={`relative aspect-auto min-h-[400px] flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 ${isComparing ? 'flex-col sm:flex-row gap-4 p-4' : ''} ${isEraserMode ? 'overflow-auto' : 'overflow-hidden'}`}
                  >
                    {isComparing ? (
                      <>
                        <div className="flex-1 flex flex-col items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded">Original</span>
                          <img
                            src={image.preview}
                            alt="Original"
                            className="max-w-full max-h-[400px] object-contain rounded-lg shadow-md"
                          />
                        </div>
                        <div className="w-px h-full bg-slate-200 hidden sm:block" />
                        <div className="h-px w-full bg-slate-200 sm:hidden" />
                        <div className="flex-1 flex flex-col items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Result</span>
                          <img
                            src={resizedImage || image.preview}
                            alt="Result"
                            className="max-w-full max-h-[400px] object-contain rounded-lg shadow-md transition-all duration-300"
                            style={{
                              filter: resizedImage ? 'none' : `brightness(${brightness}%) grayscale(${grayscale}%) sepia(${sepia}%) contrast(${contrast}%) saturate(${saturation}%)`
                            }}
                          />
                        </div>
                      </>
                    ) : isCropping ? (
                      <div className="absolute inset-0">
                        <Cropper
                          image={image.preview}
                          crop={crop}
                          zoom={zoom}
                          aspect={isLocked ? targetWidth / targetHeight : undefined}
                          onCropChange={setCrop}
                          onCropComplete={onCropComplete}
                          onZoomChange={setZoom}
                        />
                      </div>
                    ) : (
                      <div 
                        className="relative w-full h-full flex items-center justify-center transition-transform duration-200 ease-out"
                        style={{ transform: isEraserMode ? `scale(${eraserZoom})` : 'none' }}
                      >
                        <img
                          src={resizedImage || image.preview}
                          alt="Preview"
                          className="max-w-full max-h-[600px] object-contain shadow-2xl transition-all duration-300"
                          style={{
                            filter: resizedImage ? 'none' : `brightness(${brightness}%) grayscale(${grayscale}%) sepia(${sepia}%) contrast(${contrast}%) saturate(${saturation}%)`
                          }}
                        />
                        {isEraserMode && (
                          <canvas
                            ref={eraserCanvasRef}
                            width={image.width}
                            height={image.height}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="absolute inset-0 w-full h-full object-contain cursor-crosshair touch-none z-10"
                          />
                        )}
                      </div>
                    )}
                    {isResizing && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20">
                        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
                        <span className="font-bold text-slate-800">Resizing...</span>
                      </div>
                    )}
                    {isAiProcessing && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-30">
                        <div className="relative">
                          <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
                          <Sparkles className="absolute -top-2 -right-2 text-amber-500 animate-bounce" size={20} />
                        </div>
                        <span className="font-bold text-slate-800">AI Magic in progress...</span>
                        <p className="text-xs text-slate-500">Removing objects and filling background</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Original</span>
                      <span className="text-sm font-medium text-slate-600">{image.originalWidth} × {image.originalHeight} px</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsCropping(!isCropping);
                          if (!isCropping) {
                            setIsComparing(false);
                            setIsEraserMode(false);
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                          isCropping 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Crop size={18} />
                        {isCropping ? 'Done' : 'Crop'}
                      </button>

                      <button
                        onClick={() => {
                          setIsComparing(!isComparing);
                          if (!isComparing) {
                            setIsCropping(false);
                            setIsEraserMode(false);
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                          isComparing 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Split size={18} />
                        {isComparing ? 'Exit' : 'Compare'}
                      </button>

                      <button
                        onClick={() => {
                          setIsEraserMode(!isEraserMode);
                          if (!isEraserMode) {
                            setIsCropping(false);
                            setIsComparing(false);
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                          isEraserMode 
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Eraser size={18} />
                        {isEraserMode ? 'Exit Eraser' : 'Magic Eraser'}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-2 text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors"
                  >
                    <Trash2 size={18} /> Clear
                  </button>
                </div>

                {isEraserMode && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-4"
                  >
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-6 w-full sm:w-auto">
                        <div className="flex items-center gap-4 flex-1 sm:flex-none">
                          <div className="flex items-center gap-2">
                            <Brush size={16} className="text-amber-600" />
                            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Brush</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="flex-1 sm:w-32 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                          />
                          <span className="text-xs font-bold text-amber-600 w-8">{brushSize}px</span>
                        </div>

                        <div className="flex items-center gap-4 flex-1 sm:flex-none">
                          <div className="flex items-center gap-2">
                            <Maximize size={16} className="text-amber-600" />
                            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Zoom</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            step="0.1"
                            value={eraserZoom}
                            onChange={(e) => setEraserZoom(parseFloat(e.target.value))}
                            className="flex-1 sm:w-32 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                          />
                          <span className="text-xs font-bold text-amber-600 w-8">{Math.round(eraserZoom * 100)}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={clearMask}
                          className="flex-1 sm:flex-none px-4 py-2 bg-white border border-amber-200 text-amber-700 font-bold text-xs rounded-xl hover:bg-amber-100 transition-colors"
                        >
                          Clear Mask
                        </button>
                        <button
                          onClick={applyMagicEraser}
                          disabled={isAiProcessing}
                          className="flex-1 sm:flex-none px-6 py-2 bg-amber-500 text-white font-bold text-xs rounded-xl hover:bg-amber-600 shadow-md shadow-amber-200 transition-all flex items-center justify-center gap-2"
                        >
                          <Wand2 size={14} />
                          Apply Eraser
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-600 font-medium text-center sm:text-left">
                      Tip: Use the Zoom slider to get closer for precise erasing.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Controls Section */}
              <div className="lg:col-span-5 space-y-6 sticky top-24">
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-800">Dimensions</h3>
                      <button
                        onClick={() => setIsLocked(!isLocked)}
                        className={`p-2 rounded-lg transition-colors ${isLocked ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}
                        title={isLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                      >
                        {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Width (px)</label>
                        <input
                          type="number"
                          value={targetWidth}
                          onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Height (px)</label>
                        <input
                          type="number"
                          value={targetHeight}
                          onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={resetDimensions}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => {
                          handleWidthChange(Math.round(image.originalWidth * 0.5));
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        50%
                      </button>
                      <button
                        onClick={() => {
                          handleWidthChange(Math.round(image.originalWidth * 0.25));
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        25%
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Sliders size={18} className="text-indigo-600" />
                      <h3 className="text-lg font-bold text-slate-800">Image Filters</h3>
                    </div>
                    
                    <button
                      onClick={applyMagicAI}
                      disabled={isAiProcessing}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group overflow-hidden relative"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-[-20deg]" />
                      {isAiProcessing ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                          <span>Magic AI Enhance</span>
                        </>
                      )}
                    </button>
                    
                    <div className="space-y-5">
                      {/* Brightness */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Brightness</label>
                          <span className="text-xs font-bold text-indigo-600">{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={brightness}
                          onChange={(e) => setBrightness(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      {/* Contrast */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contrast</label>
                          <span className="text-xs font-bold text-indigo-600">{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={contrast}
                          onChange={(e) => setContrast(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      {/* Saturation */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saturation</label>
                          <span className="text-xs font-bold text-indigo-600">{saturation}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={saturation}
                          onChange={(e) => setSaturation(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Grayscale */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grayscale</label>
                            <span className="text-xs font-bold text-indigo-600">{grayscale}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={grayscale}
                            onChange={(e) => setGrayscale(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        {/* Sepia */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sepia</label>
                            <span className="text-xs font-bold text-indigo-600">{sepia}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={sepia}
                            onChange={(e) => setSepia(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setBrightness(100);
                          setGrayscale(0);
                          setSepia(0);
                          setContrast(100);
                          setSaturation(100);
                        }}
                        className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 rounded-xl"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Export Settings</h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quality</label>
                          <span className="text-xs font-bold text-indigo-600">{Math.round(quality * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={quality}
                          onChange={(e) => setQuality(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Format</label>
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                          {(['image/jpeg', 'image/png', 'image/webp'] as const).map((f) => (
                            <button
                              key={f}
                              onClick={() => setFormat(f)}
                              className={`
                                flex-1 py-2 text-xs font-bold rounded-lg transition-all
                                ${format === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}
                              `}
                            >
                              {f.split('/')[1].toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {!resizedImage ? (
                      <button
                        onClick={resizeImage}
                        disabled={isResizing || targetWidth === 0 || targetHeight === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                      >
                        {isResizing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                        Apply Resize
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <button
                          onClick={downloadImage}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                        >
                          <Download /> Download Image
                        </button>
                        <button
                          onClick={() => setResizedImage(null)}
                          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                          Edit Again
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-2xl p-4 flex items-start gap-3">
                  <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600">
                    <CheckCircle2 size={16} />
                  </div>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    <strong>Privacy First:</strong> Your photos are processed entirely in your browser. They are never uploaded to any server.
                  </p>
                </div>
              </div>
        </motion.div>
      )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <Maximize size={18} />
            <span className="font-bold text-slate-500">SnapSize</span>
            <span>&copy; 2026</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
