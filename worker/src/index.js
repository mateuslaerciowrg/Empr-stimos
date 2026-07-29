function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
    'Content-Type': 'application/json'
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders() });
    }

    const appSecret = request.headers.get('X-App-Secret') || '';
    if (!env.APP_SECRET || appSecret !== env.APP_SECRET) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: corsHeaders() });
    }

    const pergunta = (body.pergunta || '').toString().slice(0, 2000);
    const contexto = (body.contexto || '').toString().slice(0, 14000);
    if (!pergunta.trim()) {
      return new Response(JSON.stringify({ error: 'pergunta_vazia' }), { status: 400, headers: corsHeaders() });
    }

    const systemPrompt =
      'Você é a IA do EmprestAI Pro, um app de gestão de empréstimos pessoais (crédito informal).\n' +
      'Responda SEMPRE em português do Brasil, direto e objetivo, curto (poucas frases ou uma lista curta).\n' +
      'Use os dados do CONTEXTO abaixo para responder — eles refletem o sistema no momento exato da pergunta.\n' +
      'Nunca invente cliente, valor ou empréstimo que não esteja no CONTEXTO. Se a informação não estiver lá, diga que não tem esse dado.\n' +
      'Use R$ para valores monetários e "**texto**" para destacar números importantes.\n\n' +
      'CONTEXTO ATUAL DO SISTEMA:\n' + contexto;

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: pergunta }
      ],
      max_tokens: 550,
      temperature: 0.3
    };

    let resp;
    try {
      resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + env.OPENAI_API_KEY
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'openai_unreachable' }), { status: 502, headers: corsHeaders() });
    }

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'openai_error', status: resp.status, detail: detail.slice(0, 500) }), { status: 502, headers: corsHeaders() });
    }

    const data = await resp.json();
    const resposta = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || 'Não consegui gerar uma resposta agora.';
    return new Response(JSON.stringify({ resposta: resposta }), { headers: corsHeaders() });
  }
};
