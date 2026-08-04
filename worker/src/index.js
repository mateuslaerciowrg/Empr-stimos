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
    const contexto = (body.contexto || '').toString().slice(0, 200000);
    if (!pergunta.trim()) {
      return new Response(JSON.stringify({ error: 'pergunta_vazia' }), { status: 400, headers: corsHeaders() });
    }

    const systemPrompt =
      'Você é a IA do EmprestAI Pro, um app de gestão de empréstimos pessoais (crédito informal).\n' +
      'Responda SEMPRE em português do Brasil, direto e objetivo, curto (poucas frases ou uma lista curta).\n' +
      'Use os dados do CONTEXTO abaixo para responder — eles refletem o sistema no momento exato da pergunta, referentes ao ano indicado no campo "ano" do CONTEXTO.\n\n' +
      'O CONTEXTO tem 4 partes:\n' +
      '1. "kpis": totais gerais atuais — capital, a receber, e os totais já recebidos: "juros_total_recebido" (só juros), "multa_total_recebida" (só multa por atraso) e "lucro_total_recebido" (juros + multa, é o lucro real, NÃO inclui o principal emprestado).\n' +
      '2. "resumo_mensal_do_ano": uma lista com 12 posições (janeiro a dezembro), cada uma já soma os valores daquele mês — "total_emprestado_no_mes" (quanto foi emprestado/desembolsado naquele mês), "faturamento_recebido_no_mes" (total recebido, principal+juros+multa), "juros_recebido_no_mes" (só juros), "multa_recebida_no_mes" (só multa) e "lucro_recebido_no_mes" (juros+multa, o lucro do mês), além de "contratos_novos_no_mes" e "contratos_pagos_no_mes".\n' +
      '3. "clientes": um item por cliente, com score, status, dívida em aberto ("divida_aberta"), e os totais JÁ RECEBIDOS desse cliente somando todos os contratos pagos dele: "juros_total", "multa_total", "lucro_total" (juros+multa) e "faturado_total" (principal+juros+multa).\n' +
      '4. "emprestimos": um item por contrato de empréstimo, com todas as datas (emprestado_em, vencimento, pago_em) e valores: "principal" (valor emprestado), "juros", "multa", "lucro" (juros+multa, o lucro deste contrato) e "total" (principal+juros+multa, o valor total devido ou recebido deste contrato).\n\n' +
      'REGRA OBRIGATÓRIA SOBRE "total" x "lucro": campos "total"/"faturamento_recebido_no_mes"/"faturado_total" SEMPRE incluem o principal (o dinheiro emprestado de volta) — NUNCA são a mesma coisa que lucro. Campos "lucro"/"lucro_total"/"lucro_recebido_no_mes"/"lucro_total_recebido" são sempre juros+multa, SEM o principal. Se a pergunta for sobre lucro ou juros, NUNCA responda usando um campo "total"/"faturamento"/"faturado_total".\n' +
      'REGRA OBRIGATÓRIA: para QUALQUER pergunta sobre valores agregados de um mês, de um intervalo de meses, ou "desde o início do ano" (ex: "quanto emprestei em maio", "faturamento de março a junho", "lucro do ano até agora", "quanto de juros recebi esse ano", "quanto de multa recebi"), você DEVE usar exclusivamente os números já somados em "kpis" ou "resumo_mensal_do_ano" (campos "juros_recebido_no_mes", "multa_recebida_no_mes", "lucro_recebido_no_mes" ou "faturamento_recebido_no_mes", conforme o que for perguntado) — pegue o(s) mês(es) pedido(s) pelo campo "mes_num" (1=janeiro...12=dezembro) e some os campos correspondentes. NUNCA tente contar ou somar isso olhando a lista "emprestimos" item por item — é fácil errar contando manualmente, e esses totais já estão calculados corretamente.\n' +
      'Para perguntas sobre UM contrato ou cliente específico (ex: "quem está atrasado", "detalhe do empréstimo X", "quanto o João me deve", "qual o lucro do empréstimo X", "qual o lucro/juros do cliente Y"), use diretamente os campos já calculados desse item nas listas "emprestimos" (campo "lucro" para o lucro daquele contrato) ou "clientes" (campos "lucro_total"/"juros_total"/"multa_total" para os totais já recebidos daquele cliente) — não recalcule esses valores manualmente, e não use "total"/"faturado_total" para responder pergunta de lucro.\n' +
      'Antes de responder um número, confira mentalmente se ele veio do campo certo (juros vs multa vs lucro vs total/faturamento) e do mês/contrato/cliente certo.\n' +
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
