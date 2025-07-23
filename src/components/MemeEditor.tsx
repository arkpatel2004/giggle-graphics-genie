import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Type, Square, Circle, RotateCcw, Save, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Template } from "./Dashboard";
import { Canvas as FabricCanvas, IText, Rect, Circle as FabricCircle, FabricImage } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MemeEditorProps {
  template: Template;
  onBack: () => void;
}

export const MemeEditor = ({ template, onBack }: MemeEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [textContent, setTextContent] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(32);
  const [templateName, setTemplateName] = useState("");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const dimensions = template.type === 'video' 
      ? { width: 400, height: 711 } // 9:16 ratio
      : { width: 400, height: 400 }; // 1:1 ratio

    // Initialize canvas
    const canvas = new FabricCanvas(canvasRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: "#ffffff",
    });

    // Load template layout
    loadTemplate(template, canvas);
    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [template]);

  const loadTemplate = (template: any, canvas: FabricCanvas) => {
    try {
      const layoutDefinition = template.layout_definition;
      
      // Set canvas properties
      if (layoutDefinition?.canvas) {
        canvas.setWidth(layoutDefinition.canvas.width || 400);
        canvas.setHeight(layoutDefinition.canvas.height || 400);
        canvas.backgroundColor = layoutDefinition.canvas.backgroundColor || '#ffffff';
      }
      
      // Load elements
      if (layoutDefinition?.elements && Array.isArray(layoutDefinition.elements)) {
        layoutDefinition.elements.forEach((element: any) => {
          if (element.type === 'textbox' || element.type === 'text') {
            const text = new IText(element.text || 'Sample Text', {
              left: element.x || 0,
              top: element.y || 0,
              fontSize: element.fontSize || 16,
              fontFamily: element.fontFamily || 'Arial',
              fill: element.color || '#000000',
            });
            canvas.add(text);
          } else if (element.type === 'rect') {
            const rect = new Rect({
              left: element.x || 0,
              top: element.y || 0,
              width: element.width || 100,
              height: element.height || 100,
              fill: element.fill || '#ffffff',
              stroke: element.strokeColor || '#000000',
              strokeWidth: element.strokeWidth || 1,
            });
            canvas.add(rect);
          } else if (element.type === 'circle') {
            const circle = new FabricCircle({
              left: element.x || 0,
              top: element.y || 0,
              radius: element.radius || 50,
              fill: element.fill || '#ffffff',
              stroke: element.strokeColor || '#000000',
              strokeWidth: element.strokeWidth || 1,
            });
            canvas.add(circle);
          } else if (element.type === 'image' && element.imageUrl) {
            FabricImage.fromURL(element.imageUrl).then((img) => {
              img.set({
                left: element.x || 0,
                top: element.y || 0,
                scaleX: (element.width || 100) / (img.width || 1),
                scaleY: (element.height || 100) / (img.height || 1),
              });
              canvas.add(img);
              canvas.renderAll();
            });
          }
        });
      }
      
      canvas.renderAll();
      toast.success(`Template "${template.name}" loaded!`);
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error("Failed to load template");
    }
  };

  const addText = () => {
    if (!fabricCanvas || !textContent.trim()) {
      toast.error("Please enter some text");
      return;
    }

    const text = new IText(textContent, {
      left: 50,
      top: 50,
      fontSize: fontSize,
      fill: textColor,
      fontFamily: 'Arial Black',
      stroke: '#000000',
      strokeWidth: 2,
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    setTextContent("");
    toast.success("Text added to meme!");
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;

    const rect = new Rect({
      left: 100,
      top: 100,
      fill: textColor,
      width: 100,
      height: 100,
      stroke: '#000000',
      strokeWidth: 2,
    });

    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    fabricCanvas.renderAll();
    toast.success("Rectangle added!");
  };

  const addCircle = () => {
    if (!fabricCanvas) return;

    const circle = new FabricCircle({
      left: 100,
      top: 100,
      fill: textColor,
      radius: 50,
      stroke: '#000000',
      strokeWidth: 2,
    });

    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
    fabricCanvas.renderAll();
    toast.success("Circle added!");
  };

  const clearCanvas = () => {
    if (!fabricCanvas) return;

    const objects = fabricCanvas.getObjects();
    // Remove all objects except the background image (first object)
    objects.forEach((obj, index) => {
      if (index > 0) {
        fabricCanvas.remove(obj);
      }
    });
    fabricCanvas.renderAll();
    toast.success("Canvas cleared!");
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

    setAdminLoading(true);
    try {
      // Simple admin check (username: admin, password: admin123)
      if (adminUsername === 'admin' && adminPassword === 'admin123') {
        toast.success("Admin access granted!");
        setShowAdminModal(false);
        await saveTemplateToDatabase();
      } else {
        toast.error("Invalid credentials");
      }
    } catch (error) {
      toast.error("Authentication failed");
    } finally {
      setAdminLoading(false);
    }
  };

  const saveTemplateToDatabase = async () => {
    if (!fabricCanvas || !templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    try {
      // Create thumbnail
      const thumbnailDataUrl = fabricCanvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.3
      });

      const response = await fetch(thumbnailDataUrl);
      const blob = await response.blob();
      const thumbnailFileName = `thumbnails/${Date.now()}-${templateName.replace(/\s+/g, '-').toLowerCase()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('template-assets')
        .upload(thumbnailFileName, blob);

      if (uploadError) {
        toast.error("Failed to upload thumbnail");
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('template-assets')
        .getPublicUrl(thumbnailFileName);

      // Prepare layout definition
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

        if (obj.type === 'i-text' || obj.type === 'textbox') {
          element.text = (obj as any).text || '';
          element.fontSize = (obj as any).fontSize || 16;
          element.fontFamily = (obj as any).fontFamily || 'Arial';
          element.color = (obj as any).fill || '#000000';
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
          width: fabricCanvas.width || 400,
          height: fabricCanvas.height || 400,
          backgroundColor: typeof fabricCanvas.backgroundColor === 'string' ? fabricCanvas.backgroundColor : '#ffffff'
        },
        elements
      };

      const { error } = await supabase
        .from('templates')
        .insert({
          name: templateName,
          type: template.type,
          layout_definition: layoutDefinition,
          thumbnail_url: publicUrl,
          tags: ['user-created', 'meme']
        });

      if (error) {
        toast.error("Failed to save template");
        return;
      }

      toast.success("Template saved successfully!");
      setTemplateName("");
      setAdminUsername("");
      setAdminPassword("");
    } catch (error) {
      toast.error("Failed to save template");
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
            Save Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas */}
        <div className="lg:col-span-2">
          <div className="bg-card p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Canvas</h3>
            <div className="border border-border rounded-lg overflow-hidden bg-white">
              <canvas ref={canvasRef} className="max-w-full" />
            </div>
          </div>
        </div>

        {/* Tools Panel */}
        <div className="space-y-6">
          {/* Text Tools */}
          <div className="bg-card p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Type className="w-5 h-5 mr-2" />
              Add Text
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="text-content">Text Content</Label>
                <Input
                  id="text-content"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Enter your text..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="text-color">Text Color</Label>
                <Input
                  id="text-color"
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <Label htmlFor="font-size">Font Size</Label>
                <Input
                  id="font-size"
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  min="12"
                  max="72"
                  className="mt-1"
                />
              </div>
              <Button onClick={addText} className="w-full btn-secondary-gradient text-secondary-foreground">
                <Type className="w-4 h-4 mr-2" />
                Add Text
              </Button>
            </div>
          </div>

          {/* Shape Tools */}
          <div className="bg-card p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Add Shapes</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={addRectangle} variant="outline" className="flex-1">
                <Square className="w-4 h-4 mr-2" />
                Rectangle
              </Button>
              <Button onClick={addCircle} variant="outline" className="flex-1">
                <Circle className="w-4 h-4 mr-2" />
                Circle
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-card p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Actions</h3>
            <div className="space-y-3">
              <Button onClick={clearCanvas} variant="outline" className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear All
              </Button>
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
          <div className="space-y-4">
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
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="admin123"
                  className="pl-10"
                />
              </div>
            </div>
            <Button 
              onClick={handleAdminLogin} 
              className="w-full"
              disabled={adminLoading}
            >
              {adminLoading ? "Authenticating..." : "Save Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};