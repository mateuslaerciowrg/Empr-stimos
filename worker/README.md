# IA do EmprestAI Pro — servidor (Cloudflare Worker)

Esse servidorzinho gratuito guarda sua chave da OpenAI e faz a chamada para
a IA por você. É necessário porque a própria OpenAI **bloqueia chamadas
diretas vindas de navegador** (política de CORS deles, não é algo que dá pra
configurar do nosso lado) — só aceita chamadas servidor-a-servidor. A chave
da OpenAI fica só aqui dentro, nunca no app nem no Firebase.

## Passo a passo (leva uns 5 minutos, sem cartão de crédito)

1. Abra um terminal **dentro desta pasta** (`worker/`) e rode:
   ```
   npx wrangler login
   ```
   Isso abre o navegador para você criar/entrar numa conta Cloudflare gratuita.

2. Cadastre sua chave da OpenAI como segredo (não fica salva em nenhum arquivo):
   ```
   npx wrangler secret put OPENAI_API_KEY
   ```
   Cole sua chave da OpenAI (começa com `sk-...`) quando pedir.

3. Crie uma senha qualquer só para evitar que estranhos na internet usem seu
   servidor e gastem sua cota da OpenAI (invente uma string longa e aleatória):
   ```
   npx wrangler secret put APP_SECRET
   ```

4. Publique o servidor:
   ```
   npx wrangler deploy
   ```
   Ao final, ele mostra uma URL parecida com:
   `https://emprestai-ia.SEUNOME.workers.dev`

5. No app, entre com a conta admin (lokoporgame194@gmail.com), abra a IA →
   ⚙️ e cole essa URL + a mesma senha do passo 3. Isso fica salvo no Firebase
   e sincroniza automaticamente para todas as contas do sistema.

## Custo

O plano gratuito da Cloudflare cobre até 100.000 chamadas/dia — não deve custar
nada. O único custo real é o uso da própria API da OpenAI (cobrado por você
diretamente na sua conta OpenAI, por token usado). O modelo usado é o
`gpt-4o-mini`, o mais barato da OpenAI.
