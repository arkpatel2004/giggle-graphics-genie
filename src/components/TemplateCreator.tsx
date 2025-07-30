import { useState, useEffect, useRef } from "react";
import { X, Upload, Type, Square, Circle, Download, Save, User, Lock, Trash2, AlignLeft, Layers, Image as ImageIcon, Video, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, Textbox, FabricImage } from "fabric";
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
const generateFileName = (originalName: string, prefix: string = 'image'): String => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop() || 'png';
  return `${prefix}-${timestamp}-${randomString}.${extension}`;
};

// Helper function to get actual rendered dimensions of fabric object
const getActualObjectDimensions = (obj: any) => {
  const bounds = obj.getBoundingRect();
  return {
    x: bounds.left,
    y: bounds.top,
    width: bounds.width,
    height: bounds.height
  };
};

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

interface TemplateCreatorProps {
  onClose: () => void;
}

export const TemplateCreator = ({ onClose }: TemplateCreatorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<'photo' | 'video'>('photo');
  const [loading, setLoading] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [color, setColor] = useState("#000000");
  const [font, setFont] = useState(FONT_OPTIONS[0]);
  const [elements, setElements] = useState<any[]>([]);
  const [videoElements, setVideoElements] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(0);
  
  // Store original files for upload after admin authentication
  const [pendingImageUploads, setPendingImageUploads] = useState<{[key: string]: File}>({});
  const [pendingVideoUploads, setPendingVideoUploads] = useState<{[key: string]: File}>({});

  // DnD-kit setup
  const sensors = useSensors(useSensor(PointerSensor));

  // FIXED: Canvas dimensions now match display dimensions (for smaller video canvas)
  const getCanvasDimensions = () => {
    if (templateType === 'video') {
      // Video canvas: same height as photo but narrower (maintains 9:16 ratio)
      const height = 500;
      const width = Math.round(height * (9/16)); // 400 * (9/16) = 225px
      return { width, height };
    }
    return { width: 400, height: 400 }; // Photo: 1:1 ratio
  };

  // FIXED: Original dimensions only for download (true reel size)
  const getOriginalDimensions = () => {
    if (templateType === 'video') {
      return { width: 400, height: 711 }; // Original reel dimensions for download only
    }
    return { width: 400, height: 400 }; // Photo remains same
  };

  // Set canvas background color based on template type
  const getCanvasBackgroundColor = () => {
    return templateType === 'video' ? '#000000' : '#ffffff';
  };

  // Update canvas background immediately when template type changes
  useEffect(() => {
    if (fabricCanvas) {
      const backgroundColor = getCanvasBackgroundColor();
      fabricCanvas.backgroundColor = backgroundColor;
      fabricCanvas.renderAll();
    }
  }, [templateType, fabricCanvas]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const dimensions = getCanvasDimensions(); // FIXED: Use smaller dimensions for canvas
    const backgroundColor = getCanvasBackgroundColor();
    
    const canvas = new FabricCanvas(canvasRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: backgroundColor,
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
  }, [templateType]);

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

  // Multi-video upload handler - Add videos as canvas elements like images
  const handleVideosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvas) return;

    Array.from(files).forEach((file) => {
      // Validate video file size (40MB max)
      if (file.size > 40 * 1024 * 1024) {
        toast.error(`Video ${file.name} is too large. Maximum size is 40MB.`);
        return;
      }

      const video = document.createElement('video');
      const videoUrl = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        // Validate video duration (50 seconds max)
        if (video.duration > 50) {
          toast.error(`Video ${file.name} is too long. Maximum duration is 50 seconds.`);
          URL.revokeObjectURL(videoUrl);
          return;
        }

        // Create a video element for playback
        video.muted = true;
        video.loop = false;
        video.currentTime = 0;
        
        // Create fabric image from video first frame
        video.oncanplaythrough = () => {
          const videoCanvas = document.createElement('canvas');
          videoCanvas.width = video.videoWidth;
          videoCanvas.height = video.videoHeight;
          const ctx = videoCanvas.getContext('2d');
          ctx?.drawImage(video, 0, 0);
          
          FabricImage.fromURL(videoCanvas.toDataURL()).then((img: any) => {
            img.set({ 
              left: 50, 
              top: 50, 
              scaleX: 0.3, 
              scaleY: 0.3 
            });
            
            // Store video metadata and element for playback
            const videoId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            img.videoId = videoId;
            img.originalFileName = file.name;
            img.isVideo = true;
            img.videoDuration = video.duration;
            img.videoUrl = videoUrl;
            img.videoElement = video; // Store actual video element for playback
            
            // Store the file for later upload
            setPendingVideoUploads(prev => ({
              ...prev,
              [videoId]: file
            }));
            
            fabricCanvas.add(img);
            fabricCanvas.setActiveObject(img);
            setElements([...fabricCanvas.getObjects()]);
            
            // Update max duration for playback
            setMaxDuration(prev => Math.max(prev, video.duration));
            
            toast.success(`Video ${file.name} added to canvas (${video.duration.toFixed(1)}s)`);
          });
        };
      };

      video.src = videoUrl;
    });
    e.target.value = "";
  };

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

  // Upload video to Supabase storage (only called after admin auth)
  const uploadVideoToStorage = async (file: File, folder: string = 'template-videos'): Promise<string | null> => {
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
      
      // Remove from pending uploads if it's a video
      if (selectedObject.videoId) {
        setPendingVideoUploads(prev => {
          const updated = { ...prev };
          delete updated[selectedObject.videoId];
          return updated;
        });
        
        // Recalculate max duration
        const remainingVideoObjects = fabricCanvas.getObjects().filter((obj: any) => obj.isVideo && obj !== selectedObject);
        const newMaxDuration = remainingVideoObjects.length > 0 
          ? Math.max(...remainingVideoObjects.map((obj: any) => obj.videoDuration))
          : 0;
        setMaxDuration(newMaxDuration);
      }
      
      fabricCanvas.remove(selectedObject);
      setSelectedObject(null);
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      setElements([...fabricCanvas.getObjects()]);
    }
  };

  // Delete video element - Now handled by canvas object deletion
  const handleDeleteVideo = (videoId: string) => {
    // Remove from pending uploads
    setPendingVideoUploads(prev => {
      const updated = { ...prev };
      delete updated[videoId];
      return updated;
    });

    // Recalculate max duration from all video objects on canvas
    const videoObjects = fabricCanvas?.getObjects().filter((obj: any) => obj.isVideo) || [];
    const newMaxDuration = videoObjects.length > 0 
      ? Math.max(...videoObjects.map((obj: any) => obj.videoDuration))
      : 0;
    setMaxDuration(newMaxDuration);
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
      fill: templateType === 'video' ? "#ffffff" : "#000000",
      fontFamily: "Arial",
      width: 200,
    });
    
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
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
  };

  // Check if canvas has video elements
  const hasVideoElements = () => {
    if (!fabricCanvas) return false;
    return fabricCanvas.getObjects().some((obj: any) => obj.isVideo);
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

  // Download meme - image if no video elements, video if video elements exist
  const downloadMeme = () => {
    if (!fabricCanvas) return;

    const hasVideos = hasVideoElements();
    
    if (hasVideos) {
      // For canvases with video elements, download as video
      toast.info("Video download will be implemented with video rendering");
      return;
    }

    // For canvases without video elements, download as image
    try {
      const originalDimensions = getOriginalDimensions();
      const currentDimensions = getCanvasDimensions();
      
      // Calculate scale factors for original size download
      const scaleX = originalDimensions.width / currentDimensions.width;
      const scaleY = originalDimensions.height / currentDimensions.height;
      
      // Create high-resolution download
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: Math.max(scaleX, scaleY) * 2 // Scale up to original size + higher resolution
      });

      const link = document.createElement('a');
      link.download = `meme-${Date.now()}.png`;
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

      // Upload all pending element images
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

      // Upload all pending element videos
      const videoUrlMapping: {[key: string]: string} = {};
      
      for (const [videoId, file] of Object.entries(pendingVideoUploads)) {
        const uploadedUrl = await uploadVideoToStorage(file, 'template-videos');
        if (uploadedUrl) {
          videoUrlMapping[videoId] = uploadedUrl;
        } else {
          toast.error(`Failed to upload ${(file as File).name}`);
          return;
        }
      }

      // Create thumbnail
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

      // Prepare layout definition with current canvas dimensions
      const canvasObjects = fabricCanvas.getObjects();
      const elements = canvasObjects.map((obj, index) => {
        const actualDimensions = getActualObjectDimensions(obj);
        
        const element: any = {
          id: `element_${index + 1}`,
          type: obj.type,
          x: actualDimensions.x,
          y: actualDimensions.y,
          width: actualDimensions.width,
          height: actualDimensions.height,
        };

        if (obj.type === 'textbox') {
          element.text = (obj as any).text || '';
          element.fontSize = (obj as any).fontSize || 16;
          element.fontFamily = (obj as any).fontFamily || 'Arial';
          element.color = (obj as any).fill || '#000000';
        } else if (obj.type === 'image') {
          const imageId = (obj as any).imageId;
          const videoId = (obj as any).videoId;
          
          if ((obj as any).isVideo) {
            // Handle video elements stored as images
            element.type = 'video';
            element.videoUrl = videoUrlMapping[videoId] || (obj as any).videoUrl;
            element.duration = (obj as any).videoDuration;
            element.originalFileName = (obj as any).originalFileName;
          } else {
            // Handle regular images
            element.imageUrl = imageUrlMapping[imageId] || '';
          }
          
          element.originalWidth = (obj as any).width || actualDimensions.width;
          element.originalHeight = (obj as any).height || actualDimensions.height;
        } else if (obj.type === 'rect') {
          element.fill = (obj as any).fill || '#ffffff';
          element.strokeColor = (obj as any).stroke || '#000000';
          element.strokeWidth = (obj as any).strokeWidth || 1;
        } else if (obj.type === 'circle') {
          element.fill = (obj as any).fill || '#ffffff';
          element.strokeColor = (obj as any).stroke || '#000000';
          element.strokeWidth = (obj as any).strokeWidth || 1;
          element.radius = (obj as any).radius || 50;
          element.width = element.radius * 2;
          element.height = element.radius * 2;
        }

        return element;
      });

      // Video elements are now saved with other elements above

      // FIXED: Save with current canvas dimensions (smaller video canvas)
      const canvasDimensions = getCanvasDimensions();
      const layoutDefinition = {
        canvas: {
          width: canvasDimensions.width, // Save with display dimensions
          height: canvasDimensions.height,
          backgroundColor: typeof fabricCanvas.backgroundColor === 'string' ? fabricCanvas.backgroundColor : getCanvasBackgroundColor(),
          backgroundImage: null
        },
        elements: elements,
        maxDuration: templateType === 'video' ? maxDuration : undefined
      };

      // Save template to database
      const templateData = {
        name: templateName,
        type: templateType,
        layout_definition: layoutDefinition,
        thumbnail_url: thumbnailUrl,
        tags: ['user-created']
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
      setPendingVideoUploads({});
      setMaxDuration(0);
      
    } catch (error) {
      toast.error("Failed to save template");
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!fabricCanvas || !templateName) {
      toast.error("Please provide template name");
      return;
    }
    setShowAdminModal(true);
  };

  const displayDimensions = getCanvasDimensions(); // Now same as canvas dimensions

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-xl border border-border w-full max-w-6xl h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-bold">Create Template</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Panel - Controls */}
            <div className="w-80 border-r border-border p-6 overflow-y-auto">
              <div className="space-y-6">
                {/* Selected Element Toolbar - Moved to top */}
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

                {/* Template Info */}
                <div className="bg-card p-4 rounded-xl border border-border">
                  <h3 className="text-sm font-semibold mb-3">Template Info</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="template-name">Template Name</Label>
                      <Input
                        id="template-name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Enter template name"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="template-type">Template Type</Label>
                      <Select value={templateType} onValueChange={(value: 'photo' | 'video') => setTemplateType(value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="photo">Photo (1:1 ratio)</SelectItem>
                          <SelectItem value="video">Video (9:16 ratio)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

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
                    id="multi-image-upload"
                  />
                  <label htmlFor="multi-image-upload">
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

                {/* Upload Videos - Only for video templates */}
                {templateType === 'video' && (
                  <div className="bg-card p-4 rounded-xl border border-border">
                    <h3 className="text-sm font-semibold mb-3">Upload Videos</h3>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleVideosUpload}
                      className="hidden"
                      id="multi-video-upload"
                    />
                    <label htmlFor="multi-video-upload">
                      <Button variant="outline" size="sm" className="w-full cursor-pointer" asChild>
                        <span>
                          <Video className="w-4 h-4 mr-2" />
                          Add Videos
                        </span>
                      </Button>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max 50 seconds, Max 40MB per video
                    </p>
                    {Object.keys(pendingVideoUploads).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        📹 {Object.keys(pendingVideoUploads).length} video(s) ready
                      </p>
                    )}
                  </div>
                )}

                 {/* Video Playback Controls - Only show if there are video elements */}
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

                {/* Elements List */}
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
                            key={obj.__uid || `element-${index}`}
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
                  <div className="space-y-3">
                    <Button
                      onClick={downloadMeme}
                      disabled={!fabricCanvas}
                      variant="outline"
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Meme
                    </Button>
                    <Button
                      onClick={handleSaveTemplate}
                      disabled={loading || !templateName}
                      className="w-full btn-gradient text-primary-foreground"
                    >
                      {loading ? (
                        "Saving..."
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Template
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Canvas container - now matches canvas dimensions exactly */}
            <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
                <canvas 
                  ref={canvasRef} 
                  style={{
                    width: `${displayDimensions.width}px`,
                    height: `${displayDimensions.height}px`,
                  }}
                />
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
                Enter admin credentials to save template to database
              </p>
              {(Object.keys(pendingImageUploads).length > 0 || Object.keys(pendingVideoUploads).length > 0) && (
                <div className="text-xs text-yellow-600 mt-2 space-y-1">
                  {Object.keys(pendingImageUploads).length > 0 && (
                    <p>⚠️ {Object.keys(pendingImageUploads).length} images will be uploaded</p>
                  )}
                  {Object.keys(pendingVideoUploads).length > 0 && (
                    <p>⚠️ {Object.keys(pendingVideoUploads).length} videos will be uploaded</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="admin-username">Username</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-username"
                  type="text"
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
    </>
  );
};
