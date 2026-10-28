create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-push-notifications',
  '*/5 * * * *',
  $$
  -- Sem chave: a função roda com "Verify JWT" desligado (usa a própria service role internamente)
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-push-notifications'
  );
  $$
);
