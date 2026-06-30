-- Login por nombre de usuario (en lugar de correo)
alter table public.perfiles add column if not exists username text unique;

-- Convertir el administrador existente a usuario "admin" (correo interno admin@deluxe.local)
do $$
declare uid uuid;
begin
  select id into uid from auth.users where email = 'sterlinr08@gmail.com';
  if uid is null then
    select id into uid from auth.users where email = 'admin@deluxe.local';
  end if;
  if uid is not null then
    update auth.users set email = 'admin@deluxe.local', updated_at = now() where id = uid;
    update auth.identities
      set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', '"admin@deluxe.local"'),
          updated_at = now()
      where user_id = uid;
    update public.perfiles set username = 'admin', email = 'admin@deluxe.local' where id = uid;
  end if;
end $$;
