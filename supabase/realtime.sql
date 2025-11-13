-- Enable realtime for pedidos and include old values on updates
-- Run this in Supabase SQL editor once
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;