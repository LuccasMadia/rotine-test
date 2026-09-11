create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-push-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-push-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')
  );
  $$
);
