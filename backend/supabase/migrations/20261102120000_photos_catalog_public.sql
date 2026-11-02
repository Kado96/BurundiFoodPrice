-- Bucket photos public + droits catalogue (marchés / produits / branding)
-- Chemins : catalogs/markets|products|brandings/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique des photos catalogue (affichage site / APK)
drop policy if exists "photos public catalog read" on storage.objects;
create policy "photos public catalog read"
  on storage.objects for select
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'catalogs'
  );

-- Admins : upload / update / delete dans catalogs/
drop policy if exists "photos admin catalog insert" on storage.objects;
create policy "photos admin catalog insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'catalogs'
    and public.is_admin(auth.uid())
  );

drop policy if exists "photos admin catalog update" on storage.objects;
create policy "photos admin catalog update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'catalogs'
    and public.is_admin(auth.uid())
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'catalogs'
    and public.is_admin(auth.uid())
  );

drop policy if exists "photos admin catalog delete" on storage.objects;
create policy "photos admin catalog delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'catalogs'
    and public.is_admin(auth.uid())
  );
