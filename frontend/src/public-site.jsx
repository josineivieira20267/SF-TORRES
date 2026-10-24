import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import logo from './assets/sf-torres-logo-transparent.png';
import './public-site.css';

const whatsapp = 'https://wa.me/5592992678067';
const clients = [
  { name: 'Daikin', file: 'daikin-current.svg' },
  { name: 'Michelin', file: 'michelin-current.svg' },
  { name: 'FedEx', file: 'fedex-express-6.svg' },
  { name: 'Fujifilm', file: 'fujifilm-current.svg' },
  { name: 'TCL', file: 'tcl-1.svg' },
  { name: 'Elgin', file: 'elgin.svg' },
];
const services = [
  {
    title: 'Operações logísticas', short: 'Sua operação, do início ao fim.',
    text: 'Do recebimento à expedição, colocamos equipes em campo para manter o fluxo de materiais organizado e a sua operação em movimento.',
    items: ['Ova, desova e unitização de cargas', 'Picking, etiquetagem e expedição', 'Movimentação interna de materiais', 'Abastecimento de linhas de produção'],
    image: '/images/logistics-warehouse.jpg', alt: 'Estrutura de armazenagem e movimentação de mercadorias',
  },
  {
    title: 'Estoques e almoxarifado', short: 'Mais controle. Melhores decisões.',
    text: 'Estoque organizado é uma base para produzir, atender e planejar melhor. Estruturamos as rotinas de armazenagem e controle de materiais da sua empresa.',
    items: ['Gestão de almoxarifado', 'Inventários gerais e rotativos', 'Localização e identificação de materiais', 'Planejamento e controle de materiais'],
    image: '/images/logistics-warehouse.jpg', alt: 'Mercadorias organizadas em estruturas de armazenagem',
  },
  {
    title: 'Terceirização de serviços', short: 'Pessoas preparadas para fazer acontecer.',
    text: 'Apoio operacional com seleção, treinamento e acompanhamento de profissionais, de acordo com a rotina e a necessidade do seu negócio.',
    items: ['Equipes de apoio logístico', 'Conferentes e almoxarifes', 'Liderança de equipes operacionais', 'Conservação e limpeza'],
    image: '/images/logistics-operation.jpg', alt: 'Vista aérea de um terminal de movimentação de cargas',
  },
  {
    title: 'Treinamento e consultoria', short: 'Experiência que desenvolve equipes.',
    text: 'Transformamos conhecimento em prática. Capacitação e consultoria para aprimorar processos, desenvolver lideranças e enfrentar os desafios da operação.',
    items: ['Gestão de estoques e almoxarifado', 'Lean Manufacturing e programa 10S', 'Custos logísticos e produtividade', 'Formação de almoxarifes e líderes'],
    image: '/images/logistics-operation.jpg', alt: 'Contêineres organizados em um terminal logístico',
  },
];

function Arrow({ diagonal = false }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={diagonal ? 'M5 19 19 5M5 5h14v14' : 'M4 12h15m-6-6 6 6-6 6'} /></svg>;
}

function Brand({ footer = false }) {
  return <a className={`st-brand${footer ? ' st-brand-footer' : ''}`} href="#inicio" aria-label="ST Serviços de Logística — início"><img src={logo} width="724" height="516" alt="ST Serviços de Logística" /></a>;
}

