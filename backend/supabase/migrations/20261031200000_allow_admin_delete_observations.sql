-- Migration : Permettre la suppression des observations par les administrateurs et le créateur
GRANT DELETE ON public.observations TO authenticated;

DROP POLICY IF EXISTS "admin delete observations" ON public.observations;
CREATE POLICY "admin delete observations"
ON public.observations
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()) OR agent_id = auth.uid());
