import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Type, Square, Circle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Template } from "./Dashboard";
import { Canvas as FabricCanvas, FabricText, Rect, Circle as FabricCircle, FabricImage } from "fabric";
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

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize canvas
    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: "#ffffff",
    });

    // Load the template image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const fabricImg = new FabricImage(img, {
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });

      // Scale image to fit canvas
      const scaleX = canvas.width! / img.width;
      const scaleY = canvas.height! / img.height;
      const scale = Math.min(scaleX, scaleY);
      
      fabricImg.scale(scale);
      
      // Center the image
      fabricImg.set({
        left: (canvas.width! - img.width * scale) / 2,
        top: (canvas.height! - img.height * scale) / 2,
      });

      canvas.add(fabricImg);
      canvas.renderAll();
    };
    
    img.src = template.url;
    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [template]);

  const addText = () => {
    if (!fabricCanvas || !textContent.trim()) {
      toast.error("Please enter some text");
      return;
    }

    const text = new FabricText(textContent, {
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
        multiplier: 1,
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
        <Button onClick={downloadMeme} className="btn-gradient text-primary-foreground">
          <Download className="w-4 h-4 mr-2" />
          Download Meme
        </Button>
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
    </div>
  );
};