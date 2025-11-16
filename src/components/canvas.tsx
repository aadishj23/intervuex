"use client";

import React, { useState, useRef, useEffect } from "react";
import { Pencil, Square, Circle, Move, Trash2, Minus, Type, Eraser, Undo, Redo } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCall } from "@stream-io/video-react-sdk";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";

type DrawingCanvasProps = {
  className?: string;
  isActive?: boolean;
  isEmbedded?: boolean;
};

export default function DrawingCanvas({ className, isActive = true, isEmbedded = false }: DrawingCanvasProps) {
  const call = useCall();
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [isDrawing, setIsDrawing] = useState(false);
  const [elements, setElements] = useState<any[]>([]);
  const [currentElement, setCurrentElement] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const textInputRef = useRef<HTMLInputElement>(null);
  
  // Selection state
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // History state for undo/redo
  const [history, setHistory] = useState<any[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);
  
  // Eraser state
  const [eraserPath, setEraserPath] = useState<{ x: number; y: number }[]>([]);

  // Convex sync
  const streamCallId = call?.id || "";
  const canvasState = useQuery(api.canvas.getCanvasStateByCallId, streamCallId ? { streamCallId } : "skip");
  const upsertCanvas = useMutation(api.canvas.upsertCanvasState);

  const colors = [
    "#000000",
    "#EF4444",
    "#F59E0B",
    "#10B981",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
    "#ffffff",
  ];

  // Load canvas state from database when joining
  useEffect(() => {
    if (!canvasState || !streamCallId) return;
    // Ignore echoes from our own updates
    if (canvasState.updatedBy && user?.id && canvasState.updatedBy === user.id) return;
    
    try {
      const loadedElements = JSON.parse(canvasState.elements);
      if (Array.isArray(loadedElements) && JSON.stringify(loadedElements) !== JSON.stringify(elements)) {
        setElements(loadedElements);
        // Update history with loaded elements
        const newHistory = [...history, loadedElements];
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
      }
    } catch (e) {
      console.error("Failed to parse canvas state:", e);
    }
  }, [canvasState, user?.id, streamCallId]);

  // Update history when elements change (but not from undo/redo)
  const updateHistory = (newElements: any[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    setElements(newElements);
    
    // Sync to database
    if (streamCallId) {
      void upsertCanvas({
        streamCallId,
        elements: JSON.stringify(newElements),
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Clear canvas with white background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw all elements
    elements.forEach((el, index) => {
      drawElement(ctx, el);
      // Draw selection border if element is selected
      if (index === selectedElement) {
        drawSelectionBorder(ctx, el);
      }
    });
    
    // Draw current element being created
    if (currentElement) {
      drawElement(ctx, currentElement);
    }
  }, [elements, currentElement, selectedElement]);

  // Focus text input when it appears
  useEffect(() => {
    if (isTyping && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 10);
    }
  }, [isTyping]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && !isTyping) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y or Cmd+Y or Ctrl+Shift+Z or Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        if (!isTyping) {
          e.preventDefault();
          redo();
        }
      }
      // Delete selected element
      if ((e.key === "Delete" || e.key === "Backspace") && selectedElement !== null && !isTyping) {
        deleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [historyStep, history, selectedElement, isTyping, isActive]);

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      setElements(history[newStep]);
      setSelectedElement(null);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      setElements(history[newStep]);
      setSelectedElement(null);
    }
  };

  const drawSelectionBorder = (ctx: CanvasRenderingContext2D, element: any) => {
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    const bounds = getElementBounds(element);
    if (bounds) {
      ctx.strokeRect(
        bounds.x - 5,
        bounds.y - 5,
        bounds.width + 10,
        bounds.height + 10
      );
    }
    
    ctx.setLineDash([]);
  };

  const getElementBounds = (element: any) => {
    switch (element.type) {
      case 'pencil':
        if (!element.points || element.points.length === 0) return null;
        let minX = element.points[0].x;
        let minY = element.points[0].y;
        let maxX = element.points[0].x;
        let maxY = element.points[0].y;
        
        element.points.forEach((point: any) => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
        
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      
      case 'line':
        return {
          x: Math.min(element.x1, element.x2),
          y: Math.min(element.y1, element.y2),
          width: Math.abs(element.x2 - element.x1),
          height: Math.abs(element.y2 - element.y1)
        };
      
      case 'rectangle':
        return {
          x: element.x,
          y: element.y,
          width: Math.abs(element.width),
          height: Math.abs(element.height)
        };
      
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(element.x2 - element.x1, 2) + 
          Math.pow(element.y2 - element.y1, 2)
        );
        return {
          x: element.x1 - radius,
          y: element.y1 - radius,
          width: radius * 2,
          height: radius * 2
        };
      
      case 'text':
        const textWidth = element.text.length * 12;
        const textHeight = element.fontSize || 20;
        return {
          x: element.x,
          y: element.y - textHeight,
          width: textWidth,
          height: textHeight
        };
      
      default:
        return null;
    }
  };

  const isPointInElement = (point: { x: number; y: number }, element: any) => {
    const bounds = getElementBounds(element);
    if (!bounds) return false;
    
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  };

  const isPathIntersectingElement = (path: {x: number, y: number}[], element: any) => {
    // Check if any point in the eraser path intersects with the element
    const bounds = getElementBounds(element);
    if (!bounds) return false;
    
    // Expand bounds for eraser width (20px)
    const expandedBounds = {
      x: bounds.x - 10,
      y: bounds.y - 10,
      width: bounds.width + 20,
      height: bounds.height + 20
    };
    
    return path.some(point => 
      point.x >= expandedBounds.x &&
      point.x <= expandedBounds.x + expandedBounds.width &&
      point.y >= expandedBounds.y &&
      point.y <= expandedBounds.y + expandedBounds.height
    );
  };

  const findElementAtPoint = (point: { x: number; y: number }) => {
    // Search from top to bottom (last drawn element first)
    for (let i = elements.length - 1; i >= 0; i--) {
      if (isPointInElement(point, elements[i])) {
        return i;
      }
    }
    return null;
  };

  const moveElement = (element: any, dx: number, dy: number) => {
    const movedElement = { ...element };
    
    switch (element.type) {
      case 'pencil':
        movedElement.points = element.points.map((point: any) => ({
          x: point.x + dx,
          y: point.y + dy
        }));
        break;
      
      case 'line':
        movedElement.x1 += dx;
        movedElement.y1 += dy;
        movedElement.x2 += dx;
        movedElement.y2 += dy;
        break;
      
      case 'rectangle':
        movedElement.x += dx;
        movedElement.y += dy;
        break;
      
      case 'circle':
        movedElement.x1 += dx;
        movedElement.y1 += dy;
        movedElement.x2 += dx;
        movedElement.y2 += dy;
        break;
      
      case 'text':
        movedElement.x += dx;
        movedElement.y += dy;
        break;
    }
    
    return movedElement;
  };

  const drawElement = (ctx: CanvasRenderingContext2D, element: any) => {
    ctx.strokeStyle = element.color || '#000';
    ctx.fillStyle = element.color || '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element.type) {
      case 'pencil':
        if (element.points && element.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          element.points.forEach((point: any) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
        break;
      
      case 'line':
        ctx.beginPath();
        ctx.moveTo(element.x1, element.y1);
        ctx.lineTo(element.x2, element.y2);
        ctx.stroke();
        break;
      
      case 'rectangle':
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        break;
      
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(element.x2 - element.x1, 2) + 
          Math.pow(element.y2 - element.y1, 2)
        );
        ctx.beginPath();
        ctx.arc(element.x1, element.y1, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      
      case 'text':
        ctx.font = `${element.fontSize || 20}px Arial`;
        ctx.fillText(element.text, element.x, element.y);
        break;
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Get client coordinates (works for both mouse and touch)
    const clientX = 'touches' in e && e.touches.length > 0 
      ? e.touches[0].clientX 
      : 'clientX' in e 
        ? e.clientX 
        : 0;
    const clientY = 'touches' in e && e.touches.length > 0 
      ? e.touches[0].clientY 
      : 'clientY' in e 
        ? e.clientY 
        : 0;
    
    // Calculate the scale factor between displayed size and internal canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get relative position and scale to canvas coordinates
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text') {
      const pos = getMousePos(e);
      setTextPosition(pos);
      setIsTyping(true);
      setTextInput('');
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (tool === 'text') {
      const pos = getMousePos(e);
      setTextPosition(pos);
      setIsTyping(true);
      setTextInput('');
      return;
    }
    // Convert touch event to mouse-like event for drawing
    const touch = e.touches[0];
    const mouseEvent = {
      ...e,
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    handleMouseDown(mouseEvent);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    if (tool === 'select') {
      const elementIndex = findElementAtPoint(pos);
      setSelectedElement(elementIndex);
      
      if (elementIndex !== null) {
        const element = elements[elementIndex];
        const bounds = getElementBounds(element);
        if (bounds) {
          setDragOffset({
            x: pos.x - bounds.x,
            y: pos.y - bounds.y
          });
          setIsDragging(true);
        }
      }
      return;
    }
    
    if (tool === 'eraser') {
      setIsDrawing(true);
      setEraserPath([pos]);
      return;
    }
    
    if (tool === 'text') return;
    
    setSelectedElement(null);
    setIsDrawing(true);
    
    if (tool === 'pencil') {
      setCurrentElement({
        type: 'pencil',
        points: [pos],
        color: color
      });
    } else {
      setCurrentElement({
        type: tool,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color: color
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    // Handle dragging selected element
    if (tool === 'select' && isDragging && selectedElement !== null) {
      const element = elements[selectedElement];
      const bounds = getElementBounds(element);
      if (bounds) {
        const dx = pos.x - dragOffset.x - bounds.x;
        const dy = pos.y - dragOffset.y - bounds.y;
        
        const updatedElements = [...elements];
        updatedElements[selectedElement] = moveElement(element, dx, dy);
        setElements(updatedElements);
      }
      return;
    }
    
    // Handle eraser
    if (tool === 'eraser' && isDrawing) {
      setEraserPath([...eraserPath, pos]);
      
      // Check for elements to erase
      const elementsToKeep = elements.filter(element => 
        !isPathIntersectingElement(eraserPath, element)
      );
      
      if (elementsToKeep.length !== elements.length) {
        setElements(elementsToKeep);
      }
      return;
    }
    
    if (!isDrawing || !currentElement) return;
    
    if (tool === 'pencil') {
      setCurrentElement({
        ...currentElement,
        points: [...currentElement.points, pos]
      });
    } else if (tool === 'rectangle') {
      setCurrentElement({
        ...currentElement,
        width: pos.x - currentElement.x1,
        height: pos.y - currentElement.y1
      });
    } else {
      setCurrentElement({
        ...currentElement,
        x2: pos.x,
        y2: pos.y,
        width: pos.x - currentElement.x1,
        height: pos.y - currentElement.y1
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // Save state after moving element
      if (selectedElement !== null) {
        updateHistory(elements);
      }
    }
    
    if (tool === 'eraser' && isDrawing) {
      setIsDrawing(false);
      setEraserPath([]);
      // Save state after erasing
      updateHistory(elements);
      return;
    }
    
    if (isDrawing && currentElement) {
      const newElements = [...elements, currentElement];
      updateHistory(newElements);
      setCurrentElement(null);
    }
    setIsDrawing(false);
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      const newTextElement = {
        type: 'text',
        text: textInput,
        x: textPosition.x,
        y: textPosition.y,
        color: color,
        fontSize: 20
      };
      const newElements = [...elements, newTextElement];
      updateHistory(newElements);
    }
    setIsTyping(false);
    setTextInput('');
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTextSubmit();
    }
    if (e.key === 'Escape') {
      setIsTyping(false);
      setTextInput('');
    }
  };

  const handleTextBlur = () => {
    setTimeout(() => {
      if (isTyping) {
        handleTextSubmit();
      }
    }, 100);
  };

  const clearCanvas = () => {
    const newElements: any[] = [];
    updateHistory(newElements);
    setCurrentElement(null);
    setIsTyping(false);
    setTextInput('');
    setSelectedElement(null);
  };

  const deleteSelected = () => {
    if (selectedElement !== null) {
      const updatedElements = elements.filter((_, index) => index !== selectedElement);
      updateHistory(updatedElements);
      setSelectedElement(null);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-gray-50 dark:bg-gray-900",
        isEmbedded ? "h-full" : (className ?? "h-screen min-h-[540px]")
      )}
      aria-hidden={!isActive}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-2 p-2 sm:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Undo/Redo buttons */}
        <button
          onClick={undo}
          disabled={historyStep === 0}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            historyStep === 0
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={18} className="sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={redo}
          disabled={historyStep === history.length - 1}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            historyStep === history.length - 1
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Redo (Ctrl+Y)"
        >
          <Redo size={18} className="sm:w-5 sm:h-5" />
        </button>
        
        <div className="hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
        
        <button
          onClick={() => {
            setTool('select');
            setSelectedElement(null);
          }}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            tool === 'select' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Select & Move"
        >
          <Move size={18} className="sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={() => {
            setTool('pencil');
            setSelectedElement(null);
          }}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            tool === 'pencil' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Pencil"
        >
          <Pencil size={18} className="sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={() => {
            setTool('eraser');
            setSelectedElement(null);
          }}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            tool === 'eraser' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Eraser"
        >
          <Eraser size={18} className="sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={() => {
            setTool('line');
            setSelectedElement(null);
          }}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            tool === 'line' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Line"
        >
          <Minus size={18} className="sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={() => {
            setTool('rectangle');
            setSelectedElement(null);
          }}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            tool === 'rectangle' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Rectangle"
        >
          <Square size={18} className="sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={() => {
            setTool('circle');
            setSelectedElement(null);
          }}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            tool === 'circle' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Circle"
        >
          <Circle size={18} className="sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={() => {
            setTool('text');
            setIsTyping(false);
            setSelectedElement(null);
          }}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            tool === 'text' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Text"
        >
          <Type size={18} className="sm:w-5 sm:h-5" />
        </button>
        
        <div className="hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
        
        {/* Color Picker - disabled for eraser */}
        <div className="flex items-center gap-1 sm:gap-2">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              disabled={tool === 'eraser'}
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded border-2 hover:scale-110 transition-transform ${
                tool === 'eraser' ? 'opacity-50 cursor-not-allowed' :
                color === c ? 'border-blue-500 dark:border-blue-400 scale-110' : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: c }}
              title={tool === 'eraser' ? 'Color disabled for eraser' : c}
            />
          ))}
        </div>
        
        <div className="hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
        
        <button
          onClick={clearCanvas}
          className="p-1.5 sm:p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          title="Clear Canvas"
        >
          <Trash2 size={18} className="sm:w-5 sm:h-5" />
        </button>

        {/* Delete Selected button */}
        {selectedElement !== null && (
          <>
            <div className="hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
            <button
              onClick={deleteSelected}
              className="px-2 py-1 sm:px-3 sm:py-1.5 rounded bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm transition-colors"
              title="Delete Selected (or press Delete key)"
            >
              <span className="hidden sm:inline">Delete Selected</span>
              <span className="sm:hidden">Delete</span>
            </button>
          </>
        )}

        {/* Tool indicator */}
        <div className="hidden md:flex ml-auto text-sm text-gray-600 dark:text-gray-400 items-center gap-2">
          <span className="font-semibold capitalize">{tool}</span>
          {tool === 'text' && <span className="text-xs">Click canvas to add text</span>}
          {tool === 'select' && <span className="text-xs">Click to select, drag to move</span>}
          {tool === 'eraser' && <span className="text-xs">Click and drag to erase</span>}
          {selectedElement !== null && <span className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">Element selected</span>}
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 overflow-auto relative bg-gray-100 dark:bg-gray-900 p-2 sm:p-4">
        <div 
          ref={canvasContainerRef}
          className="relative inline-block w-full h-full"
        >
          <canvas
            ref={canvasRef}
            width={isEmbedded ? 1600 : 1920}
            height={isEmbedded ? 900 : 1080}
            className={`bg-white shadow-lg ${isEmbedded ? 'w-full h-full' : ''} ${
              tool === 'text' ? 'cursor-text' : 
              tool === 'select' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') :
              tool === 'eraser' ? 'cursor-cell' : 
              'cursor-crosshair'
            }`}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              const mouseEvent = {
                ...e,
                clientX: touch.clientX,
                clientY: touch.clientY,
              } as React.MouseEvent<HTMLCanvasElement>;
              handleMouseMove(mouseEvent);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleMouseUp();
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              handleMouseUp();
            }}
          />
          
          {/* Text Input Overlay */}
          {isTyping && (() => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            
            // Convert canvas coordinates back to display coordinates
            const scaleX = rect.width / canvas.width;
            const scaleY = rect.height / canvas.height;
            const displayX = textPosition.x * scaleX;
            const displayY = textPosition.y * scaleY;
            
            return (
              <div
                className="absolute"
                style={{
                  left: `${displayX}px`,
                  top: `${displayY - 10}px`,
                  zIndex: 50
                }}
              >
                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={handleTextKeyDown}
                  onBlur={handleTextBlur}
                  className="border-2 border-blue-500 px-3 py-2 outline-none bg-white text-gray-900 rounded-md shadow-xl text-sm sm:text-base backdrop-blur-sm"
                  style={{
                    color: color === '#ffffff' ? '#000000' : color,
                    fontSize: '16px',
                    minWidth: '150px',
                    maxWidth: '90vw'
                  }}
                  placeholder="Type text..."
                  autoFocus
                />
                <div className="hidden sm:block text-xs text-gray-500 mt-1 bg-white/90 px-2 py-1 rounded backdrop-blur-sm">
                  Press Enter to confirm, Esc to cancel
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Instructions Panel */}
      {!isEmbedded && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-2 sm:px-4 py-2">
          <div className="text-xs text-gray-600 dark:text-gray-400 flex gap-2 sm:gap-4 flex-wrap">
            <span className="hidden sm:inline">• <strong>Undo/Redo:</strong> Ctrl+Z / Ctrl+Y</span>
            <span>• <strong>Select:</strong> Click to select &amp; drag</span>
            <span className="hidden sm:inline">• <strong>Eraser:</strong> Click and drag to erase</span>
            <span>• <strong>Delete:</strong> Press Delete key</span>
            <span className="hidden md:inline">• <strong>Draw:</strong> Click and drag with tools</span>
            <span className="hidden md:inline">• <strong>Text:</strong> Click to place text</span>
          </div>
        </div>
      )}
    </div>
  );
}