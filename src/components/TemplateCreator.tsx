import { useState, useEffect, useRef } from "react";
import { X, Upload, Type, Square, Circle, Download, Save, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, Textbox, FabricImage } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      
      // Get canvas data with all objects including custom properties
      const canvasData = fabricCanvas.toJSON();
      
      // Create template data with proper structure for multiple elements
      const templateData = {
        canvas: canvasData,
        backgroundImage: backgroundImage,
        backgroundVideo: templateType === 'video' ? backgroundImage : null,
        dimensions: getCanvasDimensions(),
        elements: canvasData.objects || [],
        version: "1.0",
        type: templateType
      };

      // Generate thumbnail - handle both image and video backgrounds
      let thumbnailUrl;
      if (templateType === 'video' && videoFile) {
        // For video, create a canvas thumbnail
        thumbnailUrl = fabricCanvas.toDataURL({
          format: 'jpeg',
          quality: 0.8,
          multiplier: 0.5
        });
      } else {
        thumbnailUrl = fabricCanvas.toDataURL({
          format: 'jpeg',
          quality: 0.8,
          multiplier: 0.5
        });
      }

      const { error } = await supabase
        .from('templates')
        .insert({
          name: templateName,
          type: templateType,
          url: JSON.stringify(templateData),
          thumbnail_url: thumbnailUrl,
        });

      if (error) {
        toast.error("Failed to save template");
        console.error('Error:', error);
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
              <div className="border border-border rounded-lg shadow-lg bg-white">
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