import { useEffect, useState } from "react";
import { Edit3, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Template } from "./Dashboard";
import { toast } from "sonner";

interface TemplateGridProps {
  type: 'photo' | 'video';
  onEditTemplate: (template: Template) => void;
}

export const TemplateGrid = ({ type, onEditTemplate }: TemplateGridProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, [type]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to fetch templates');
        console.error('Error:', error);
        return;
      }

      setTemplates(data as Template[] || []);
    } catch (error) {
      toast.error('Failed to fetch templates');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">
          {type === 'photo' ? 'Photo' : 'Video'} Templates
        </h2>
        <p className="text-muted-foreground">
          Choose a template and start creating your meme
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            {type === 'photo' ? <Edit3 className="w-8 h-8" /> : <Play className="w-8 h-8" />}
          </div>
          <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
          <p className="text-muted-foreground">
            No {type} templates available. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="template-card p-4">
              <div className="relative group">
                <img
                  src={template.thumbnail_url || '/placeholder.svg'}
                  alt={template.name}
                  className="w-full h-48 object-cover rounded-lg mb-3"
                />
                {type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="w-12 h-12 text-primary opacity-70" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <Button
                    onClick={() => onEditTemplate(template)}
                    size="sm"
                    className="btn-gradient text-primary-foreground"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
              <h3 className="font-semibold text-sm mb-2">{template.name}</h3>
              <Button
                onClick={() => onEditTemplate(template)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Template
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};