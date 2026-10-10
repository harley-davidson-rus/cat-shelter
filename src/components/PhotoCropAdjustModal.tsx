import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Move, RefreshCw, Maximize2, Unlock } from 'lucide-react';

interface PhotoCropAdjustModalProps {
  isOpen: boolean;
  photoUrl: string;
  onClose: () => void;
  onSaveAdjustedPhoto: (adjustedDataUrl: string) => void;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AspectRatioOption = 'free' | 'original' | '3:4' | '9:16' | '1:1' | '4:3' | '16:9';

interface AspectRatioDef {
  id: AspectRatioOption;
  label: string;
  badge: string;
  ratio: number | null; // null for free or dynamic original
}

export const PhotoCropAdjustModal: React.FC<PhotoCropAdjustModalProps> = ({
  isOpen,
  photoUrl,
  onClose,
  onSaveAdjustedPhoto,
}) => {
  if (!isOpen || !photoUrl) return null;

  // View state
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [selectedFormat, setSelectedFormat] = useState<AspectRatioOption>('3:4');
  const [isProcessing, setIsProcessing] = useState(false);

  // Crop box in container pixel space
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, width: 240, height: 320 });
  const [imgDisplayRect, setImgDisplayRect] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Dragging / Resizing interaction states
  type DragMode = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w' | null;
  const [dragMode, setDragMode] = useState<DragMode>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; box: CropBox }>({
    clientX: 0,
    clientY: 0,
    box: { x: 0, y: 0, width: 240, height: 320 },
  });

  // Calculate the numeric ratio given the current image orientation and selected format
  const getNumericRatio = useCallback(
    (fmt: AspectRatioOption): number | null => {
      if (fmt === 'free') return null;
      if (fmt === '1:1') return 1;
      if (fmt === '4:3') return 4 / 3;
      if (fmt === '3:4') return 3 / 4; // Vertical portrait (3:4)
      if (fmt === '9:16') return 9 / 16; // Vertical story/phone (9:16)
      if (fmt === '16:9') return 16 / 9; // Wide landscape (16:9)

      if (fmt === 'original') {
        const img = imgRef.current;
        if (!img || !img.naturalWidth || !img.naturalHeight) return 3 / 4;
        const isRot = rotation === 90 || rotation === 270;
        const w = isRot ? img.naturalHeight : img.naturalWidth;
        const h = isRot ? img.naturalWidth : img.naturalHeight;
        return w / h;
      }
      return null;
    },
    [rotation]
  );

  // Calculate layout of image inside stage when image loads, rotates, or container resizes
  const updateLayout = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const isRotated90or270 = rotation === 90 || rotation === 270;
    const effectiveImgW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
    const effectiveImgH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

    // Calculate containment size so entire photo is comfortably visible
    const scale = Math.min(
      (containerW * 0.92) / effectiveImgW,
      (containerH * 0.90) / effectiveImgH,
      1.5
    );

    const dispW = effectiveImgW * scale;
    const dispH = effectiveImgH * scale;
    const dispX = (containerW - dispW) / 2;
    const dispY = (containerH - dispH) / 2;

    const newImgRect = { x: dispX, y: dispY, width: dispW, height: dispH };
    setImgDisplayRect(newImgRect);

    // Initial crop box: fits image nicely
    const ratio = getNumericRatio(selectedFormat);
    let boxW = dispW * 0.9;
    let boxH = ratio ? boxW / ratio : dispH * 0.9;

    if (boxH > dispH * 0.95) {
      boxH = dispH * 0.95;
      boxW = ratio ? boxH * ratio : boxW;
    }

    const boxX = dispX + (dispW - boxW) / 2;
    // Align crop box towards top portion so the cat's head and ears are completely framed
    const boxY = dispY + Math.max(0, (dispH - boxH) * 0.08);

    setCropBox({
      x: Math.round(boxX),
      y: Math.round(boxY),
      width: Math.round(boxW),
      height: Math.round(boxH),
    });
  }, [rotation, selectedFormat, getNumericRatio]);

  useEffect(() => {
    updateLayout();
  }, [updateLayout]);

  // Adjust crop box when user selects a new format
  const handleSelectFormat = (fmt: AspectRatioOption) => {
    setSelectedFormat(fmt);

    const newRatio = getNumericRatio(fmt);
    if (!newRatio) return; // Free form retains current dimensions

    setCropBox((prev) => {
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;

      let newW = prev.width;
      let newH = newW / newRatio;

      if (imgDisplayRect.width > 0) {
        if (newH > imgDisplayRect.height) {
          newH = imgDisplayRect.height * 0.95;
          newW = newH * newRatio;
        }
        if (newW > imgDisplayRect.width) {
          newW = imgDisplayRect.width * 0.95;
          newH = newW / newRatio;
        }
      }

      let newX = centerX - newW / 2;
      let newY = centerY - newH / 2;

      if (imgDisplayRect.width > 0) {
        newX = Math.max(imgDisplayRect.x, Math.min(newX, imgDisplayRect.x + imgDisplayRect.width - newW));
        newY = Math.max(imgDisplayRect.y, Math.min(newY, imgDisplayRect.y + imgDisplayRect.height - newH));
      }

      return {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      };
    });
  };

  // Zoom preset helper: expands or shrinks the crop box
  const handleScaleCropBox = (multiplier: number) => {
    const ratio = getNumericRatio(selectedFormat);
    setCropBox((prev) => {
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;

      let newW = prev.width * multiplier;
      let newH = ratio ? newW / ratio : prev.height * multiplier;

      const minW = 50;
      const maxW = imgDisplayRect.width || 800;

      if (newW < minW) {
        newW = minW;
        newH = ratio ? minW / ratio : Math.max(50, newH);
      } else if (newW > maxW) {
        newW = maxW;
        newH = ratio ? maxW / ratio : newH;
      }

      let newX = centerX - newW / 2;
      let newY = centerY - newH / 2;

      if (imgDisplayRect.width > 0) {
        newX = Math.max(imgDisplayRect.x, Math.min(newX, imgDisplayRect.x + imgDisplayRect.width - newW));
        newY = Math.max(imgDisplayRect.y, Math.min(newY, imgDisplayRect.y + imgDisplayRect.height - newH));
      }

      return {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      };
    });
  };

  // Fit maximum possible crop box inside visible image for chosen aspect ratio
  const handleMaximizeCropBox = () => {
    if (!imgDisplayRect.width) return;
    const ratio = getNumericRatio(selectedFormat);

    let w = imgDisplayRect.width;
    let h = imgDisplayRect.height;

    if (ratio) {
      h = w / ratio;
      if (h > imgDisplayRect.height) {
        h = imgDisplayRect.height;
        w = h * ratio;
      }
    }

    const x = imgDisplayRect.x + (imgDisplayRect.width - w) / 2;
    const y = imgDisplayRect.y + (imgDisplayRect.height - h) / 2;

    setCropBox({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
    });
  };

  // Pointer drag start
  const startDrag = (e: React.MouseEvent | React.TouchEvent, mode: DragMode) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setDragMode(mode);
    dragStartRef.current = {
      clientX,
      clientY,
      box: { ...cropBox },
    };
  };

  // Mouse & Touch Move Handlers
  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragMode) return;

      const dx = clientX - dragStartRef.current.clientX;
      const dy = clientY - dragStartRef.current.clientY;
      const initial = dragStartRef.current.box;
      const ratio = getNumericRatio(selectedFormat);

      const imgLeft = imgDisplayRect.x;
      const imgTop = imgDisplayRect.y;
      const imgRight = imgDisplayRect.x + imgDisplayRect.width;
      const imgBottom = imgDisplayRect.y + imgDisplayRect.height;

      if (dragMode === 'move') {
        let newX = initial.x + dx;
        let newY = initial.y + dy;

        if (imgDisplayRect.width > 0) {
          newX = Math.max(imgLeft, Math.min(newX, imgRight - initial.width));
          newY = Math.max(imgTop, Math.min(newY, imgBottom - initial.height));
        }

        setCropBox({
          ...initial,
          x: Math.round(newX),
          y: Math.round(newY),
        });
      } else if (dragMode === 'se') {
        let newW = Math.max(50, initial.width + dx);
        let newH = ratio ? newW / ratio : Math.max(50, initial.height + dy);

        if (initial.x + newW > imgRight) {
          newW = imgRight - initial.x;
          if (ratio) newH = newW / ratio;
        }
        if (initial.y + newH > imgBottom) {
          newH = imgBottom - initial.y;
          if (ratio) newW = newH * ratio;
        }

        setCropBox({
          ...initial,
          width: Math.round(newW),
          height: Math.round(newH),
        });
      } else if (dragMode === 'sw') {
        let newW = Math.max(50, initial.width - dx);
        let newH = ratio ? newW / ratio : Math.max(50, initial.height + dy);

        let newX = initial.x + (initial.width - newW);
        if (newX < imgLeft) {
          newW = initial.x + initial.width - imgLeft;
          if (ratio) newH = newW / ratio;
          newX = imgLeft;
        }
        if (initial.y + newH > imgBottom) {
          newH = imgBottom - initial.y;
          if (ratio) {
            newW = newH * ratio;
            newX = initial.x + (initial.width - newW);
          }
        }

        setCropBox({
          x: Math.round(newX),
          y: initial.y,
          width: Math.round(newW),
          height: Math.round(newH),
        });
      } else if (dragMode === 'ne') {
        let newW = Math.max(50, initial.width + dx);
        let newH = ratio ? newW / ratio : Math.max(50, initial.height - dy);

        if (initial.x + newW > imgRight) {
          newW = imgRight - initial.x;
          if (ratio) newH = newW / ratio;
        }
        let newY = initial.y + (initial.height - newH);
        if (newY < imgTop) {
          newH = initial.y + initial.height - imgTop;
          if (ratio) newW = newH * ratio;
          newY = imgTop;
        }

        setCropBox({
          x: initial.x,
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        });
      } else if (dragMode === 'nw') {
        let newW = Math.max(50, initial.width - dx);
        let newH = ratio ? newW / ratio : Math.max(50, initial.height - dy);

        let newX = initial.x + (initial.width - newW);
        let newY = initial.y + (initial.height - newH);

        if (newX < imgLeft) {
          newW = initial.x + initial.width - imgLeft;
          if (ratio) newH = newW / ratio;
          newX = imgLeft;
          newY = initial.y + (initial.height - newH);
        }
        if (newY < imgTop) {
          newH = initial.y + initial.height - imgTop;
          if (ratio) {
            newW = newH * ratio;
            newX = initial.x + (initial.width - newW);
          }
          newY = imgTop;
        }

        setCropBox({
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        });
      }
    },
    [dragMode, selectedFormat, getNumericRatio, imgDisplayRect]
  );

  useEffect(() => {
    if (!dragMode) return;

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => setDragMode(null);

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => setDragMode(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragMode, handlePointerMove]);

  // Rotate clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Align crop box directly to upper head area of the cat
  const handleAlignToHead = () => {
    setCropBox((prev) => {
      const topY = Math.round(imgDisplayRect.y + Math.max(0, (imgDisplayRect.height - prev.height) * 0.06));
      return {
        ...prev,
        y: topY,
      };
    });
  };

  // Perform precise Canvas crop & export
  const handleSave = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !imgDisplayRect.width) return;

    setIsProcessing(true);

    try {
      // Create a canvas with the rotated full image
      const fullRotatedCanvas = document.createElement('canvas');
      const isRotated90or270 = rotation === 90 || rotation === 270;
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      const rotW = isRotated90or270 ? naturalH : naturalW;
      const rotH = isRotated90or270 ? naturalW : naturalH;

      fullRotatedCanvas.width = rotW;
      fullRotatedCanvas.height = rotH;
      const rotCtx = fullRotatedCanvas.getContext('2d');

      if (!rotCtx) {
        setIsProcessing(false);
        return;
      }

      // Draw rotated image onto fullRotatedCanvas
      rotCtx.translate(rotW / 2, rotH / 2);
      rotCtx.rotate((rotation * Math.PI) / 180);
      rotCtx.drawImage(img, -naturalW / 2, -naturalH / 2);

      // Compute relative crop rectangle inside displayed image rect
      const relCropX = (cropBox.x - imgDisplayRect.x) / imgDisplayRect.width;
      const relCropY = (cropBox.y - imgDisplayRect.y) / imgDisplayRect.height;
      const relCropW = cropBox.width / imgDisplayRect.width;
      const relCropH = cropBox.height / imgDisplayRect.height;

      // Map to pixel coords on fullRotatedCanvas
      const sourceX = Math.max(0, Math.round(relCropX * rotW));
      const sourceY = Math.max(0, Math.round(relCropY * rotH));
      const sourceW = Math.min(rotW - sourceX, Math.round(relCropW * rotW));
      const sourceH = Math.min(rotH - sourceY, Math.round(relCropH * rotH));

      // Determine output canvas size
      let targetW = 1200;
      let targetH = Math.round((targetW * sourceH) / sourceW);

      if (targetH > 1400) {
        targetH = 1400;
        targetW = Math.round((targetH * sourceW) / sourceH);
      }

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = targetW;
      outputCanvas.height = targetH;

      const outCtx = outputCanvas.getContext('2d');
      if (!outCtx) {
        setIsProcessing(false);
        return;
      }

      // Fill with clean background
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, targetW, targetH);

      // Draw cropped slice
      outCtx.drawImage(
        fullRotatedCanvas,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        0,
        0,
        targetW,
        targetH
      );

      // Export as high-quality jpeg
      const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.9);
      onSaveAdjustedPhoto(dataUrl);
      onClose();
    } catch {
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const FORMAT_OPTIONS: AspectRatioDef[] = [
    { id: 'original', label: 'Оригинал', badge: 'Исходные пропорции', ratio: null },
    { id: '3:4', label: '3:4 (Портрет)', badge: 'Вертикальный 3:4', ratio: 3 / 4 },
    { id: '9:16', label: '9:16 (Телефон)', badge: 'Сторис / Вертикальный 9:16', ratio: 9 / 16 },
    { id: '1:1', label: '1:1 (Квадрат)', badge: 'Квадрат 1:1', ratio: 1 },
    { id: '4:3', label: '4:3 (Каталог)', badge: 'Горизонтальный 4:3', ratio: 4 / 3 },
    { id: '16:9', label: '16:9 (Широкий)', badge: 'Широкий 16:9', ratio: 16 / 9 },
    { id: 'free', label: 'Свободный', badge: 'Произвольный размер', ratio: null },
  ];

  const currentBadge = FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.badge || 'Кадрирование';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Move className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg leading-tight font-bold text-stone-900">
                Кадрирование и центровка фото
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500">
                Фото видно целиком. Выберите формат под размер вашего снимка
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors shrink-0 cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Canvas (Full photo visible + Interactive Crop Frame) */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-stone-900 p-2 sm:p-4 flex items-center justify-center overflow-hidden select-none min-h-[340px] sm:min-h-[420px]"
        >
          {/* Main Image (Centered and contained inside view) */}
          <img
            ref={imgRef}
            src={photoUrl}
            alt="Котик для подгонки"
            crossOrigin="anonymous"
            onLoad={updateLayout}
            draggable={false}
            style={{
              maxWidth: rotation === 90 || rotation === 270 ? '70%' : '92%',
              maxHeight: rotation === 90 || rotation === 270 ? '70%' : '88%',
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            className="object-contain pointer-events-none drop-shadow-xl rounded-lg"
          />

          {/* Dark Overlay with Transparent Cutout for Crop Frame */}
          {imgDisplayRect.width > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ width: '100%', height: '100%' }}
            >
              <defs>
                <mask id="crop-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect
                    x={cropBox.x}
                    y={cropBox.y}
                    width={cropBox.width}
                    height={cropBox.height}
                    rx="8"
                    ry="8"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="rgba(0, 0, 0, 0.65)"
                mask="url(#crop-mask)"
              />
            </svg>
          )}

          {/* Interactive Crop Box Overlay */}
          {imgDisplayRect.width > 0 && (
            <div
              style={{
                left: `${cropBox.x}px`,
                top: `${cropBox.y}px`,
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
              }}
              onMouseDown={(e) => startDrag(e, 'move')}
              onTouchStart={(e) => startDrag(e, 'move')}
              className="absolute border-2 border-amber-400 rounded-lg shadow-2xl cursor-move touch-none select-none"
            >
              {/* Rule-of-Thirds Grid */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-40">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>

              {/* Corner Handles */}
              <div
                onMouseDown={(e) => startDrag(e, 'nw')}
                onTouchStart={(e) => startDrag(e, 'nw')}
                className="absolute -top-2.5 -left-2.5 w-6 h-6 bg-white border-2 border-amber-500 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => startDrag(e, 'ne')}
                onTouchStart={(e) => startDrag(e, 'ne')}
                className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-white border-2 border-amber-500 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => startDrag(e, 'sw')}
                onTouchStart={(e) => startDrag(e, 'sw')}
                className="absolute -bottom-2.5 -left-2.5 w-6 h-6 bg-white border-2 border-amber-500 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => startDrag(e, 'se')}
                onTouchStart={(e) => startDrag(e, 'se')}
                className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-white border-2 border-amber-500 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              />

              {/* Format Badge overlay on top of frame */}
              <div className="absolute top-2 left-2 bg-stone-900/85 backdrop-blur-sm text-white/95 text-[11px] font-bold px-2.5 py-0.5 rounded-md pointer-events-none flex items-center gap-1 shadow-sm border border-white/10">
                <span>{currentBadge}</span>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar & Controls */}
        <div className="p-3 sm:p-4 border-t border-stone-100 bg-stone-50 space-y-3">
          {/* Formats Scrollable Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                Формат кадрирования:
              </span>
              <span className="text-[11px] font-semibold text-amber-700">
                {selectedFormat === 'original'
                  ? 'Оригинал (без обрезки по краям)'
                  : selectedFormat === '3:4'
                  ? '3:4 (Идеально для вертикальных фото котика)'
                  : selectedFormat === '9:16'
                  ? '9:16 (Вертикальное фото в полный рост)'
                  : selectedFormat === 'free'
                  ? 'Свободный размер рамки'
                  : ''}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {FORMAT_OPTIONS.map((opt) => {
                const isSelected = selectedFormat === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectFormat(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30 ring-2 ring-amber-300'
                        : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Framing Tools: Zoom In / Zoom Out / Maximize / Rotate */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-stone-200/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleScaleCropBox(0.85)}
                className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
                title="Приблизить мордочку (уменьшить рамку)"
              >
                <ZoomIn className="w-4 h-4 text-amber-600" />
              </button>

              <button
                type="button"
                onClick={() => handleScaleCropBox(1.15)}
                className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
                title="Отдалить (увеличить рамку)"
              >
                <ZoomOut className="w-4 h-4 text-stone-600" />
              </button>

              <button
                type="button"
                onClick={handleMaximizeCropBox}
                className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="Растянуть рамку на всю фотографию"
              >
                <Maximize2 className="w-4 h-4 text-stone-600" />
                <span className="hidden sm:inline">Во всю высоту</span>
              </button>

              <button
                type="button"
                onClick={handleRotate}
                className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="Повернуть фото на 90°"
              >
                <RotateCw className="w-4 h-4 text-stone-600" />
                <span className="hidden sm:inline">Повернуть</span>
              </button>

              <button
                type="button"
                onClick={handleAlignToHead}
                className="p-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="Автоматически навести рамку на голову и ушки котика"
              >
                <span>🐱</span>
                <span>Голова в кадре</span>
              </button>
              <button
                type="button"
                onClick={updateLayout}
                className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
                title="Сбросить в центр"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-100 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{isProcessing ? 'Кадрирование...' : 'Применить подгонку'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
