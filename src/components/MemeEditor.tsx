import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Type, Square, Circle, RotateCcw, Upload, Trash2, AlignLeft, Layers, Image as ImageIcon, Video, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Template } from "./Dashboard";
import { Canvas as FabricCanvas, Textbox, Rect, Circle as FabricCircle, FabricImage } from "fabric";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FONT_OPTIONS = [
  "Arial", "Arial Black", "Comic Sans MS", "Courier New", "Georgia", "Impact", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"
];

function getElementTypeIcon(type: string) {
  if (type === "textbox") return <AlignLeft className="w-4 h-4" />;
  if (type === "rect") return <Square className="w-4 h-4" />;
  if (type === "circle") return <Circle className="w-4 h-4" />;
  if (type === "image") return <ImageIcon className="w-4 h-4" />;
  if (type === "video") return <Video className="w-4 h-4" />;
  return <Layers className="w-4 h-4" />;
}

function getElementLabel(obj: any) {
  if (obj.type === "textbox") return "Text";
  if (obj.type === "rect") return "Box";
  if (obj.type === "circle") return "Circle";
  if (obj.type === "image") return obj?.originalFileName || "Image";
  if (obj.type === "video") return obj?.originalFileName || "Video";
  return obj.type;
}

function SortableElementItem({ id, obj, isActive, onSelect }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isActive ? "var(--accent)" : "var(--card)",
    border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "grab",
    boxShadow: isDragging ? "0 2px 8px rgba(0,0,0,0.08)" : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => onSelect(obj)}>
      {getElementTypeIcon(obj.type)}
      <span className="text-xs font-medium text-muted-foreground">{getElementLabel(obj)}</span>
    </div>
  );
}

interface MemeEditorProps {
  template: Template;
  onBack: () => void;
}

