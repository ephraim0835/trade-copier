const url = 'https://gaqcjqgcwscshxicpgup.supabase.co/rest/v1/Mt5Account?id=not.eq.0';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcWNqcWdjd3Njc2h4aWNwZ3VwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk1MzA0MSwiZXhwIjoyMTAyNTI5MDQxfQ.kHT72tbo23_T_ONjxVpDWTR4FcENURBxXTac_WOy0oE';

async function main() {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  console.log(res.status, await res.text());
}
main();
