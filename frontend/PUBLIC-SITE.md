# Site institucional ST

O endereço inicial do frontend apresenta o site institucional, sem autenticação e sem depender da API. As rotas existentes do sistema continuam acessíveis por hash:

- `/`: site público;
- `/#/login`: acesso ao sistema;
- `/#/trabalhe-conosco`: vagas e candidaturas existentes;
- `/#/dailyOps` e demais rotas internas: sistema com autenticação existente.

As âncoras `#empresa`, `#servicos`, `#clientes`, `#atuacao` e `#contato` navegam no site. O carregamento separado em `src/entry.jsx` evita carregar o CSS e os módulos operacionais durante a visita pública. A mudança entre site e sistema recarrega a página para isolar os estilos.

## Execução e publicação

Execute `npm ci` e `npm run dev` na pasta `frontend`. Para produção, execute `npm run build`; o resultado está em `dist`. O serviço estático já descrito em `../render.yaml` serve esse build. A implementação local não altera uma implantação existente automaticamente.

## Conteúdo e contato

O bloco promocional de apresentação e o botão de download foram removidos a pedido do usuário. As referências comerciais ficam na seção de clientes, logo abaixo da relação completa de empresas.

Textos, trajetória, clientes, serviços, endereço e contatos foram adaptados do arquivo fornecido `PORTFÓLIO DE SERVIÇOS ATUAL REV.01.pptx`. A página apresenta as seis referências comerciais por empresa e cargo e direciona consultas à ST. A edição pública para download preserva os 16 slides e substitui os nomes e telefones pessoais dessas referências pelo contato comercial da ST. O original permanece inalterado em Downloads e não é enviado ao repositório. Os nomes de clientes refletem o portfólio, sem afirmar contratos atuais ou reproduzir depoimentos. A cobertura dos 16 slides está registrada em `PORTFOLIO-COVERAGE.md`.

O formulário abre uma conversa no WhatsApp com os campos preenchidos. Não há envio silencioso nem gravação dos dados comerciais na API. Telefone e e-mail também possuem links diretos. O recrutamento usa a API e as telas já existentes no sistema.

## Imagens e tipografia

As fotografias são ilustrativas, não registros das instalações da ST. Os arquivos são servidos localmente em `public/images/`:

- Armazém: identificador do CDN Unsplash `photo-1586528116311-ad8dd3c8310d`.
- Terminal de contêineres: identificador do CDN Unsplash `photo-1494412519320-aa613dfb7738`.

URLs de origem: `https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d` e `https://images.unsplash.com/photo-1494412519320-aa613dfb7738`. A marca existente foi preservada. DM Sans e Manrope são carregadas pelo Google Fonts, com fontes locais de fallback.

## Direção visual e clientes

A revisão visual usa o azul institucional da ST, azul-marinho e vermelho nas ações comerciais. Referências de apresentação: GXO (`https://gxo.com/`) e Kuehne+Nagel (`https://www.kuehne-nagel.com/`). Cabeçalho único e compacto, abertura fotográfica, serviços em abas e textos voltados ao cliente.

A faixa de clientes usa SVGs locais em `public/images/clients/`. São dois grupos idênticos, com a cópia visual oculta para leitores de tela. A animação automática pausa ao passar o mouse e respeita `prefers-reduced-motion`. Os grupos cobrem a largura da tela para evitar espaços vazios no fechamento do ciclo, inclusive em monitores largos. O controle visual de reprodução foi removido a pedido do usuário.

Fontes dos arquivos de marca:

- Daikin: `https://i.logos-download.com/7538/1706-0c93dd40fac272e5582960d1cb7aa721.svg/Daikin_Logo_1985.svg`
- Michelin: `https://www.logo.wine/a/logo/Michelin/Michelin-Logo.wine.svg`
- FedEx: `https://cdn.worldvectorlogo.com/logos/fedex-express-6.svg`
- Fujifilm: `https://commons.wikimedia.org/wiki/Special:Redirect/file/Fujifilm_logo.svg`
- TCL: `https://cdn.worldvectorlogo.com/logos/tcl-1.svg`
- Elgin: `https://cdn.worldvectorlogo.com/logos/elgin.svg`

As margens internas dos SVGs foram ajustadas pelo viewBox para uniformizar a apresentação, preservando os desenhos e as cores das marcas. Os logotipos identificam empresas constantes no portfólio fornecido.

## Validação

Build de produção e os seis testes existentes de regressão aprovados. Na revisão visual, verificados no navegador: sete larguras entre 360 e 2560 px sem transbordamento horizontal; continuidade da faixa de clientes no fim do ciclo; pausa e retomada; preferência de movimento reduzido; carregamento de todos os logotipos; menu móvel; abas por clique e teclado; abertura e fechamento da privacidade; navegação entre site e login; composição correta da mensagem de contato, interceptada sem envio externo. A navegação para a tela de vagas foi validada na implementação inicial.

A API local não estava em execução. A autenticação com credenciais e o carregamento de vagas reais não foram validados nesta sessão. O site institucional e o contato comercial não dependem da API.
