"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Square, Circle, Move, Trash2, Minus, Type } from 'lucide-react';

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [elements, setElements] = useState<any[]>([]);
  const [currentElement, setCurrentElement] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const textInputRef = useRef<HTMLInputElement>(null);

  const colors = [
    '#000000', '#EF4444', '#F59E0B', '#10B981', 
    '#3B82F6', '#8B5CF6', '#EC4899', '#ffffff'
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw all elements
    elements.forEach(el => drawElement(ctx, el));
    
    // Draw current element being created
    if (currentElement) {
      drawElement(ctx, currentElement);
    }
  }, [elements, currentElement]);

  // Focus text input when it appears
  useEffect(() => {
    if (isTyping && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 10);
    }
  }, [isTyping]);

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

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle text tool separately
    if (tool === 'text') {
      const pos = getMousePos(e);
      setTextPosition(pos);
      setIsTyping(true);
      setTextInput('');
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select' || tool === 'text') return;
    
    const pos = getMousePos(e);
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
    if (!isDrawing || !currentElement) return;
    
    const pos = getMousePos(e);
    
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
    if (isDrawing && currentElement) {
      setElements([...elements, currentElement]);
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
      setElements([...elements, newTextElement]);
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
    // Small delay to allow click events to process
    setTimeout(() => {
      if (isTyping) {
        handleTextSubmit();
      }
    }, 100);
  };

  const clearCanvas = () => {
    setElements([]);
    setCurrentElement(null);
    setIsTyping(false);
    setTextInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <button
          onClick={() => setTool('select')}
          className={`p-2 rounded transition-colors ${
            tool === 'select' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Select"
        >
          <Move size={20} />
        </button>
        <button
          onClick={() => setTool('pencil')}
          className={`p-2 rounded transition-colors ${
            tool === 'pencil' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Pencil"
        >
          <Pencil size={20} />
        </button>
        <button
          onClick={() => setTool('line')}
          className={`p-2 rounded transition-colors ${
            tool === 'line' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Line"
        >
          <Minus size={20} />
        </button>
        <button
          onClick={() => setTool('rectangle')}
          className={`p-2 rounded transition-colors ${
            tool === 'rectangle' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Rectangle"
        >
          <Square size={20} />
        </button>
        <button
          onClick={() => setTool('circle')}
          className={`p-2 rounded transition-colors ${
            tool === 'circle' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Circle"
        >
          <Circle size={20} />
        </button>
        <button
          onClick={() => {
            setTool('text');
            setIsTyping(false); // Reset typing state when selecting text tool
          }}
          className={`p-2 rounded transition-colors ${
            tool === 'text' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Text"
        >
          <Type size={20} />
        </button>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
        
        {/* Color Picker */}
        <div className="flex items-center gap-2">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                color === c ? 'border-blue-500 dark:border-blue-400 scale-110' : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
        
        <button
          onClick={clearCanvas}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          title="Clear Canvas"
        >
          <Trash2 size={20} />
        </button>

        {/* Tool indicator */}
        <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
          Current tool: <span className="font-semibold capitalize">{tool}</span>
          {tool === 'text' && ' (Click on canvas to add text)'}
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 overflow-auto relative bg-gray-100 dark:bg-gray-900 p-4">
        <div 
          ref={canvasContainerRef}
          className="relative inline-block"
        >
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className={`bg-white shadow-lg ${
              tool === 'text' ? 'cursor-text' : 
              tool === 'select' ? 'cursor-move' : 
              'cursor-crosshair'
            }`}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          
          {/* Text Input Overlay */}
          {isTyping && (
            <div
              className="absolute"
              style={{
                left: `${textPosition.x}px`,
                top: `${textPosition.y - 10}px`,
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
                className="border-2 border-blue-500 px-2 py-1 outline-none bg-white dark:bg-gray-800 dark:text-white rounded shadow-lg"
                style={{
                  color: color === '#ffffff' ? '#000000' : color,
                  fontSize: '20px',
                  minWidth: '200px'
                }}
                placeholder="Type text and press Enter..."
                autoFocus
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Press Enter to confirm, Esc to cancel
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}