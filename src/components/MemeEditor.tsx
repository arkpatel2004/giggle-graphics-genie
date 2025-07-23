import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Type, Square, Circle, RotateCcw, Save, User, Lock, Upload, Trash2, AlignLeft, Layers, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Template } from "./Dashboard";
import { Canvas as FabricCanvas, Textbox, Rect, Circle as FabricCircle, FabricImage } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FONT_OPTIONS = [
  "Arial", "Arial Black", "Comic Sans MS", "Courier New", "Georgia", "Impact", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"
];

// Helper function to convert data URL to blob
const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// Helper function to generate unique filename
const generateFileName = (originalName: string, prefix: string = 'image'): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop() || 'png';
  return `${prefix}-${timestamp}-${randomString}.${extension}`;
};

function getElementTypeIcon(type: string) {
  if (type === "textbox") return <AlignLeft className="w-4 h-4" />;
  if (type === "rect") return <Square className="w-4 h-4" />;
  if (type === "circle") return <Circle className="w-4 h-4" />;
  if (type === "image") return <ImageIcon className="w-4 h-4" />;
  return <Layers className="w-4 h-4" />;
}

function getElementLabel(obj: any) {
  if (obj.type === "textbox") return "Text";
  if (obj.type === "rect") return "Box";
  if (obj.type === "circle") return "Circle";
  if (obj.type === "image") return obj?.originalFileName || "Image";
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
  const [templateName, setTemplateName] = useState("");
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [color, setColor] = useState("#000000");
  const [font, setFont] = useState(FONT_OPTIONS[0]);
  const [elements, setElements] = useState<any[]>([]);
  const [pendingImageUploads, setPendingImageUploads] = useState<{[key: string]: File}>({});
  const [originalTemplateData, setOriginalTemplateData] = useState<any>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 400, height: 400 });

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
              const img = await FabricImage.fromURL(elementData.imageUrl);
              
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
        setBackgroundImage(layoutDef.canvas.backgroundImage);
        try {
          const img = await FabricImage.fromURL(layoutDef.canvas.backgroundImage);
          // Scale background image to EXACT canvas dimensions
          img.set({
            scaleX: dimensions.width / (img.width || 1),
            scaleY: dimensions.height / (img.height || 1)
          });
          fabricCanvas.backgroundImage = img;
        } catch (error) {
          console.error('Error loading background image:', error);
        }
      }
      
      // Wait a moment for canvas to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Recreate all elements with EXACT positioning and sizing
      if (layoutDef.elements && Array.isArray(layoutDef.elements)) {
        for (const elementData of layoutDef.elements) {
          await createElementFromData(elementData);
        }
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

  // Upload image to Supabase storage (only called after admin auth)
  const uploadImageToStorage = async (file: File, folder: string = 'template-images'): Promise<string | null> => {
    try {
      const fileName = generateFileName(file.name, folder);
      const filePath = `${folder}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('template-assets')
        .upload(filePath, file);

      if (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('template-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload ${file.name}`);
      return null;
    }
  };

  // Multi-image upload handler - Store files locally, don't upload to Supabase yet
  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvas) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        FabricImage.fromURL(imageUrl).then((img: any) => {
          img.set({ 
            left: 50, 
            top: 50, 
            scaleX: 0.5, 
            scaleY: 0.5 
          });
          
          // Store original file and filename for later upload
          const imageId = `image_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          img.imageId = imageId;
          img.originalFileName = file.name;
          
          // Store the file for later upload
          setPendingImageUploads(prev => ({
            ...prev,
            [imageId]: file
          }));
          
          fabricCanvas.add(img);
          fabricCanvas.setActiveObject(img);
          setElements([...fabricCanvas.getObjects()]);
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

  const clearCanvas = () => {
    if (!fabricCanvas || !originalTemplateData) return;

    // Clear canvas
    fabricCanvas.clear();
    
    // Clear pending uploads
    setPendingImageUploads({});
    
    // Reload original template data
    loadTemplateData();
    toast.success("Canvas reset to original template!");
  };

  const downloadMeme = () => {
    if (!fabricCanvas) {
      toast.error("Canvas not ready");
      return;
    }

    try {
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2,
      });

      const link = document.createElement('a');
      link.download = `meme-${template.name}-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Meme downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download meme");
      console.error('Download error:', error);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminUsername || !adminPassword) {
      toast.error("Please enter username and password");
      return;
    }

    try {
      setAdminLoading(true);
      const { data, error } = await supabase
        .from('admin_credentials')
        .select('*')
        .eq('username', adminUsername)
        .single();

      if (error || !data) {
        toast.error("Invalid credentials");
        return;
      }

      // Simple password check (in production, use proper password hashing)
      if (adminPassword === 'admin123') {
        toast.success("Admin access granted!");
        setShowAdminModal(false);
        await saveTemplate();
      } else {
        toast.error("Invalid credentials");
      }
    } catch (error) {
      toast.error("Authentication failed");
      console.error('Auth error:', error);
    } finally {
      setAdminLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!fabricCanvas || !templateName) {
      toast.error("Please provide template name");
      return;
    }

    try {
      setLoading(true);
      toast.info("Uploading images and saving template...");

      // Step 1: Upload background image if exists
      let backgroundImageUrl = backgroundImage;
      if (backgroundImageFile) {
        const uploadedUrl = await uploadImageToStorage(backgroundImageFile, 'background-images');
        if (uploadedUrl) {
          backgroundImageUrl = uploadedUrl;
        }
      }

      // Step 2: Upload all pending element images
      const imageUrlMapping: {[key: string]: string} = {};
      
      for (const [imageId, file] of Object.entries(pendingImageUploads)) {
        const uploadedUrl = await uploadImageToStorage(file, 'template-images');
        if (uploadedUrl) {
          imageUrlMapping[imageId] = uploadedUrl;
        } else {
          toast.error(`Failed to upload ${file.name}`);
          return;
        }
      }

      // Step 3: Create thumbnail
      const thumbnailDataUrl = fabricCanvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.3
      });

      const thumbnailBlob = dataURLtoBlob(thumbnailDataUrl);
      const thumbnailFileName = generateFileName(`${templateName}-thumbnail.png`, 'thumbnails');
      const thumbnailPath = `thumbnails/${thumbnailFileName}`;
      
      const { data: thumbnailUploadData, error: thumbnailUploadError } = await supabase.storage
        .from('template-assets')
        .upload(thumbnailPath, thumbnailBlob);

      if (thumbnailUploadError) {
        console.error('Thumbnail upload error:', thumbnailUploadError);
        toast.error("Failed to upload thumbnail");
        return;
      }

      // Get public URL for thumbnail
      const { data: { publicUrl: thumbnailUrl } } = supabase.storage
        .from('template-assets')
        .getPublicUrl(thumbnailPath);

      // Step 4: Prepare layout definition with uploaded image URLs
      const canvasObjects = fabricCanvas.getObjects();
      const elements = canvasObjects.map((obj, index) => {
        const element: any = {
          id: `element_${index + 1}`,
          type: obj.type,
          x: obj.left || 0,
          y: obj.top || 0,
          width: obj.width || 0,
          height: obj.height || 0,
        };

        if (obj.type === 'textbox') {
          element.text = (obj as any).text || '';
          element.fontSize = (obj as any).fontSize || 16;
          element.fontFamily = (obj as any).fontFamily || 'Arial';
          element.color = (obj as any).fill || '#000000';
        } else if (obj.type === 'image') {
          // Use the uploaded URL from mapping
          const imageId = (obj as any).imageId;
          element.imageUrl = imageUrlMapping[imageId] || (obj as any).src || '';
        } else if (obj.type === 'rect') {
          element.fill = (obj as any).fill || '#ffffff';
          element.strokeColor = (obj as any).stroke || '#000000';
          element.strokeWidth = (obj as any).strokeWidth || 1;
        } else if (obj.type === 'circle') {
          element.fill = (obj as any).fill || '#ffffff';
          element.strokeColor = (obj as any).stroke || '#000000';
          element.strokeWidth = (obj as any).strokeWidth || 1;
          element.radius = (obj as any).radius || 50;
        }

        return element;
      });

      const layoutDefinition = {
        canvas: {
          width: fabricCanvas.width || getCanvasDimensions().width,
          height: fabricCanvas.height || getCanvasDimensions().height,
          backgroundColor: typeof fabricCanvas.backgroundColor === 'string' ? fabricCanvas.backgroundColor : '#ffffff',
          backgroundImage: backgroundImageUrl
        },
        elements
      };

      // Step 5: Save template to database
      const templateData = {
        name: templateName,
        type: template.type,
        layout_definition: layoutDefinition,
        thumbnail_url: thumbnailUrl,
        tags: ['user-created', 'meme']
      };

      const { error } = await supabase
        .from('templates')
        .insert(templateData);

      if (error) {
        console.error('Error saving template:', error);
        toast.error("Failed to save template");
        return;
      }

      toast.success("Template saved successfully!");
      
      // Reset form
      setTemplateName("");
      setAdminUsername("");
      setAdminPassword("");
      setPendingImageUploads({});
      
    } catch (error) {
      toast.error("Failed to save template");
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = () => {
    setShowAdminModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
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
          <Button onClick={handleSaveTemplate} variant="outline">
            <Save className="w-4 h-4 mr-2" />
            Save as New Template
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

          {/* Elements List */}
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <Layers className="w-4 h-4 mr-2" />
              Elements
            </h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={elements.map((el) => el.__uid)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {elements.map((obj) => (
                    <SortableElementItem
                      key={obj.__uid}
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
            {/* Canvas container with light black background and centered white canvas */}
            <div 
              className="rounded-lg overflow-hidden bg-card flex items-center justify-center p-8"
              style={{ 
                // backgroundColor: '#000000', // Light black background
                minHeight: `${canvasDimensions.height + 100}px` // Dynamic height based on canvas
              }}
            >
              <div className="relative bg-white rounded-lg shadow-lg" style={{ 
                width: `${canvasDimensions.width+10}px`,
                height: `${canvasDimensions.height+10}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px'
              }}>
                <canvas 
                  ref={canvasRef} 
                  style={{
                    width: `${canvasDimensions.width}px`,
                    height: `${canvasDimensions.height}px`,
                    border: '1px solid #e5e7eb'
                  }}
                />
                {loading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                    <div className="text-sm text-muted-foreground">Loading template...</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Authentication Modal */}
      <Dialog open={showAdminModal} onOpenChange={setShowAdminModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Authentication Required</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Enter admin credentials to save as new template
              </p>
              {Object.keys(pendingImageUploads).length > 0 && (
                <p className="text-xs text-yellow-600 mt-2">
                  ⚠️ {Object.keys(pendingImageUploads).length} images will be uploaded after authentication
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="template-name-save">Template Name</Label>
              <Input
                id="template-name-save"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="admin-username">Username</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter username"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAdminModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdminLogin}
                disabled={adminLoading}
                className="flex-1 btn-gradient text-primary-foreground"
              >
                {adminLoading ? "Authenticating..." : "Save Template"}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              Default credentials: admin / admin123
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
