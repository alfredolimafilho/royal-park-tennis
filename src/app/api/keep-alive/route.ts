import { supabase } from '@/lib/supabase'

// Keep-alive do Supabase, chamado diariamente pelo Cron da Vercel (vercel.json).
//
// Projetos no plano Free do Supabase são pausados após dias sem atividade.
// Esta rota faz uma consulta leve ao banco para registrar atividade.
// Diferente do GitHub Actions (que desativa agendamentos após 60 dias sem
// commits no repositório), o Cron da Vercel continua rodando indefinidamente.
export async function GET(request: Request) {
  // Se CRON_SECRET estiver configurado na Vercel, ela envia esse token
  // automaticamente; chamadas de fora sem o token são recusadas.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { error } = await supabase.from('users').select('id').limit(1)
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true, at: new Date().toISOString() })
}