function ClientMarquee() {
  const [paused, setPaused] = useState(false);
  return <section className="st-clients" id="clientes" aria-labelledby="st-clients-title">
    <div className="st-container st-clients-heading">
      <div><span className="st-kicker">NOSSOS CLIENTES</span><h2 id="st-clients-title">Confiança construída<br /><em>na operação.</em></h2></div>
      <div className="st-clients-controls"><p>Grandes empresas.<br />Parcerias que fazem parte da nossa história.</p>
        <button type="button" className="st-motion-toggle" aria-label={paused ? 'Retomar faixa de clientes' : 'Pausar faixa de clientes'} aria-pressed={paused} onClick={() => setPaused(!paused)}>
          {paused ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6z" fill="currentColor" /></svg> : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4v12M13 4v12" stroke="currentColor" strokeWidth="2" /></svg>}
        </button>
      </div>
    </div>
    <div className={`st-marquee${paused ? ' st-marquee-paused' : ''}`}>
      <div className="st-marquee-track">{[0, 1].map(copy => <ul className="st-marquee-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
        {clients.map(client => <li key={client.name}><img src={`/images/clients/${client.file}`} alt={copy === 0 ? client.name : ''} width="180" height="65" loading="eager" draggable="false" /></li>)}
      </ul>)}</div>
    </div>
  </section>;
}

