# Site institucional ST

O endereço inicial do frontend apresenta o site institucional, sem autenticação e sem depender da API. As rotas existentes do sistema continuam acessíveis por hash:

- `/`: site público;
- `/#/login`: acesso ao sistema;
- `/#/trabalhe-conosco`: vagas e candidaturas existentes;
- `/#/dailyOps` e demais rotas internas: sistema com autenticação existente.

As âncoras `#empresa`, `#servicos`, `#atuacao` e `#contato` navegam no site. O carregamento separado em `src/entry.jsx` evita carregar o CSS e os módulos operacionais durante a visita pública. A mudança entre site e sistema recarrega a página para isolar os estilos.

## Execução e publicação

Execute `npm ci` e `npm run dev` na pasta `frontend`. Para produção, execute `npm run build`; o resultado está em `dist`. O serviço estático já descrito em `../render.yaml` serve esse build. A implementação local não altera uma implantação existente automaticamente.

## Conteúdo e contato

Textos, trajetória, clientes referenciais, serviços, endereço e contatos foram adaptados do arquivo fornecido `PORTFÓLIO DE SERVIÇOS ATUAL REV.01.pptx`. Não são publicados os contatos pessoais das referências comerciais. Os nomes de clientes refletem o portfólio, sem afirmar contratos atuais ou reproduzir depoimentos.

O formulário abre uma conversa no WhatsApp com os campos preenchidos. Não há envio silencioso nem gravação dos dados comerciais na API. Telefone e e-mail também possuem links diretos. O recrutamento usa a API e as telas já existentes no sistema.

## Imagens e tipografia

As fotografias são ilustrativas, não registros das instalações da ST. Os arquivos são servidos localmente em `public/images/`:

- Armazém: identificador do CDN Unsplash `photo-1586528116311-ad8dd3c8310d`.
- Terminal de contêineres: identificador do CDN Unsplash `photo-1494412519320-aa613dfb7738`.

URLs de origem: `https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d` e `https://images.unsplash.com/photo-1494412519320-aa613dfb7738`. A marca existente foi preservada. DM Sans e Manrope são carregadas pelo Google Fonts, com fontes locais de fallback.

## Validação

Build de produção e os seis testes existentes de regressão aprovados. Verificados no navegador: cinco larguras entre 360 e 1440 px sem transbordamento horizontal; menu móvel; abas por clique e teclado; abertura e fechamento da privacidade; navegação entre site, login e vagas; composição correta da mensagem de contato, interceptada sem envio externo.

A API local não estava em execução. A autenticação com credenciais e o carregamento de vagas reais não foram validados nesta sessão. O site institucional e o contato comercial não dependem da API.