export const MemeEditor = ({ template, onBack }: MemeEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [color, setColor] = useState("#000000");
  const [font, setFont] = useState(FONT_OPTIONS[0]);
  const [elements, setElements] = useState<any[]>([]);
  const [pendingImageUploads, setPendingImageUploads] = useState<{[key: string]: File}>({});
  const [originalTemplateData, setOriginalTemplateData] = useState<any>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 400, height: 400 });
  const [videoElements, setVideoElements] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(0);

  // DnD-kit setup
  const sensors = useSensors(useSensor(PointerSensor));

  // Get canvas dimensions from template data or use defaults
  const getCanvasDimensions = () => {
    if (template.layout_definition?.canvas) {
      return {
        width: template.layout_definition.canvas.width || 400,
        height: template.layout_definition.canvas.height || 400
      };
    }
    
    // Fallback to default dimensions
    if (template.type === 'video') {
      return { width: 400, height: 711 }; // 9:16 ratio scaled down
    }
    return { width: 400, height: 400 }; // 1:1 ratio
  };

  // Create fabric object from element data with EXACT positioning and sizing
  const createElementFromData = async (elementData: any) => {
    if (!fabricCanvas) return;

    try {
      switch (elementData.type) {
        case 'textbox':
          const textbox = new Textbox(elementData.text || 'Sample Text', {
            left: elementData.x || 0,
            top: elementData.y || 0,
            fontSize: elementData.fontSize || 16,
            fill: elementData.color || '#000000',
            fontFamily: elementData.fontFamily || 'Arial',
            width: elementData.width || 200,
            // Preserve exact text box properties
            splitByGrapheme: false,
            editable: true
          });
          fabricCanvas.add(textbox);
          break;

        case 'rect':
          const rect = new Rect({
            left: elementData.x || 0,
            top: elementData.y || 0,
            fill: elementData.fill || '#ffffff',
            width: elementData.width || 100,
            height: elementData.height || 60,
            stroke: elementData.strokeColor || '#000000',
            strokeWidth: elementData.strokeWidth || 1,
          });
          fabricCanvas.add(rect);
          break;

        case 'circle':
          const circle = new FabricCircle({
            left: elementData.x || 0,
            top: elementData.y || 0,
            fill: elementData.fill || '#ffffff',
            radius: elementData.radius || 50,
            stroke: elementData.strokeColor || '#000000',
            strokeWidth: elementData.strokeWidth || 1,
          });
          fabricCanvas.add(circle);
          break;

        case 'image':
          if (elementData.imageUrl) {
            try {
              // FIX: Add crossOrigin option to prevent canvas tainting
              const img = await FabricImage.fromURL(elementData.imageUrl, { crossOrigin: 'anonymous' });
              
              // Set exact position
              img.set({
                left: elementData.x || 0,
                top: elementData.y || 0,
                crossOrigin: 'anonymous'
              });
              
              // Scale to EXACT original dimensions
              if (elementData.width && elementData.height) {
                const scaleX = elementData.width / (img.width || 1);
                const scaleY = elementData.height / (img.height || 1);
                img.set({
                  scaleX: scaleX,
                  scaleY: scaleY
                });
              }
              
              fabricCanvas.add(img);
            } catch (error) {
              console.error('Error loading image element:', error);
              toast.error(`Failed to load image: ${elementData.imageUrl}`);
            }
          }
          break;

        case 'video':
          // Create video element as canvas object (similar to image)
          if (elementData.videoUrl) {
            try {
              // Create a video element for playback
              const video = document.createElement('video');
              video.src = elementData.videoUrl;
              video.crossOrigin = 'anonymous';
              video.muted = true;
              video.loop = false;
              
              video.onloadeddata = () => {
                const videoCanvas = document.createElement('canvas');
                videoCanvas.width = video.videoWidth || 400;
                videoCanvas.height = video.videoHeight || 300;
                const ctx = videoCanvas.getContext('2d');
                
                // Draw first frame
                video.currentTime = 0;
                video.oncanplaythrough = () => {
                  ctx?.drawImage(video, 0, 0);
                  
                  // Create fabric image from video frame
                  FabricImage.fromURL(videoCanvas.toDataURL(), { crossOrigin: 'anonymous' }).then((img: any) => {
                    img.set({
                      left: elementData.x || 0,
                      top: elementData.y || 0,
                      crossOrigin: 'anonymous'
                    });
                    
                    // Scale to EXACT dimensions
                    if (elementData.width && elementData.height) {
                      const scaleX = elementData.width / (img.width || 1);
                      const scaleY = elementData.height / (img.height || 1);
                      img.set({
                        scaleX: scaleX,
                        scaleY: scaleY
                      });
                    }
                    
                    // Mark as video element and attach video for playback
                    img.isVideo = true;
                    img.videoDuration = elementData.duration;
                    img.videoUrl = elementData.videoUrl;
                    img.originalFileName = elementData.originalFileName;
                    img.videoElement = video; // Store actual video element for playback
                    
                    fabricCanvas.add(img);
                    setMaxDuration(prev => Math.max(prev, elementData.duration || 0));
                  });
                };
              };
            } catch (error) {
              console.error('Error loading video element:', error);
              toast.error(`Failed to load video: ${elementData.videoUrl}`);
            }
          }
          break;

        default:
          console.warn('Unknown element type:', elementData.type);
      }
    } catch (error) {
      console.error('Error creating element:', error);
    }
  };

  // Load template data and recreate canvas with EXACT positioning
  const loadTemplateData = async () => {
    if (!fabricCanvas || !template.layout_definition) return;

    try {
      setLoading(true);
      
      const layoutDef = template.layout_definition;
      
      // Store original template data for reset functionality
      setOriginalTemplateData(layoutDef);
      
      // Clear canvas completely
      fabricCanvas.clear();
      fabricCanvas.backgroundColor = '#ffffff';
      
      // Set exact canvas dimensions first
      const dimensions = getCanvasDimensions();
      fabricCanvas.setWidth(dimensions.width);
      fabricCanvas.setHeight(dimensions.height);
      setCanvasDimensions(dimensions);
      
      // Set canvas background color
      if (layoutDef.canvas?.backgroundColor) {
        fabricCanvas.backgroundColor = layoutDef.canvas.backgroundColor;
      }
      
      // Set background image if exists
      if (layoutDef.canvas?.backgroundImage) {
        try {
          // FIX: Add crossOrigin option to prevent canvas tainting
          const img = await FabricImage.fromURL(layoutDef.canvas.backgroundImage, { crossOrigin: 'anonymous' });
          // Scale background image to EXACT canvas dimensions
          img.set({
            scaleX: dimensions.width / (img.width || 1),
            scaleY: dimensions.height / (img.height || 1),
            crossOrigin: 'anonymous'
          });
          fabricCanvas.backgroundImage = img;
        } catch (error) {
          console.error('Error loading background image:', error);
          toast.error('Failed to load background image');
        }
      }
      
      // Wait a moment for canvas to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reset video elements
      setVideoElements([]);
      setMaxDuration(0);
      
      // Recreate all elements with EXACT positioning and sizing
      if (layoutDef.elements && Array.isArray(layoutDef.elements)) {
        for (const elementData of layoutDef.elements) {
          await createElementFromData(elementData);
        }
      }
      
      // Set max duration from layout definition
      if (layoutDef.maxDuration) {
        setMaxDuration(layoutDef.maxDuration);
      }
      
      // Force canvas to render with exact dimensions
      fabricCanvas.renderAll();
      fabricCanvas.calcOffset();
      
      setElements([...fabricCanvas.getObjects()]);
      toast.success(`Template "${template.name}" loaded!`);
      
    } catch (error) {
      console.error('Error loading template data:', error);
      toast.error("Failed to load template data");
    } finally {
      setLoading(false);
    }
  };

  // Initialize canvas with EXACT template dimensions
  const initializeCanvas = () => {
    if (!canvasRef.current) return;

    const dimensions = getCanvasDimensions();
    setCanvasDimensions(dimensions);
    
    // Create canvas with EXACT template dimensions
    const canvas = new FabricCanvas(canvasRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true, // Maintain object order
    });

    setFabricCanvas(canvas);

    // Selection event listeners
    canvas.on("selection:created", (e) => {
      setSelectedObject(e.selected?.[0] || null);
    });
    canvas.on("selection:updated", (e) => {
      setSelectedObject(e.selected?.[0] || null);
    });
    canvas.on("selection:cleared", () => {
      setSelectedObject(null);
    });

    // Track all elements on canvas
    canvas.on("object:added", () => {
      setElements([...canvas.getObjects()]);
    });
    canvas.on("object:removed", () => {
      setElements([...canvas.getObjects()]);
    });
    canvas.on("object:modified", () => {
      setElements([...canvas.getObjects()]);
    });

    return () => {
      canvas.dispose();
    };
  };

  // Initialize canvas with template dimensions on mount
  useEffect(() => {
    const cleanup = initializeCanvas();
    return cleanup;
  }, [template]);

  // Load template data when canvas is ready
  useEffect(() => {
    if (fabricCanvas) {
      loadTemplateData();
    }
  }, [fabricCanvas]);

  // Keep elements in sync if canvas changes
  useEffect(() => {
    if (fabricCanvas) setElements([...fabricCanvas.getObjects()]);
  }, [fabricCanvas]);

  // Update color/font state when object is selected
  useEffect(() => {
    if (!selectedObject) return;
    if (selectedObject.type === "textbox" || selectedObject.type === "rect" || selectedObject.type === "circle") {
      setColor(selectedObject.fill || "#000000");
    }
    if (selectedObject.type === "textbox") {
      setFont(selectedObject.fontFamily || FONT_OPTIONS[0]);
    }
  }, [selectedObject]);

  // Check if canvas has video elements
  const hasVideoElements = () => {
    if (!fabricCanvas) return false;
    return fabricCanvas.getObjects().some((obj: any) => obj.isVideo);
  };

  // Multi-image upload handler
  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvas) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        // FIX: Add crossOrigin option to prevent canvas tainting
        FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img: any) => {
          img.set({ 
            left: 50, 
            top: 50, 
            scaleX: 0.5, 
            scaleY: 0.5,
            crossOrigin: 'anonymous'
          });
          
          // Store original file and filename
          const imageId = `image_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          img.imageId = imageId;
          img.originalFileName = file.name;
          
          // Store the file
          setPendingImageUploads(prev => ({
            ...prev,
            [imageId]: file
          }));
          
          fabricCanvas.add(img);
          fabricCanvas.setActiveObject(img);
          setElements([...fabricCanvas.getObjects()]);
        }).catch((error) => {
          console.error('Error loading uploaded image:', error);
          toast.error(`Failed to load uploaded image: ${file.name}`);
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // Delete selected object
  const handleDelete = () => {
    if (fabricCanvas && selectedObject) {
      // Remove from pending uploads if it's an image
      if (selectedObject.imageId) {
        setPendingImageUploads(prev => {
          const updated = { ...prev };
          delete updated[selectedObject.imageId];
          return updated;
        });
      }
      
      fabricCanvas.remove(selectedObject);
      setSelectedObject(null);
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      setElements([...fabricCanvas.getObjects()]);
    }
  };

  // Change color of selected object
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    if (selectedObject && (selectedObject.type === "textbox" || selectedObject.type === "rect" || selectedObject.type === "circle")) {
      selectedObject.set({ fill: newColor });
      if (fabricCanvas) fabricCanvas.requestRenderAll();
    }
  };

  // Change font of selected text
  const handleFontChange = (value: string) => {
    setFont(value);
    if (selectedObject && selectedObject.type === "textbox") {
      selectedObject.set({ fontFamily: value });
      if (fabricCanvas) fabricCanvas.requestRenderAll();
    }
  };

  // DnD reorder handler
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = elements.findIndex((el) => el.__uid === active.id);
      const newIndex = elements.findIndex((el) => el.__uid === over.id);
      const newElements = arrayMove(elements, oldIndex, newIndex);
      setElements(newElements);
      
      // Reorder objects on canvas
      if (fabricCanvas) {
        newElements.forEach((obj) => {
          fabricCanvas.bringObjectToFront(obj);
        });
        fabricCanvas.renderAll();
      }
    }
  };

  // Assign unique IDs to elements for DnD
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach((obj: any, idx: number) => {
      if (!obj.__uid) obj.__uid = `${obj.type}-${idx}-${Date.now()}`;
    });
    setElements([...fabricCanvas.getObjects()]);
  }, [fabricCanvas, elements.length]);

  const addText = () => {
    if (!fabricCanvas) return;
    
    const text = new Textbox("Edit this text", {
      left: 50,
      top: 50,
      fontSize: 24,
      fill: "#000000",
      fontFamily: "Arial",
      width: 200,
    });
    
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    toast.success("Text added!");
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;
    
    const rect = new Rect({
      left: 100,
      top: 100,
      fill: "#ff0000",
      width: 100,
      height: 60,
      stroke: "#000000",
      strokeWidth: 2,
    });
    
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    toast.success("Rectangle added!");
  };

  const addCircle = () => {
    if (!fabricCanvas) return;
    
    const circle = new FabricCircle({
      left: 100,
      top: 100,
      fill: "#00ff00",
      radius: 50,
      stroke: "#000000",
      strokeWidth: 2,
    });
    
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
    toast.success("Circle added!");
  };

  // Video playback controls - sync all video elements
  const togglePlayback = () => {
    if (!fabricCanvas) return;
    
    const videoObjects = fabricCanvas.getObjects().filter((obj: any) => obj.isVideo);
    if (videoObjects.length === 0) return;
    
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    
    if (newIsPlaying) {
      // Start all videos
      videoObjects.forEach((obj: any) => {
        if (obj.videoElement) {
          obj.videoElement.currentTime = currentTime;
          obj.videoElement.play().catch(console.error);
        }
      });
      
      // Start playback timer
      const startTime = Date.now() - (currentTime * 1000);
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setCurrentTime(elapsed);
        
        // Update video frame displays
        videoObjects.forEach((obj: any) => {
          if (obj.videoElement && elapsed <= obj.videoDuration) {
            obj.videoElement.currentTime = elapsed;
          }
        });
        
        if (elapsed >= maxDuration) {
          setCurrentTime(0);
          setIsPlaying(false);
          clearInterval(interval);
          
          // Reset all videos
          videoObjects.forEach((obj: any) => {
            if (obj.videoElement) {
              obj.videoElement.pause();
              obj.videoElement.currentTime = 0;
            }
          });
        }
      }, 100);
    } else {
      // Pause all videos
      videoObjects.forEach((obj: any) => {
        if (obj.videoElement) {
          obj.videoElement.pause();
        }
      });
    }
  };

  const clearCanvas = () => {
    if (!fabricCanvas || !originalTemplateData) return;

    // Clear canvas
    fabricCanvas.clear();
    
    // Clear pending uploads
    setPendingImageUploads({});
    setVideoElements([]);
    setMaxDuration(0);
    
    // Reload original template data
    loadTemplateData();
    toast.success("Canvas reset to original template!");
  };

  // Download meme - image if no video elements, video if video elements exist
  const downloadMeme = async () => {
    if (!fabricCanvas) {
      toast.error("Canvas not ready");
      return;
    }

    const hasVideos = hasVideoElements();
    
    if (hasVideos) {
      // For canvases with video elements, download as video
      toast.info("Video download will be implemented with video rendering");
      return;
    }

    // For canvases without video elements, download as image
    try {
      // Wait for all images to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create a high-quality data URL of the current canvas
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2 // Higher resolution for better quality
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `meme-${template.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
      link.href = dataURL;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Meme downloaded successfully!");
      
    } catch (error: any) {
      console.error('Download error:', error);
      
      if (error.name === 'SecurityError' || error.message.includes('Tainted canvases')) {
        toast.error("Cannot download: Images from external sources are blocked. Try using images from the same domain or ensure CORS is enabled.");
      } else {
        toast.error("Failed to download meme. Please try again.");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            BACK
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Edit: {template.name}</h2>
            <p className="text-muted-foreground">Create your meme masterpiece</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={downloadMeme} className="btn-gradient text-primary-foreground">
            <Download className="w-4 h-4 mr-2" />
            Download Meme
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel - Tools */}
        <div className="lg:col-span-1 space-y-6">
          {/* Element Selection Toolbar */}
          {selectedObject && (
            <div className="bg-card p-4 rounded-xl border border-border">
              <h3 className="text-sm font-semibold mb-3">Selected Element</h3>
              <div className="flex items-center gap-2 mb-3">
                <Button variant="ghost" size="icon" onClick={handleDelete} title="Delete">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
                {(selectedObject.type === "textbox" || selectedObject.type === "rect" || selectedObject.type === "circle") && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Color</span>
                    <button
                      className="w-6 h-6 rounded border border-border"
                      style={{ background: color }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'color';
                        input.value = color;
                        input.oninput = (e: any) => handleColorChange(e.target.value);
                        input.click();
                      }}
                    />
                  </div>
                )}
              </div>
              {selectedObject.type === "textbox" && (
                <div>
                  <Label className="text-xs">Font</Label>
                  <Select value={font} onValueChange={handleFontChange}>
                    <SelectTrigger className="w-full h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Add Elements */}
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <Type className="w-4 h-4 mr-2" />
              Add Elements
            </h3>
            <div className="space-y-2">
              <Button onClick={addText} variant="outline" size="sm" className="w-full justify-start">
                <Type className="w-4 h-4 mr-2" />
                Add Text
              </Button>
              <Button onClick={addRectangle} variant="outline" size="sm" className="w-full justify-start">
                <Square className="w-4 h-4 mr-2" />
                Add Rectangle
              </Button>
              <Button onClick={addCircle} variant="outline" size="sm" className="w-full justify-start">
                <Circle className="w-4 h-4 mr-2" />
                Add Circle
              </Button>
            </div>
          </div>

          {/* Upload Images */}
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="text-sm font-semibold mb-3">Upload Images</h3>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesUpload}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload">
              <Button variant="outline" size="sm" className="w-full cursor-pointer" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Add Images
                </span>
              </Button>
            </label>
              {Object.keys(pendingImageUploads).length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  📎 {Object.keys(pendingImageUploads).length} image(s) ready
                </p>
              )}
          </div>

          {/* Video Playback Controls - Only show if video elements exist */}
          {hasVideoElements() && (
              <div className="bg-card p-4 rounded-xl border border-border">
                <h3 className="text-sm font-semibold mb-3">Video Preview</h3>
                <div className="space-y-3">
                  <Button
                    onClick={togglePlayback}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Preview
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Play Preview
                      </>
                    )}
                  </Button>
                  <div className="text-xs text-muted-foreground text-center">
                    {currentTime.toFixed(1)}s / {maxDuration.toFixed(1)}s
                  </div>
                  <div className="w-full bg-muted rounded h-1">
                    <div 
                      className="bg-primary h-1 rounded transition-all duration-100"
                      style={{ width: `${maxDuration > 0 ? (currentTime / maxDuration) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

          {/* Elements List - FIX: Added unique keys */}
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <Layers className="w-4 h-4 mr-2" />
              Elements
            </h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={elements.map((el) => el.__uid)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {elements.map((obj, index) => (
                    <SortableElementItem
                      key={obj.__uid || `element-${index}`} // FIX: Added unique key
                      id={obj.__uid}
                      obj={obj}
                      isActive={selectedObject === obj}
                      onSelect={(o: any) => {
                        if (fabricCanvas) {
                          fabricCanvas.setActiveObject(o);
                          setSelectedObject(o);
                        }
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Actions */}
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="text-sm font-semibold mb-3">Actions</h3>
            <Button onClick={clearCanvas} variant="outline" size="sm" className="w-full">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Original
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="lg:col-span-3">
          <div className="bg-card p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Canvas</h3>
            {/* Canvas container with light black background - removed white borders and rounded corners */}
            <div 
              className="flex items-center justify-center p-8"
              style={{ 
                backgroundColor: '#oeoe11', // Light black background
                minHeight: `${canvasDimensions.height + 100}px` // Dynamic height based on canvas
              }}
            >
              <div className="relative">
                <canvas 
                  ref={canvasRef} 
                  style={{
                    width: `${canvasDimensions.width}px`,
                    height: `${canvasDimensions.height}px`,
                    display: 'block'
                  }}
                />
                {loading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">Loading template...</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
