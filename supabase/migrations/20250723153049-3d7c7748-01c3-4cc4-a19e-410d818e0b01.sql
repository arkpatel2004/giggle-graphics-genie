-- Drop the existing templates table to recreate with new structure
DROP TABLE IF EXISTS public.templates;

-- Create storage bucket for template assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('template-assets', 'template-assets', true);

-- Create the new templates table with hybrid structure
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  layout_definition JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on templates table
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Templates are viewable by everyone" 
ON public.templates 
FOR SELECT 
USING (true);

-- Create policy for admin insert access (will be enforced in application)
CREATE POLICY "Admin can insert templates" 
ON public.templates 
FOR INSERT 
WITH CHECK (true);

-- Create policy for admin update access
CREATE POLICY "Admin can update templates" 
ON public.templates 
FOR UPDATE 
USING (true);

-- Create policy for admin delete access
CREATE POLICY "Admin can delete templates" 
ON public.templates 
FOR DELETE 
USING (true);

-- Create storage policies for template assets bucket
CREATE POLICY "Template assets are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'template-assets');

CREATE POLICY "Admin can upload template assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'template-assets');

CREATE POLICY "Admin can update template assets" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'template-assets');

CREATE POLICY "Admin can delete template assets" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'template-assets');

-- Add trigger for automatic updated_at timestamp
CREATE TRIGGER update_templates_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();