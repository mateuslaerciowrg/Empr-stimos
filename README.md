# EmprestAI Pro

App de gestão de empréstimos e clientes. 100% estático (HTML + JS), hospedado no **GitHub Pages**, com **Firebase** (Auth + Realtime Database) para login e sincronização na nuvem.

## Arquitetura

- **Front-end:** `index.html` — app single-page em JavaScript puro, sem build.
- **Autenticação:** Firebase Authentication (email/senha + login com Google).
- **Banco de dados:** Firebase Realtime Database — dados por usuário em `u/{uid}`.
- **Offline:** localStorage (cache) + Service Worker (`sw.js`) + PWA instalável (`manifest.json`).
- **Hospedagem:** GitHub Pages (branch `main`).

## Deploy no GitHub Pages

1. No repositório: **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Selecione a branch **`main`** e a pasta **`/ (root)`**. Salve.
4. Aguarde ~1 min. O app fica em `https://<seu-usuario>.github.io/Empr-stimos/`.

Não há passo de build — o `index.html` é servido direto.

## Segurança do Firebase (IMPORTANTE)

A `apiKey` no código é pública por design no Firebase — ela **não** é secreta. A segurança real vem das **Security Rules** do Realtime Database.

Aplique as regras de `firebase-rules.json` para garantir que **cada usuário só acessa os próprios dados**:

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) com a conta dona do projeto `emprestai-83bf7`.
2. **Realtime Database → aba Rules (Regras)**.
3. Cole o conteúdo de `firebase-rules.json` e **Publique**.

> Sem essas regras, o banco pode estar aberto (qualquer pessoa lê/escreve todos os dados).

## Ativar login com Google

O botão "Continuar com Google" já está no código, mas precisa ser habilitado no console:

1. [console.firebase.google.com](https://console.firebase.google.com) → projeto `emprestai-83bf7`.
2. **Authentication → Sign-in method → Adicionar provedor → Google**.
3. Ative, defina um e-mail de suporte e **Salve**.
4. Em **Authentication → Settings → Authorized domains**, confira se `<seu-usuario>.github.io` está na lista (adicione se não estiver) — sem isso o popup do Google falha em produção.

## Desenvolvimento local

Sirva a pasta por HTTP (o Service Worker não roda via `file://`):

```bash
python -m http.server 8000
# abra http://localhost:8000
```
