
insert into storage.buckets (id, name, public, file_size_limit)
values ('ai-uploads', 'ai-uploads', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "ai-uploads read" on storage.objects;
drop policy if exists "ai-uploads insert auth" on storage.objects;
drop policy if exists "ai-uploads delete own" on storage.objects;
create policy "ai-uploads read" on storage.objects for select using (bucket_id = 'ai-uploads');
create policy "ai-uploads insert auth" on storage.objects for insert to authenticated with check (bucket_id = 'ai-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ai-uploads delete own" on storage.objects for delete to authenticated using (bucket_id = 'ai-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_chat_messages_user_created_idx on public.ai_chat_messages(user_id, created_at);
alter table public.ai_chat_messages enable row level security;
drop policy if exists "ai_chat select own" on public.ai_chat_messages;
drop policy if exists "ai_chat insert own" on public.ai_chat_messages;
drop policy if exists "ai_chat delete own" on public.ai_chat_messages;
create policy "ai_chat select own" on public.ai_chat_messages for select to authenticated using (user_id = auth.uid());
create policy "ai_chat insert own" on public.ai_chat_messages for insert to authenticated with check (user_id = auth.uid());
create policy "ai_chat delete own" on public.ai_chat_messages for delete to authenticated using (user_id = auth.uid());
