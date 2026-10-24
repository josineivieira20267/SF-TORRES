import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import logo from './assets/sf-torres-logo-transparent.png';
import './public-site.css';

const whatsapp = 'https://wa.me/5592992678067';
const services = [
  { title: 'Operações logísticas', short: 'Do recebimento à expedição.', text: 'Equipes para cada etapa da sua operação. Organização do fluxo de materiais, cuidado com a carga e acompanhamento no dia a dia.', items: ['Ova, desova e unitização de cargas', 'Picking, etiquetagem e expedição', 'Movimentação interna de materiais', 'Abastecimento de linhas de produção'], image: '/images/logistics-warehouse.jpg', alt: 'Estrutura de armazenagem e movimentação de mercadorias' },
  { title: 'Gestão de estoques', short: 'Controle que começa no detalhe.', text: 'Processos de armazenagem e controle para dar visibilidade ao estoque e apoiar as decisões da sua empresa.', items: ['Gestão de almoxarifado', 'Inventários gerais e rotativos', 'Localização e identificação de materiais', 'Planejamento e controle de materiais'], image: '/images/logistics-operation.jpg', alt: 'Vista aérea de contêineres organizados em um terminal de cargas' },
  { title: 'Pessoas e serviços', short: 'A equipe certa faz a diferença.', text: 'Seleção e alocação de profissionais para as necessidades da sua operação, com treinamento e acompanhamento em campo.', items: ['Mão de obra de apoio logístico', 'Conferentes e almoxarifes', 'Liderança de equipes operacionais', 'Conservação e limpeza'], image: '/images/logistics-warehouse.jpg', alt: 'Ambiente de trabalho de uma operação logística' },
  { title: 'Treinamento e consultoria', short: 'Conhecimento aplicado à rotina.', text: 'Capacitação profissional e consultoria empresarial conectadas aos desafios reais de quem recebe, armazena, movimenta e entrega.', items: ['Gestão de estoques e almoxarifado', 'Lean Manufacturing e programa 10S', 'Custos logísticos e produtividade', 'Formação de almoxarifes e líderes'], image: '/images/logistics-operation.jpg', alt: 'Organização de contêineres em um terminal logístico' },
];

function Arrow({ diagonal = false }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={diagonal ? 'M5 19 19 5M5 5h14v14' : 'M4 12h15m-6-6 6 6-6 6'} /></svg>;
}

function Brand({ footer = false }) {
  return <a className={`st-brand ${footer ? 'st-brand-footer' : ''}`} href="#inicio" aria-label="ST Serviços de Logística — início"><img src={logo} width="724" height="516" alt="ST Serviços de Logística" /><span className="st-brand-divider" /><span>Experiência que<br />movimenta.</span></a>;
}