function PublicSite() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeService, setActiveService] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [inquiry, setInquiry] = useState({ name: '', company: '', service: '', message: '' });
  const service = services[activeService];

  useEffect(() => {
    const close = () => setMenuOpen(false);
    const escape = event => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('hashchange', close);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('hashchange', close); window.removeEventListener('keydown', escape); };
  }, []);

  useEffect(() => {
    if (!privacyOpen) return;
    const dialog = document.getElementById('st-privacy');
    dialog.showModal();
    return () => dialog.close();
  }, [privacyOpen]);

  function submitInquiry(event) {
    event.preventDefault();
    const message = `Olá! Sou ${inquiry.name}, da empresa ${inquiry.company}.\nTenho interesse em ${inquiry.service}.\n\n${inquiry.message}`;
    window.open(`${whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  function navigateService(event, index) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? services.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + services.length) % services.length;
    setActiveService(next);
    document.getElementById(`st-tab-${next}`).focus();
  }

  return <div className="st-site" id="inicio">
    <a className="st-skip" href="#conteudo">Pular para o conteúdo</a>
    <header className="st-header">
      <div className="st-container st-header-inner">
        <Brand />
        <button type="button" className={`st-menu-toggle${menuOpen ? ' st-menu-active' : ''}`} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="st-navigation" onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
        <nav id="st-navigation" className={`st-nav${menuOpen ? ' st-nav-open' : ''}`} aria-label="Navegação principal">
          <div className="st-nav-main"><a href="#empresa">A empresa</a><a href="#servicos">Soluções</a><a href="#clientes">Clientes</a><a href="#atuacao">Segmentos</a></div>
          <div className="st-nav-secondary"><a href="#/trabalhe-conosco">Carreiras <Arrow diagonal /></a><a href="#/login" className="st-system-link" aria-label="Acesso ao sistema"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="10" cy="6" r="3" /><path d="M4 18v-2a6 6 0 0 1 12 0v2" /></svg><span>Acesso ao sistema</span></a></div>
          <a className="st-nav-contact" href="#contato">Solicitar proposta <Arrow diagonal /></a>
        </nav>
      </div>
    </header>

    <main id="conteudo">
      <section className="st-hero" aria-labelledby="st-hero-title">
        <img className="st-hero-image" src="/images/logistics-operation.jpg" alt="Vista aérea de um terminal de contêineres e suas vias de movimentação" fetchpriority="high" width="1400" height="933" />
        <div className="st-hero-shade" />
        <div className="st-container st-hero-content">
          <div className="st-kicker st-kicker-light"><span /> EXPERIÊNCIA QUE MOVIMENTA NEGÓCIOS</div>
          <h1 id="st-hero-title">Sua operação.<br /><em>Nossa força.</em></h1>
          <p>Logística, pessoas e processos no mesmo ritmo.<br />Soluções para o seu negócio seguir em frente.</p>
          <div className="st-hero-actions"><a className="st-button st-button-red" href="#servicos">Explore nossas soluções <Arrow diagonal /></a><a className="st-hero-talk" href="#contato">Fale com um especialista <Arrow /></a></div>
        </div>
        <div className="st-container st-hero-bottom"><div className="st-hero-experience"><strong>20<span>+</span></strong><span>ANOS DE EXPERIÊNCIA<br />A SERVIÇO DO SEU NEGÓCIO</span></div><div className="st-hero-location"><span className="st-location-dot" />MANAUS, AMAZONAS</div><a href="#clientes" className="st-scroll" aria-label="Conhecer nossos clientes"><span>CONTINUE EXPLORANDO</span><span className="st-scroll-arrow">↓</span></a></div>
      </section>

      <ClientMarquee />

      <section className="st-intro st-container" id="empresa" aria-labelledby="st-intro-title">
        <div className="st-section-label"><span>A ST SERVIÇOS DE LOGÍSTICA</span><span>CONHECIMENTO EM CAMPO. COMPROMISSO NA ENTREGA.</span></div>
        <div className="st-intro-grid"><div><h2 id="st-intro-title">O seu negócio precisa<br />avançar.<br /><em>A gente faz parte<br />desse movimento.</em></h2><a className="st-text-link" href="#contato">Conheça o que podemos fazer juntos <Arrow diagonal /></a></div><div className="st-intro-copy"><p className="st-lead">Gente preparada.<br />Processos bem executados.<br />Uma operação que acompanha você.</p><p>Há mais de 20 anos, a ST atua com logística, terceirização de serviços, treinamento e consultoria empresarial em Manaus. Unimos experiência prática e acompanhamento próximo para atender às necessidades de cada empresa.</p><p>Do recebimento de materiais ao desenvolvimento da sua equipe, trabalhamos ao seu lado para organizar rotinas, identificar gargalos e melhorar o dia a dia da operação.</p><div className="st-intro-proof"><strong>40<span>+</span></strong><p>Anos de trajetória do fundador<br />nas áreas de logística e gestão.</p></div></div></div>
      </section>

      <section className="st-solutions" id="servicos" aria-labelledby="st-solutions-title">
        <div className="st-container">
          <div className="st-section-label"><span>SOLUÇÕES PARA O SEU NEGÓCIO</span><span>DA ESTRATÉGIA À EXECUÇÃO.</span></div>
          <div className="st-section-heading"><h2 id="st-solutions-title">Sua próxima etapa<br /><em>começa aqui.</em></h2><p>Quatro frentes de atuação.<br />Um compromisso: fazer a sua operação evoluir.</p></div>
          <div className="st-service-layout">
            <div className="st-service-list" role="tablist" aria-label="Soluções da ST" aria-orientation="vertical">
              {services.map((item, index) => <button key={item.title} id={`st-tab-${index}`} type="button" role="tab" aria-selected={activeService === index} aria-controls={`st-panel-${index}`} tabIndex={activeService === index ? 0 : -1} className={`st-service-tab${activeService === index ? ' st-service-selected' : ''}`} onClick={() => setActiveService(index)} onKeyDown={event => navigateService(event, index)}><span>0{index + 1}</span><span><strong>{item.title}</strong><small>{item.short}</small></span><Arrow diagonal /></button>)}
            </div>
            <div className="st-service-detail" role="tabpanel" id={`st-panel-${activeService}`} aria-labelledby={`st-tab-${activeService}`} tabIndex="0" key={activeService}>
              <div className="st-service-image"><img src={service.image} alt={service.alt} width="1400" height="933" loading="lazy" /><span>0{activeService + 1} / 04</span></div>
              <div className="st-service-detail-copy"><p>{service.text}</p><ul>{service.items.map(item => <li key={item}>{item}</li>)}</ul><a className="st-text-link" href={`${whatsapp}?text=${encodeURIComponent(`Olá! Gostaria de conversar sobre ${service.title.toLowerCase()}.`)}`} target="_blank" rel="noopener noreferrer">Solicite uma proposta <Arrow diagonal /></a></div>
            </div>
          </div>
        </div>
      </section>

      <section className="st-approach st-container" aria-labelledby="st-approach-title">
        <div className="st-section-label"><span>O NOSSO JEITO DE TRABALHAR</span><span>PRESENÇA EM CADA ETAPA.</span></div>
        <div className="st-approach-layout"><div><h2 id="st-approach-title">A diferença está<br /><em>em estar junto.</em></h2><p>Entender sua rotina. Preparar as pessoas.<br />Acompanhar o que acontece em campo.</p></div><ol className="st-process"><li><span>01</span><div><h3>Entendemos o seu desafio.</h3><p>Conhecemos os fluxos de trabalho, a demanda e as particularidades da sua empresa para propor uma atuação adequada à sua realidade.</p></div></li><li><span>02</span><div><h3>Preparamos a operação.</h3><p>Alinhamos equipe, treinamento e rotinas para que cada profissional saiba o seu papel e cada etapa tenha uma direção.</p></div></li><li><span>03</span><div><h3>Acompanhamos de perto.</h3><p>Presença em campo para identificar gargalos, orientar a equipe e aprimorar continuamente os processos.</p></div></li></ol></div>
      </section>

      <section className="st-industries" id="atuacao" aria-labelledby="st-industries-title">
        <img className="st-industries-image" src="/images/logistics-warehouse.jpg" alt="Vista de uma operação de armazenagem" loading="lazy" width="2200" height="1467" />
        <div className="st-container st-industries-grid"><div><div className="st-kicker st-kicker-light"><span /> SEGMENTOS DE ATUAÇÃO</div><h2 id="st-industries-title">Cada setor tem<br />seu ritmo.<br /><em>Nós acompanhamos.</em></h2><p>Da indústria ao varejo, o conhecimento da operação faz a diferença. Conte com uma equipe que entende os desafios do seu segmento.</p><a className="st-text-link st-light-link" href="#contato">Encontre a solução para o seu setor <Arrow diagonal /></a></div><ul className="st-sector-list">{['Indústria e Polo Industrial', 'Comércio, atacado e varejo', 'Alimentos e bebidas', 'Eletroeletrônicos e informática', 'Autopeças, motocicletas e bicicletas', 'Higiene, cosméticos e têxtil'].map((name, index) => <li key={name}><span>0{index + 1}</span>{name}<Arrow diagonal /></li>)}</ul></div>
      </section>

      <section className="st-founder st-container" aria-labelledby="st-founder-title"><div className="st-founder-heading"><span className="st-kicker">EXPERIÊNCIA É A NOSSA ESSÊNCIA</span><h2 id="st-founder-title">Quem conhece<br />o caminho,<br /><em>vai com você.</em></h2></div><div><p className="st-founder-quote">“Nossa experiência<br />a serviço do seu negócio.”</p><p>À frente da ST, Sosthene Ferreira Torres reúne mais de 40 anos de atuação em logística, administração e finanças. Administrador e especialista em Comércio Exterior pela UFAM, alia experiência em empresas de grande porte à docência, ao treinamento e à consultoria empresarial.</p><div className="st-founder-signature"><span className="st-signature-line" /><p>Sosthene Ferreira Torres<span>Fundador</span></p></div></div></section>

      <section className="st-contact" id="contato" aria-labelledby="st-contact-title"><div className="st-container"><div className="st-section-label"><span>VAMOS CONVERSAR</span><span>UM NOVO MOVIMENTO PARA A SUA EMPRESA.</span></div><div className="st-contact-grid"><div><h2 id="st-contact-title">Seu próximo<br />passo.<br /><em>Nossa parceria.</em></h2><p>Conte o que a sua operação precisa.<br />Vamos construir o próximo movimento juntos.</p><a className="st-contact-phone" href="tel:+5592992678067">(92) 99267-8067 <Arrow diagonal /></a><a className="st-contact-email" href="mailto:sosthenes.torres@gmail.com">sosthenes.torres@gmail.com</a><address>Rua Horizontina, quadra 62, nº 18<br />Conjunto Osvaldo Frota I · Cidade Nova<br />Manaus – AM · CEP 69095-508</address></div><form className="st-inquiry" onSubmit={submitInquiry}><h3>Como podemos ajudar?</h3><p className="st-inquiry-intro">Fale com a nossa equipe comercial.</p><div className="st-form-row"><label htmlFor="st-name">Seu nome</label><input id="st-name" required autoComplete="name" name="name" maxLength="100" value={inquiry.name} onChange={event => setInquiry({ ...inquiry, name: event.target.value })} placeholder="Nome completo" /><label htmlFor="st-company">Empresa</label><input id="st-company" required autoComplete="organization" name="company" maxLength="150" value={inquiry.company} onChange={event => setInquiry({ ...inquiry, company: event.target.value })} placeholder="Nome da empresa" /></div><label htmlFor="st-service">Qual solução você procura?</label><select id="st-service" required name="service" value={inquiry.service} onChange={event => setInquiry({ ...inquiry, service: event.target.value })}><option value="" disabled>Selecione uma solução</option>{services.map(item => <option key={item.title}>{item.title}</option>)}<option>Outra necessidade</option></select><label htmlFor="st-message">Sua demanda</label><textarea id="st-message" required name="message" rows="3" maxLength="2000" value={inquiry.message} onChange={event => setInquiry({ ...inquiry, message: event.target.value })} placeholder="Conte um pouco sobre o que a sua operação precisa." /><button className="st-button st-button-red" type="submit">Conversar pelo WhatsApp <Arrow diagonal /></button><p className="st-form-note">Você continuará o atendimento pelo WhatsApp. <button type="button" onClick={() => setPrivacyOpen(true)}>Privacidade</button></p></form></div></div></section>

      <aside className="st-careers"><div className="st-container"><div><span className="st-kicker">FAÇA PARTE DA NOSSA EQUIPE</span><p>O próximo movimento pode ser o seu.</p></div><a href="#/trabalhe-conosco">Conheça as oportunidades <Arrow diagonal /></a></div></aside>
    </main>

    <footer className="st-footer"><div className="st-container"><div className="st-footer-main"><Brand footer /><p>Experiência que movimenta.<br />Compromisso que permanece.</p><div className="st-footer-links"><a href="#empresa">A empresa</a><a href="#servicos">Soluções</a><a href="#clientes">Clientes</a><a href="#contato">Contato</a></div><a href="#inicio" className="st-back-top" aria-label="Voltar ao topo">↑</a></div><div className="st-footer-bottom"><span>© {new Date().getFullYear()} ST Serviços de Logística.</span><span>MANAUS · AMAZONAS · BRASIL</span><div><button type="button" onClick={() => setPrivacyOpen(true)}>Privacidade</button><a href="#/login">Acesso ao sistema <Arrow diagonal /></a></div></div></div></footer>
    {privacyOpen && <dialog id="st-privacy" className="st-privacy" aria-label="Privacidade" onCancel={() => setPrivacyOpen(false)} onClick={event => { if (event.target === event.currentTarget) setPrivacyOpen(false); }}><div className="st-privacy-heading"><h2>Privacidade</h2><button type="button" autoFocus onClick={() => setPrivacyOpen(false)} aria-label="Fechar política de privacidade">×</button></div><p>Os campos de contato compõem a mensagem que você poderá enviar à ST pelo WhatsApp. Este formulário não armazena os dados em um banco de dados do site.</p><p>Ao abrir o WhatsApp, o tratamento das informações também segue as políticas desse serviço. Envie apenas os dados necessários para o atendimento comercial.</p><p>O acesso ao sistema e as candidaturas têm fluxos próprios. Para esclarecer dúvidas sobre seus dados, entre em contato pelo e-mail <a href="mailto:sosthenes.torres@gmail.com">sosthenes.torres@gmail.com</a>.</p><button type="button" className="st-button st-button-red" onClick={() => setPrivacyOpen(false)}>Entendido <Arrow /></button></dialog>}
  </div>;
}

createRoot(document.getElementById('root')).render(<PublicSite />);
