import { useState, useRef, useEffect } from "react";
import { Canvas as FabricCanvas, Rect, Circle, Textbox, FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Type, 
  Square, 
  Circle as CircleIcon, 
  Upload, 
  Download, 
  Undo, 
  Redo, 
  Trash2,
  Save,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TemplateEditorProps {
  onClose: () => void;
  onSave: () => void;
}

export const TemplateEditor = ({ onClose, onSave }: TemplateEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<'photo' | 'video'>('photo');
  const [activeColor, setActiveColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");

  // Canvas dimensions based on template type
  const getCanvasDimensions = () => {
    if (templateType === 'video') {
      // Instagram Reel ratio (9:16)
      return { width: 400, height: 711 };
    } else {
      // Instagram Post ratio (1:1)
      return { width: 500, height: 500 };
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const dimensions = getCanvasDimensions();
    const canvas = new FabricCanvas(canvasRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: templateType === 'video' ? '#000000' : '#ffffff',
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [templateType]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    
    if (templateType === 'video' && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    } else if (templateType === 'photo' && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          if (!fabricCanvas) return;
          
          FabricImage.fromURL(e.target?.result as string).then((fabricImg) => {
            const dimensions = getCanvasDimensions();
            fabricImg.scaleToWidth(dimensions.width);
            fabricImg.scaleToHeight(dimensions.height);
            fabricImg.set({
              left: 0,
              top: 0,
              selectable: false,
              evented: false,
            });
            fabricCanvas.backgroundImage = fabricImg;
            fabricCanvas.renderAll();
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const addText = () => {
    if (!fabricCanvas) return;

    const text = new Textbox('Sample Text', {
      left: 50,
      top: 50,
      fontFamily: 'Arial',
      fontSize: fontSize,
      fill: activeColor,
      width: 200,
      editable: true,
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;

    const rect = new Rect({
      left: 100,
      top: 100,
      fill: activeColor,
      width: 100,
      height: 80,
      rx: 5,
      ry: 5,
    });

    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    fabricCanvas.renderAll();
  };

  const addCircle = () => {
    if (!fabricCanvas) return;

    const circle = new Circle({
      left: 100,
      top: 100,
      fill: activeColor,
      radius: 50,
    });

    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
    fabricCanvas.renderAll();
  };

  const deleteSelected = () => {
    if (!fabricCanvas) return;
    
    const activeObjects = fabricCanvas.getActiveObjects();
    fabricCanvas.discardActiveObject();
    fabricCanvas.remove(...activeObjects);
    fabricCanvas.renderAll();
  };

  const clearCanvas = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    const dimensions = getCanvasDimensions();
    fabricCanvas.backgroundColor = templateType === 'video' ? '#000000' : '#ffffff';
    fabricCanvas.renderAll();
  };

  const exportTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (!fabricCanvas) {
      toast.error("Canvas not initialized");
      return;
    }

    try {
      setLoading(true);
      
      let templateUrl = "";
      let thumbnailUrl = "";

      if (templateType === 'video' && uploadedFile) {
        // For video templates, we'll store the video file URL and canvas as thumbnail
        const videoFormData = new FormData();
        videoFormData.append('file', uploadedFile);
        
        // Upload video file (you'd need to implement proper file storage)
        templateUrl = URL.createObjectURL(uploadedFile);
        thumbnailUrl = fabricCanvas.toDataURL({
          format: 'png',
          quality: 0.8,
          multiplier: 1,
        });
      } else {
        // For photo templates, export the canvas
        templateUrl = fabricCanvas.toDataURL({
          format: 'png',
          quality: 0.8,
          multiplier: 1,
        });
        thumbnailUrl = templateUrl;
      }

      // Save template data to database
      const templateData = {
        canvas: fabricCanvas.toJSON(),
        dimensions: getCanvasDimensions(),
        type: templateType,
      };

      const { error } = await supabase
        .from('templates')
        .insert({
          name: templateName,
          type: templateType,
          url: templateUrl,
          thumbnail_url: thumbnailUrl,
          // Store canvas data in a separate field if needed
        });

      if (error) {
        toast.error("Failed to save template");
        console.error('Error:', error);
        return;
      }

      toast.success("Template saved successfully!");
      onSave();
      onClose();
    } catch (error) {
      toast.error("Failed to export template");
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex z-50">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Template Editor</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Template Settings */}
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
                  <SelectItem value="photo">Photo (Instagram Post 1:1)</SelectItem>
                  <SelectItem value="video">Video (Instagram Reel 9:16)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div>
              <Label htmlFor="file-upload">
                Upload {templateType === 'video' ? 'Video' : 'Background Image'}
              </Label>
              <div className="mt-1">
                <input
                  id="file-upload"
                  type="file"
                  accept={templateType === 'video' ? 'video/*' : 'image/*'}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {templateType === 'video' ? 'Video' : 'Image'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tools */}
        <div className="flex-1 p-4 overflow-y-auto">
          <Tabs defaultValue="elements" className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="elements">Elements</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
            </TabsList>

            <TabsContent value="elements" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Add Elements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={addText} variant="outline" className="w-full justify-start">
                    <Type className="w-4 h-4 mr-2" />
                    Add Text
                  </Button>
                  <Button onClick={addRectangle} variant="outline" className="w-full justify-start">
                    <Square className="w-4 h-4 mr-2" />
                    Add Rectangle
                  </Button>
                  <Button onClick={addCircle} variant="outline" className="w-full justify-start">
                    <CircleIcon className="w-4 h-4 mr-2" />
                    Add Circle
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={deleteSelected} variant="outline" className="w-full justify-start">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                  <Button onClick={clearCanvas} variant="outline" className="w-full justify-start">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Canvas
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="properties" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Color & Style</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="color-picker">Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        id="color-picker"
                        type="color"
                        value={activeColor}
                        onChange={(e) => setActiveColor(e.target.value)}
                        className="w-12 h-8 rounded border border-border"
                      />
                      <Input
                        value={activeColor}
                        onChange={(e) => setActiveColor(e.target.value)}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="font-size">Font Size</Label>
                    <Input
                      id="font-size"
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      min="8"
                      max="120"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Export Button */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={exportTemplate}
            disabled={loading}
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

      {/* Canvas Area */}
      <div className="flex-1 bg-muted/30 p-8 flex items-center justify-center">
        <div className="bg-card rounded-lg shadow-lg p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">
              {templateType === 'video' ? 'Video Template (9:16)' : 'Photo Template (1:1)'}
            </h3>
            <div className="text-sm text-muted-foreground">
              {getCanvasDimensions().width} × {getCanvasDimensions().height}
            </div>
          </div>
          
          <div className="relative">
            {templateType === 'video' && videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
                muted
                loop
                autoPlay
                style={{ 
                  width: getCanvasDimensions().width,
                  height: getCanvasDimensions().height 
                }}
              />
            )}
            <canvas
              ref={canvasRef}
              className="border border-border rounded-lg shadow-sm"
              style={{ 
                maxWidth: '100%',
                height: 'auto',
                background: templateType === 'video' ? 'transparent' : 'white'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};