function PublicSite() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeService, setActiveService] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [inquiry, setInquiry] = useState({ name: '', company: '', service: '', message: '' });
  const service = services[activeService];

  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
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

  return <div className="st-site" id="inicio">
    <a className="st-skip" href="#conteudo">Pular para o conteúdo</a>
    <div className="st-utility"><div className="st-container"><span>Manaus, Amazonas <i /> Experiência a serviço do seu negócio.</span><div><a href="#/trabalhe-conosco">Trabalhe conosco <Arrow diagonal /></a><a href="#/login">Acesso ao sistema <Arrow diagonal /></a></div></div></div>
    <header className="st-header">
      <div className="st-container st-header-inner"><Brand />
        <button className="st-menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="st-navigation" onClick={() => setMenuOpen(!menuOpen)}><span /> <span /></button>
        <nav id="st-navigation" className={menuOpen ? 'st-nav st-nav-open' : 'st-nav'} aria-label="Navegação principal"><a href="#empresa">A ST</a><a href="#servicos">Nossas soluções</a><a href="#atuacao">Onde atuamos</a><a className="st-nav-contact" href="#contato">Vamos conversar <Arrow diagonal /></a></nav>
      </div>
    </header>

    <main id="conteudo">
      <section className="st-hero" aria-labelledby="st-hero-title">
        <img className="st-hero-image" src="/images/logistics-warehouse.jpg" alt="Corredor de armazenagem com estruturas para movimentação de cargas" fetchpriority="high" width="2200" height="1467" />
        <div className="st-hero-shade" />
        <div className="st-container st-hero-content"><div className="st-kicker st-kicker-light"><span /> LOGÍSTICA. PESSOAS. RESULTADOS.</div><h1 id="st-hero-title">Sua operação<br />em boas mãos.</h1><p>Da primeira movimentação à próxima conquista.<br className="st-desktop-break" /> Experiência e pessoas que fazem o seu negócio avançar.</p><a className="st-button st-button-lime" href="#servicos">Conheça nossas soluções <Arrow /></a></div>
        <div className="st-hero-bottom st-container"><span>ST SERVIÇOS DE LOGÍSTICA</span><a href="#empresa">Conheça a nossa essência <span>↓</span></a><span>03°06′ S &nbsp; 60°01′ W</span></div>
        <div className="st-hero-side">COMPROMISSO EM CADA MOVIMENTO.</div>
      </section>

      <section className="st-intro st-container" id="empresa" aria-labelledby="st-intro-title">
        <div className="st-section-label"><span>01 / A NOSSA ESSÊNCIA</span><span>DESDE A EXPERIÊNCIA. PARA O FUTURO.</span></div>
        <div className="st-intro-grid"><h2 id="st-intro-title">Logística se faz<br />com estrutura.<br /><em>E com gente.</em></h2><div className="st-intro-copy"><p className="st-lead">Por trás de uma operação que funciona, existe uma equipe que conhece o caminho.</p><p>A ST reúne mais de 20 anos de experiência na prestação de serviços de logística, conservação e limpeza, treinamento e consultoria empresarial. Nossa atuação nasce do conhecimento em campo e do cuidado com cada etapa do trabalho.</p><p>Em Manaus, conectamos pessoas, processos e a realidade de cada empresa para construir operações mais organizadas, produtivas e preparadas para crescer.</p><a className="st-text-link" href="#contato">Conte com a nossa experiência <Arrow diagonal /></a></div></div>
        <div className="st-facts"><div><strong>20<span>+</span></strong><p>Anos de experiência<br />na prestação de serviços</p></div><div><strong>40<span>+</span></strong><p>Anos de trajetória<br />do nosso fundador</p></div><div><strong>Manaus<span> / AM</span></strong><p>Conhecimento local.<br />Visão de negócio.</p></div></div>
      </section>

      <section className="st-solutions" id="servicos" aria-labelledby="st-solutions-title"><div className="st-container">
        <div className="st-section-label"><span>02 / NOSSAS SOLUÇÕES</span><span>O QUE MOVE A SUA EMPRESA?</span></div>
        <div className="st-section-heading"><h2 id="st-solutions-title">Cada operação, uma necessidade.<br /><em>Para cada necessidade, uma solução.</em></h2><p>Do trabalho em campo ao desenvolvimento de equipes. Encontre o apoio que a sua empresa precisa.</p></div>
        <div className="st-service-layout"><div className="st-service-list" role="tablist" aria-label="Soluções da ST" aria-orientation="vertical">{services.map((item, index) => <button key={item.title} id={`st-tab-${index}`} role="tab" aria-selected={activeService === index} aria-controls={`st-panel-${index}`} tabIndex={activeService === index ? 0 : -1} className={activeService === index ? 'st-service-tab st-service-selected' : 'st-service-tab'} onClick={() => setActiveService(index)} onKeyDown={(event) => { if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? services.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + services.length) % services.length; setActiveService(next); document.getElementById(`st-tab-${next}`).focus(); } }}><span>0{index + 1}</span><span><strong>{item.title}</strong><small>{item.short}</small></span><Arrow diagonal /></button>)}</div>
          <div className="st-service-detail" role="tabpanel" id={`st-panel-${activeService}`} aria-labelledby={`st-tab-${activeService}`} tabIndex="0"><img key={service.image} src={service.image} alt={service.alt} width="1400" height="900" loading="lazy" /><div className="st-service-detail-copy"><p>{service.text}</p><ul>{service.items.map(item => <li key={item}>{item}</li>)}</ul><a className="st-text-link" href={`${whatsapp}?text=${encodeURIComponent(`Olá! Gostaria de conversar sobre ${service.title.toLowerCase()}.`)}`} target="_blank" rel="noopener noreferrer">Converse sobre esta solução <Arrow diagonal /></a></div></div>
        </div>
      </div></section>

      <section className="st-approach st-container" aria-labelledby="st-approach-title"><div className="st-section-label"><span>03 / NOSSO JEITO DE TRABALHAR</span><span>PRESENÇA QUE FAZ DIFERENÇA.</span></div><div className="st-approach-layout"><div><h2 id="st-approach-title">Perto da operação.<br /><em>Ao lado do seu negócio.</em></h2><p>Não basta conhecer o processo. É preciso entender a sua rotina, preparar as pessoas e acompanhar de perto.</p></div><ol className="st-process"><li><span>01</span><div><h3>Entender antes de propor.</h3><p>Conhecemos a demanda, os fluxos de trabalho e as particularidades da sua empresa.</p></div></li><li><span>02</span><div><h3>Preparar para executar.</h3><p>Alinhamos a equipe, as rotinas e o treinamento às necessidades de cada operação.</p></div></li><li><span>03</span><div><h3>Acompanhar para evoluir.</h3><p>Atuação em campo, identificação de gargalos e melhoria contínua dos processos.</p></div></li></ol></div></section>

      <section className="st-industries" id="atuacao" aria-labelledby="st-industries-title"><div className="st-container st-industries-grid"><div><div className="st-kicker st-kicker-light"><span /> 04 / ONDE ATUAMOS</div><h2 id="st-industries-title">A força de Manaus.<br /><em>A dinâmica do seu setor.</em></h2><p>Da indústria ao comércio, operações diferentes pedem um parceiro que entenda o contexto.</p><a className="st-text-link st-light-link" href="#contato">Vamos falar sobre o seu setor <Arrow diagonal /></a></div><ul className="st-sector-list">{['Indústria e Polo Industrial', 'Comércio, atacado e varejo', 'Alimentos e bebidas', 'Eletroeletrônicos e informática', 'Autopeças, motocicletas e bicicletas', 'Higiene, cosméticos e têxtil'].map((name, index) => <li key={name}><span>0{index + 1}</span>{name}<Arrow diagonal /></li>)}</ul></div></section>

      <section className="st-clients st-container" aria-label="Clientes referenciais"><div className="st-clients-heading"><span className="st-kicker">EXPERIÊNCIA QUE CONECTA</span><p>Algumas das empresas citadas em nosso portfólio.</p></div><div className="st-client-names"><span>DAIKIN</span><span className="st-client-michelin">MICHELIN</span><span>FedEx</span><span className="st-client-fieam">FIEAM</span><span>SEMP TCL</span><span className="st-client-mondial">MONDIAL</span></div></section>

      <section className="st-founder st-container" aria-labelledby="st-founder-title"><div className="st-founder-mark" aria-hidden="true">ST<span>EXPERIÊNCIA<br />É A NOSSA ESSÊNCIA.</span></div><div><div className="st-kicker">CONHECIMENTO QUE VEM DE QUEM FAZ.</div><h2 id="st-founder-title">Uma trajetória em campo.<br />Uma visão para ir além.</h2><p>À frente da ST, Sosthene Ferreira Torres reúne mais de 40 anos de atuação nas áreas de logística, administração e finanças. Administrador e especialista em Comércio Exterior pela UFAM, combina vivência em empresas de grande porte com experiência em docência, treinamento e consultoria.</p><p className="st-founder-signature">Sosthene Ferreira Torres<span>Fundador</span></p></div></section>

      <section className="st-contact" id="contato" aria-labelledby="st-contact-title"><div className="st-container"><div className="st-section-label"><span>05 / VAMOS CONVERSAR</span><span>O PRÓXIMO PASSO COMEÇA AQUI.</span></div><div className="st-contact-grid"><div><h2 id="st-contact-title">O que podemos<br /><em>movimentar juntos?</em></h2><p>Conte o que a sua operação precisa.<br />Vamos encontrar o melhor caminho.</p><a className="st-contact-phone" href="tel:+5592992678067">(92) 99267-8067 <Arrow diagonal /></a><a className="st-contact-email" href="mailto:sosthenes.torres@gmail.com">sosthenes.torres@gmail.com</a><address>Rua Horizontina, quadra 62, nº 18<br />Conjunto Osvaldo Frota I · Cidade Nova<br />Manaus – AM · CEP 69095-508</address></div><form className="st-inquiry" onSubmit={submitInquiry}><h3>Fale com a nossa equipe</h3><div className="st-form-row"><label>Seu nome<input required autoComplete="name" name="name" maxLength="100" value={inquiry.name} onChange={e => setInquiry({ ...inquiry, name: e.target.value })} placeholder="Como podemos chamar você?" /></label><label>Empresa<input required autoComplete="organization" name="company" maxLength="150" value={inquiry.company} onChange={e => setInquiry({ ...inquiry, company: e.target.value })} placeholder="Nome da sua empresa" /></label></div><label>Como podemos ajudar?<select required name="service" value={inquiry.service} onChange={e => setInquiry({ ...inquiry, service: e.target.value })}><option value="" disabled>Selecione uma solução</option>{services.map(item => <option key={item.title}>{item.title}</option>)}<option>Outra necessidade</option></select></label><label>Conte um pouco sobre a sua demanda<textarea required name="message" rows="3" maxLength="2000" value={inquiry.message} onChange={e => setInquiry({ ...inquiry, message: e.target.value })} placeholder="Serviço, volume de operação ou desafio da sua empresa..." /></label><button className="st-button st-button-dark" type="submit">Iniciar conversa no WhatsApp <Arrow diagonal /></button><p className="st-form-note">Ao continuar, você será direcionado ao WhatsApp com sua mensagem preenchida. <button type="button" onClick={() => setPrivacyOpen(true)}>Privacidade</button></p></form></div></div></section>

      <aside className="st-careers"><div className="st-container"><span>O próximo movimento da sua carreira pode ser aqui.</span><a href="#/trabalhe-conosco">Conheça nossas oportunidades <Arrow diagonal /></a></div></aside>
    </main>

    <footer className="st-footer"><div className="st-container"><div className="st-footer-main"><Brand footer /><p>Logística com experiência.<br />Parceria em cada etapa.</p><a href="#inicio" className="st-back-top">Voltar ao topo ↑</a></div><div className="st-footer-bottom"><span>© {new Date().getFullYear()} ST Serviços de Logística. Todos os direitos reservados.</span><div><button onClick={() => setPrivacyOpen(true)}>Privacidade</button><a href="#/login">Acesso ao sistema <Arrow diagonal /></a></div></div></div></footer>
    {privacyOpen && <dialog id="st-privacy" className="st-privacy" aria-label="Privacidade" onCancel={() => setPrivacyOpen(false)} onClick={e => { if (e.target === e.currentTarget) setPrivacyOpen(false); }}><div><div className="st-privacy-heading"><h2>Privacidade</h2><button autoFocus onClick={() => setPrivacyOpen(false)} aria-label="Fechar política de privacidade">×</button></div><p>Os campos de contato são utilizados para compor a mensagem que você poderá enviar à ST pelo WhatsApp. Este formulário não armazena os dados em um banco de dados do site.</p><p>Ao abrir o WhatsApp, o tratamento das informações também segue as políticas desse serviço. Envie apenas os dados necessários para o atendimento comercial.</p><p>O acesso ao sistema e as candidaturas têm fluxos próprios. Para esclarecer dúvidas ou solicitar informações sobre seus dados, entre em contato pelo e-mail <a href="mailto:sosthenes.torres@gmail.com">sosthenes.torres@gmail.com</a>.</p><button className="st-button st-button-dark" onClick={() => setPrivacyOpen(false)}>Entendido <Arrow /></button></div></dialog>}
  </div>;
}

createRoot(document.getElementById('root')).render(<PublicSite />);
