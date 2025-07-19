-- Create templates table for storing photo and video meme templates
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin credentials table
CREATE TABLE public.admin_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for public access to templates (read-only for users)
CREATE POLICY "Templates are viewable by everyone" 
ON public.templates 
FOR SELECT 
USING (true);

-- Create policies for admin credentials (only accessible for authentication)
CREATE POLICY "Admin credentials are accessible for authentication" 
ON public.admin_credentials 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default admin credentials (username: admin, password: admin123)
-- In production, you should use a proper password hash
INSERT INTO public.admin_credentials (username, password_hash) 
VALUES ('admin', '$2a$10$8K1p/a/ba3UUdOgIgvLlg.ZvL2FLihKpVPPsLOcv8tPcUbV4P2YnW');

-- Insert some sample templates
INSERT INTO public.templates (name, type, url, thumbnail_url) VALUES 
('Drake Pointing Meme', 'photo', 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=300&fit=crop'),
('Distracted Boyfriend', 'photo', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop'),
('Woman Yelling at Cat', 'photo', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=300&fit=crop'),
('Sample Reel Template', 'video', 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=600&fit=crop', 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=200&h=300&fit=crop'),
('Tech Reel', 'video', 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=400&h=600&fit=crop', 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=200&h=300&fit=crop');