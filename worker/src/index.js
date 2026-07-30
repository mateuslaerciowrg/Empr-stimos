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
    const contexto = (body.contexto || '').toString().slice(0, 90000);
    if (!pergunta.trim()) {
      return new Response(JSON.stringify({ error: 'pergunta_vazia' }), { status: 400, headers: corsHeaders() });
    }

    const systemPrompt =
      'Você é a IA do EmprestAI Pro, um app de gestão de empréstimos pessoais (crédito informal).\n' +
      'Responda SEMPRE em português do Brasil, direto e objetivo, curto (poucas frases ou uma lista curta).\n' +
      'Use os dados do CONTEXTO abaixo para responder — eles refletem o sistema no momento exato da pergunta, referentes ao ano indicado no campo "ano" do CONTEXTO.\n\n' +
      'O CONTEXTO tem 4 partes:\n' +
      '1. "kpis": totais gerais atuais (capital, a receber, lucro total, etc).\n' +
      '2. "resumo_mensal_do_ano": uma lista com 12 posições (janeiro a dezembro), cada uma já soma os valores daquele mês — "total_emprestado_no_mes" (quanto foi emprestado/desembolsado naquele mês), "faturamento_recebido_no_mes" e "lucro_recebido_no_mes" (o que foi efetivamente recebido de pagamentos feitos naquele mês), "contratos_novos_no_mes" e "contratos_pagos_no_mes".\n' +
      '3. "clientes": um item por cliente (score, status, dívida em aberto).\n' +
      '4. "emprestimos": um item por contrato de empréstimo, com todas as datas (emprestado_em, vencimento, pago_em) e valores.\n\n' +
      'REGRA OBRIGATÓRIA: para QUALQUER pergunta sobre valores agregados de um mês, de um intervalo de meses, ou "desde o início do ano" (ex: "quanto emprestei em maio", "faturamento de março a junho", "lucro do ano até agora"), você DEVE usar exclusivamente os números já somados em "resumo_mensal_do_ano" — pegue o(s) mês(es) pedido(s) pelo campo "mes_num" (1=janeiro...12=dezembro) e some os campos correspondentes. NUNCA tente contar ou somar isso olhando a lista "emprestimos" item por item — é fácil errar contando manualmente, e "resumo_mensal_do_ano" já está calculado corretamente.\n' +
      'Só use a lista "emprestimos" para perguntas sobre UM contrato ou cliente específico (ex: "quem está atrasado", "detalhe do empréstimo X", "quanto o João me deve").\n' +
      'Antes de responder um número, confira mentalmente se ele veio do campo certo de "resumo_mensal_do_ano" e do mês certo.\n' +
      'Nunca invente cliente, valor ou empréstimo que não esteja no CONTEXTO. Se a informação pedida não estiver lá (ex: ano anterior não presente), diga isso claramente em vez de adivinhar.\n' +
      'Use R$ para valores monetários e "**texto**" para destacar números importantes.\n\n' +
      'CONTEXTO ATUAL DO SISTEMA:\n' + contexto;

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: pergunta }
      ],
      max_tokens: 800,
      temperature: 0
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
