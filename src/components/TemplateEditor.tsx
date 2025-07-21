import { useState, useEffect, useRef } from "react";
import { X, Upload, Type, Square, Circle, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, Textbox } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TemplateEditorProps {
  onClose: () => void;
}

export const TemplateEditor = ({ onClose }: TemplateEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<'photo' | 'video'>('photo');
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

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

    return () => {
      canvas.dispose();
    };
  }, [templateType]);

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
          fabricCanvas.backgroundColor = imageUrl;
          fabricCanvas.renderAll();
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

  const exportTemplate = async () => {
    if (!fabricCanvas || !templateName) {
      toast.error("Please provide template name");
      return;
    }

    try {
      setLoading(true);
      
      let templateData;
      let thumbnailUrl = "";

      if (templateType === 'video' && videoFile) {
        // For video templates, save the video file and canvas overlay
        const canvas = fabricCanvas.toJSON();
        templateData = JSON.stringify({
          canvas: canvas,
          videoBackground: true,
          dimensions: getCanvasDimensions()
        });
        
        // Use video file URL as background
        thumbnailUrl = backgroundImage;
      } else {
        // For photo templates, export as image
        const canvasData = fabricCanvas.toJSON();
        const imageData = fabricCanvas.toDataURL();
        
        templateData = JSON.stringify({
          canvas: canvasData,
          imageBackground: backgroundImage,
          dimensions: getCanvasDimensions()
        });
        
        thumbnailUrl = imageData;
      }

      const { error } = await supabase
        .from('templates')
        .insert({
          name: templateName,
          type: templateType,
          url: templateData,
          thumbnail_url: thumbnailUrl,
        });

      if (error) {
        toast.error("Failed to save template");
        console.error('Error:', error);
        return;
      }

      toast.success("Template saved successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to export template");
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const dimensions = getCanvasDimensions();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">Template Editor</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
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

              {/* Background Upload */}
              <div>
                <Label>Background {templateType === 'video' ? 'Video' : 'Image'}</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    accept={templateType === 'video' ? "video/*" : "image/*"}
                    onChange={handleBackgroundUpload}
                    className="hidden"
                    id="background-upload"
                  />
                  <label htmlFor="background-upload">
                    <Button variant="outline" className="w-full cursor-pointer" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload {templateType === 'video' ? 'Video' : 'Image'}
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

              {/* Export */}
              <div className="pt-4 border-t border-border">
                <Button
                  onClick={exportTemplate}
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
            <div className="border border-border rounded-lg shadow-lg bg-white">
              <canvas ref={canvasRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};