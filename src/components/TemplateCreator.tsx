import { useState, useEffect, useRef } from "react";
import { X, Upload, Type, Square, Circle, Download, Save, User, Lock, Trash2, AlignLeft, Layers, Image as ImageIcon } from "lucide-react";
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
  if (obj.type === "image") return obj?.src?.split("/").pop() || "Image";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<'photo' | 'video'>('photo');
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [color, setColor] = useState("#000000");
  const [font, setFont] = useState(FONT_OPTIONS[0]);
  const [elements, setElements] = useState<any[]>([]); // Track z-order

  // DnD-kit setup
  const sensors = useSensors(useSensor(PointerSensor));

  // Instagram post ratio: 1:1 (1080x1080), Reel ratio: 9:16 (1080x1920)
  const getCanvasDimensions = () => {
    if (templateType === 'video') {
      return { width: 400, height: 711 }; // 9:16 ratio scaled down
    }
    return { width: 400, height: 400 }; // 1:1 ratio
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const dimensions = getCanvasDimensions();
    const canvas = new FabricCanvas(canvasRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: "#ffffff",
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

  // Multi-image upload handler
  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvas) return;
    
    toast.info("Uploading images...");
    
    for (const file of Array.from(files)) {
      try {
        // Upload image to Supabase storage
        const fileName = `images/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('template-assets')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL for the uploaded image
        const { data: { publicUrl } } = supabase.storage
          .from('template-assets')
          .getPublicUrl(fileName);

        // Add image to canvas using the public URL
        FabricImage.fromURL(publicUrl).then((img: any) => {
          img.set({ 
            left: 50, 
            top: 50, 
            scaleX: 0.5, 
            scaleY: 0.5,
            src: publicUrl // Store the public URL for later use
          });
          fabricCanvas.add(img);
          fabricCanvas.setActiveObject(img);
          setElements([...fabricCanvas.getObjects()]);
        }).catch((error) => {
          console.error('Error loading image from URL:', error);
          toast.error(`Failed to load ${file.name}`);
        });
      } catch (error) {
        console.error('Error uploading image:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }
    
    e.target.value = "";
    toast.success("Images uploaded successfully!");
  };

  // Delete selected object
  const handleDelete = () => {
    if (fabricCanvas && selectedObject) {
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
        newElements.forEach((obj, idx) => {
          fabricCanvas.bringObjectToFront(obj); // ✅ Correct method
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

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (templateType === 'video') {
      setVideoFile(file);
      const videoUrl = URL.createObjectURL(file);
      setBackgroundImage(videoUrl);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setBackgroundImage(imageUrl);
        
        if (fabricCanvas) {
          // Create a Fabric image object and set as background
          FabricImage.fromURL(imageUrl).then((img) => {
            const dimensions = getCanvasDimensions();
            img.scaleToWidth(dimensions.width);
            img.scaleToHeight(dimensions.height);
            fabricCanvas.backgroundImage = img;
            fabricCanvas.renderAll();
          }).catch((error) => {
            console.error('Error loading image:', error);
            toast.error("Failed to load image");
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

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

  const downloadMeme = () => {
    if (!fabricCanvas) return;

    try {
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2 // Higher resolution
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
      
      // Create a thumbnail from the canvas
      const thumbnailDataUrl = fabricCanvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.3
      });

      // Convert data URL to blob for upload
      const response = await fetch(thumbnailDataUrl);
      const blob = await response.blob();

      // Upload thumbnail to storage
      const thumbnailFileName = `thumbnails/${Date.now()}-${templateName.replace(/\s+/g, '-').toLowerCase()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('template-assets')
        .upload(thumbnailFileName, blob);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error("Failed to upload thumbnail");
        return;
      }

      // Get public URL for thumbnail
      const { data: { publicUrl } } = supabase.storage
        .from('template-assets')
        .getPublicUrl(thumbnailFileName);

      // Prepare layout definition with canvas and elements data
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
          element.imageUrl = (obj as any).src || '';
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
          backgroundColor: typeof fabricCanvas.backgroundColor === 'string' ? fabricCanvas.backgroundColor : '#ffffff'
        },
        elements
      };

      const templateData = {
        name: templateName,
        type: templateType,
        layout_definition: layoutDefinition,
        thumbnail_url: publicUrl,
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

  const dimensions = getCanvasDimensions();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-xl border border-border w-full max-w-6xl h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex flex-col gap-2 p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Create Template</h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {/* Advanced element options toolbar */}
            {selectedObject && (
              <div className="flex items-center gap-4 py-2 px-4 rounded-lg border bg-muted/50 shadow-sm">
                <Button variant="ghost" size="icon" onClick={handleDelete} title="Delete">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </Button>
                {(selectedObject.type === "textbox" || selectedObject.type === "rect" || selectedObject.type === "circle") && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Color</span>
                    <button
                      className="w-6 h-6 rounded border border-border flex items-center justify-center"
                      style={{ background: color }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'color';
                        input.value = color;
                        input.oninput = (e: any) => handleColorChange(e.target.value);
                        input.click();
                      }}
                      title="Change Color"
                    />
                  </div>
                )}
                {selectedObject.type === "textbox" && (
                  <div className="flex items-center gap-2">
                    <AlignLeft className="w-5 h-5 text-muted-foreground" />
                    <Select value={font} onValueChange={handleFontChange}>
                      <SelectTrigger className="w-24 h-8 text-xs">
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
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Panel - Controls */}
            <div className="w-80 border-r border-border p-6 overflow-y-auto">
              <div className="space-y-6">
                {/* Template Info */}
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

                {/* Multi-Image Upload */}
                <div>
                  <Label>Upload Images (as elements)</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImagesUpload}
                      className="hidden"
                      id="multi-image-upload"
                    />
                    <label htmlFor="multi-image-upload">
                      <Button variant="outline" className="w-full cursor-pointer" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Images
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                {/* Video Preview */}
                {templateType === 'video' && backgroundImage && (
                  <div>
                    <Label>Video Preview</Label>
                    <video
                      ref={videoRef}
                      src={backgroundImage}
                      className="w-full mt-2 rounded border"
                      controls
                      muted
                      style={{ maxHeight: '150px' }}
                    />
                  </div>
                )}

                {/* Tools */}
                <div>
                  <Label className="text-sm font-medium">Add Elements</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addText}
                      className="flex items-center gap-2"
                    >
                      <Type className="w-4 h-4" />
                      Text
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addRectangle}
                      className="flex items-center gap-2"
                    >
                      <Square className="w-4 h-4" />
                      Box
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCircle}
                      className="flex items-center gap-2 col-span-2"
                    >
                      <Circle className="w-4 h-4" />
                      Circle
                    </Button>
                  </div>
                </div>

                {/* Elements List (Sortable) */}
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2 mt-4"><Layers className="w-4 h-4" /> Elements</Label>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={elements.map((el) => el.__uid)} strategy={verticalListSortingStrategy}>
                      <div className="mt-2">
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
                <div className="pt-4 border-t border-border space-y-3">
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
            {/* Center - Canvas */}
            <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
              <div className="border border-border rounded-lg shadow-lg bg-white relative">
                <canvas ref={canvasRef} />
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
                Enter admin credentials to save as template
              </p>
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