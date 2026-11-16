/* ZALDRITSOS: PERFIL — EVOLUÇÃO (Habilidades, Ferimentos e Vitalidade)
   - Habilidades: aba nova ao lado de Inventário, com estrelas, progresso e requisitos.
   - Ferimentos: lista automática dentro do campo "Ferimentos" de Características gerais.
   - Vitalidade: barra que substitui a de Reputação (10 + 2 × nível + Força).
   Só LÊ o banco (documentos públicos); não grava nada. Qualquer falha aqui é silenciosa: o perfil segue normal. */
(() => {
  'use strict';
  if (window.__zpEvolucao) return;
  window.__zpEvolucao = true;

  const FS_BASE = 'https://firestore.googleapis.com/v1/projects/zaldritsos-b3049/databases/(default)/documents/';
  const ATRIB = { carisma: 'Carisma', destreza: 'Destreza', forca: 'Força', sabedoria: 'Sabedoria', inteligencia: 'Inteligência' };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ESTRELA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>';
  const ICONE_ABA = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path fill-rule="evenodd" d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.3 7L12 17.7l-6.3 3.4 1.3-7L1.9 9.2l7-1zm0 5.3l-1.6 3.3-3.6.5 2.6 2.5-.6 3.6 3.2-1.7 3.2 1.7-.6-3.6 2.6-2.5-3.6-.5z"/></svg>';

  /* ---------- leitura do banco (REST público) ---------- */
  const fsValor = (v) => {
    if (!v) return null;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('mapValue' in v) return fsCampos(v.mapValue.fields);
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValor);
    return null;
  };
  const fsCampos = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, fsValor(v)]));
  async function fsLer(caminho, cacheMin) {
    const chave = 'zp-fs:' + caminho;
    if (cacheMin) {
      try { const c = JSON.parse(sessionStorage.getItem(chave) || 'null'); if (c && c.ate > Date.now()) return c.dados; } catch (_) { /* sem cache */ }
    }
    const r = await fetch(FS_BASE + caminho);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Firestore ' + r.status);
    const dados = fsCampos((await r.json()).fields);
    if (cacheMin) { try { sessionStorage.setItem(chave, JSON.stringify({ ate: Date.now() + cacheMin * 60000, dados })); } catch (_) { /* sem cache */ } }
    return dados;
  }
  const idPerfil = () => { const m = /\/u(\d+)(?:[/?#]|$)/.exec(location.pathname); return m ? m[1] : ''; };

  /* ---------- regras (as mesmas do banco e da planilha) ---------- */
  const acumulado = (custos) => { let s = 0; return custos.map((c) => (s += c)); };
  const nivelHab = (xp, custos) => acumulado(custos).filter((a) => xp >= a).length;
  const nivelGeral = (xp, r) => {
    if (r && Array.isArray(r.xpNiveis) && r.xpNiveis.length) return 1 + acumulado(r.xpNiveis).filter((a) => xp >= a).length;
    return Math.min((r && r.nivelMax) || 10, 1 + Math.floor(Math.max(0, xp) / ((r && r.xpPorNivel) || 10)));
  };
  function requisitos(h, pers, cfg, regras) {
    const nivel = nivelGeral(Number(pers.xp) || 0, regras);
    return (h.requisitos || []).map((r) => {
      if (r.tipo === 'nivel') return { texto: 'Nível ' + r.min, ok: nivel >= r.min };
      if (r.tipo === 'atributo') return { texto: (ATRIB[r.id] || r.id) + ' ' + r.min, ok: (Number((pers.atributos || {})[r.id]) || 0) >= r.min };
      const alvo = (cfg.lista || []).find((x) => x.id === r.id);
      return { texto: (alvo ? alvo.nome : r.id) + ' ' + r.min + (r.min === 1 ? ' estrela' : ' estrelas'), ok: nivelHab(Number((pers.habilidades || {})[r.id]) || 0, cfg.xpNiveis) >= r.min };
    });
  }

  /* ---------- aba Habilidades ---------- */
  function estrelas(n, max) {
    const s = el('span', 'zp-estrelas'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', n + ' de ' + max + ' estrelas');
    for (let i = 0; i < max; i++) { const e = el('span', 'zp-estrela' + (i < n ? ' zp-on' : '')); e.innerHTML = ESTRELA_SVG; s.append(e); }
    return s;
  }
  function cartao(h, pers, cfg, regras) {
    const custos = cfg.xpNiveis || [], max = custos.length;
    const xp = Number((pers.habilidades || {})[h.id]) || 0;
    const aprendida = xp > 0, n = nivelHab(xp, custos), acum = acumulado(custos);
    const c = el('article', 'zp-hab' + (aprendida ? '' : ' zp-hab-trava'));
    const topo = el('header', 'zp-hab-topo'); topo.append(el('h4', 'zp-hab-nome', h.nome), estrelas(n, max)); c.append(topo);
    if (h.descricao) c.append(el('p', 'zp-hab-desc', h.descricao));
    if (aprendida) {
      const barra = el('div', 'zp-hab-barra'); const fill = el('span'); barra.append(fill); c.append(barra);
      if (n >= max) { fill.style.width = '100%'; c.append(el('small', 'zp-hab-info', 'Domínio máximo')); }
      else {
        const base = n ? acum[n - 1] : 0, prox = acum[n];
        fill.style.width = Math.max(0, Math.min(100, ((xp - base) / (prox - base)) * 100)) + '%';
        c.append(el('small', 'zp-hab-info', (xp - base) + ' / ' + (prox - base) + ' XP para a próxima estrela'));
      }
    } else {
      const reqs = requisitos(h, pers, cfg, regras);
      if (reqs.length) {
        const ul = el('ul', 'zp-hab-reqs');
        reqs.forEach((r) => ul.append(el('li', r.ok ? 'zp-ok' : 'zp-falta', (r.ok ? '✓ ' : '✕ ') + r.texto)));
        c.append(el('small', 'zp-hab-info', 'Requisitos'), ul);
      }
      const livre = reqs.every((r) => r.ok);
      c.append(el('small', 'zp-hab-info zp-hab-dica', livre ? 'Disponível: leia um livro para aprender.' : 'Ainda não disponível.'));
    }
    return c;
  }
  /* ---------- recibos no fórum + confirmação no servidor (pontos e livros) ---------- */
  // O jogador nunca grava no banco: ele posta um recibo num tópico do fórum e o script do Google confere
  // o autor, as regras e o saldo antes de gravar. Mesma ideia da compra na loja.
  const WEBAPP = 'https://script.google.com/macros/s/AKfycbxcwXY-FCPE9wuSGda-n0sCgrRsLZkym8GZy40jc-eWrR_gcou__mpWYTGZJLmLdXBw/exec';
  const NOMES_ATRIB = ['carisma', 'destreza', 'forca', 'sabedoria', 'inteligencia'];
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usuarioLogado = () => { const u = window._userdata; const id = u && Number(u.session_logged_in) ? Number(u.user_id) : 0; return id > 0 ? { id: String(id), nome: u.username || ('/u' + id) } : null; };
  const ehDono = () => { const u = usuarioLogado(); return !!u && u.id === idPerfil(); };
  const novoIdRecibo = () => 'zal-recibo-evo-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));

  function montarRecibo(idRecibo, subtitulo, linhas, dados) {
    const u = usuarioLogado();
    return '<div id="' + idRecibo + '" class="zal-staff-post"><div class="zal-staff-header"><h1 class="zal-staff-title">Recibo de Evolução</h1>' +
      '<p class="zal-staff-subtitle">' + esc(subtitulo) + '</p></div><div class="zal-staff-body"><div class="zal-staff-section">' +
      '<p>Personagem: <a href="/u' + u.id + '">' + esc(u.nome) + '</a></p>' + linhas.map((l) => '<p>' + esc(l) + '</p>').join('') +
      '</div></div><span class="zal-acao-dados" style="display:none">' + esc(dados) + '</span></div>' +
      '<div class="zal-staff-credit"><a href="/">@zaldritsos</a></div>';
  }
  async function abrirFormResposta(topico) {
    const r = await fetch('/post?t=' + topico + '&mode=reply', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('O fórum não conseguiu abrir a tela de resposta.');
    const pag = new DOMParser().parseFromString(await r.text(), 'text/html');
    const form = [...pag.forms].find((f) => f.querySelector('textarea[name="message"]') && f.querySelector('input[name="mode"][value="reply"]') && f.querySelector('input[name="t"]') && f.querySelector('input[name="t"]').value === String(topico));
    if (!form) throw new Error('O fórum não abriu a resposta para este tópico. Confira sua sessão e a permissão para responder.');
    return form;
  }
  async function enviarResposta(form, mensagem) {
    const campos = new FormData(form);
    campos.set('message', mensagem);
    campos.set('post', (form.querySelector('[name="post"]') || {}).value || '1');
    campos.delete('disable_html'); campos.delete('preview');
    const corpo = new URLSearchParams();
    for (const [k, v] of campos) if (typeof v === 'string') corpo.append(k, v);
    try {
      const r = await fetch('/post', { method: 'POST', credentials: 'same-origin', body: corpo });
      if (r.ok) { const pag = new DOMParser().parseFromString(await r.text(), 'text/html'); const e = pag.querySelector('p.error, .error-message'); return e ? e.textContent.trim() : ''; }
    } catch (_) { /* a confirmação é feita ao procurar a postagem */ }
    return '';
  }
  async function acharPostagem(topico, idRecibo) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch('/t' + topico + '-?view=newest', { credentials: 'same-origin', cache: 'no-store' });
        if (r.ok) { const pag = new DOMParser().parseFromString(await r.text(), 'text/html'); const alvo = pag.getElementById(idRecibo); const art = alvo && alvo.closest('article'); if (art && /^\d+$/.test(art.id)) return art.id; }
      } catch (_) { /* tenta de novo */ }
      await esperar(1500);
    }
    return null;
  }
  async function postarRecibo(topico, mensagem, idRecibo) {
    const form = await abrirFormResposta(topico);
    const erroForum = await enviarResposta(form, mensagem);
    const post = await acharPostagem(topico, idRecibo);
    if (!post) throw new Error(erroForum || 'O fórum não confirmou a publicação do recibo. Confira o tópico antes de tentar novamente.');
    return post;
  }
  async function confirmarNoServidor(acao, post, aoStatus) {
    let ultimo = null;
    for (let t = 0; t < 6; t++) {
      try {
        const r = await fetch(WEBAPP, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao, post }) });
        ultimo = await r.json();
      } catch (_) { ultimo = { ok: false, status: 'erro', retry: true, motivo: 'Sem conexão com o servidor.' }; }
      if (['aprovada', 'recusada', 'invalido'].includes(ultimo.status) || !ultimo.retry) return ultimo;
      if (aoStatus) aoStatus('Conferindo no servidor…');
      await esperar(1500 + t * 1500);
    }
    return ultimo;
  }
  /** Posta o recibo (uma vez só, mesmo se o servidor demorar) e confirma. pend guarda a postagem para "Tentar de novo". */
  async function executarRecibo(pend, aoStatus) {
    if (!pend.post) {
      aoStatus('Registrando no fórum…');
      pend.post = await postarRecibo(pend.topico, montarRecibo(pend.id, pend.subtitulo, pend.linhas, pend.dados), pend.id);
    }
    aoStatus('Conferindo no servidor…');
    return confirmarNoServidor(pend.acao, pend.post, aoStatus);
  }
  const botao = (txt, cls) => { const b = el('button', 'zp-btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; return b; };
  const pendentes = {}; // por tipo de pedido: evita criar outro recibo se o primeiro já foi postado

  /* ---------- Pontos de atributo: botão "!" no quadro do Nível + pop-up ---------- */
  const calcLivres = (pers, regras) => {
    const nivel = nivelGeral(Number(pers.xp) || 0, regras);
    return Math.max(0, Number(regras.pontosPorNivel) * (nivel - 1) - (Number(pers.pontosGastos) || 0));
  };
  let popupAtual = null;
  function fecharPopup(devolverFoco) {
    if (!popupAtual) return;
    const { pop, ancora, aoFora, aoEsc, reposicionar } = popupAtual;
    document.removeEventListener('mousedown', aoFora, true); document.removeEventListener('keydown', aoEsc, true);
    window.removeEventListener('resize', reposicionar); window.removeEventListener('scroll', reposicionar, true);
    pop.remove(); ancora.setAttribute('aria-expanded', 'false');
    popupAtual = null;
    if (devolverFoco) ancora.focus();
  }
  function abrirPopupPontos(ancora, topico) {
    if (popupAtual) { fecharPopup(true); return; }
    const pop = el('div', 'zp zp-pop'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Distribuir pontos de atributo');
    const z = document.getElementById('z-profile');
    const cor = z ? getComputedStyle(z).getPropertyValue('--group-color').trim() : '';
    if (cor) pop.style.setProperty('--group-color', cor); // o pop-up fica fora do perfil: leva a cor do grupo junto
    const corpo = el('div', 'zp-pop-corpo'); pop.append(corpo); document.body.append(pop);
    ancora.setAttribute('aria-expanded', 'true');
    const reposicionar = () => {
      const r = ancora.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 8;
      const noX = (x) => Math.min(Math.max(m, x), Math.max(m, innerWidth - w - m));
      let x, y;
      if (r.bottom + 10 + h <= innerHeight - m) { x = noX(r.right - w); y = r.bottom + 10; } // cabe embaixo do "!"
      else if (r.top - 10 - h >= m) { x = noX(r.right - w); y = r.top - 10 - h; } // cabe em cima
      else { // não cabe em cima nem embaixo (tela baixa): fica ao lado do "!", sem cobri-lo
        x = r.left - 10 - w >= m ? r.left - 10 - w : noX(r.right + 10);
        y = Math.min(Math.max(m, r.top - 20), Math.max(m, innerHeight - h - m));
      }
      pop.style.left = x + 'px'; pop.style.top = y + 'px';
    };
    const aoFora = (e) => { if (!pop.contains(e.target) && !ancora.contains(e.target)) fecharPopup(false); };
    const aoEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); fecharPopup(true); } };
    popupAtual = { pop, ancora, aoFora, aoEsc, reposicionar };
    document.addEventListener('mousedown', aoFora, true); document.addEventListener('keydown', aoEsc, true);
    window.addEventListener('resize', reposicionar); window.addEventListener('scroll', reposicionar, true);
    corpo.append(el('p', 'zp-vazio', 'Carregando…')); reposicionar();
    montarEditorPontos(corpo, topico, reposicionar).catch(() => { corpo.textContent = ''; corpo.append(el('p', 'zp-vazio', 'Não foi possível carregar seus pontos agora.')); reposicionar(); });
  }
  async function montarEditorPontos(corpo, topico, reposicionar) {
    const [regras, pers] = await Promise.all([fsLer('ficha_config/regras', 10), fsLer('personagens/' + idPerfil())]);
    corpo.textContent = '';
    if (!regras || !pers) { corpo.append(el('p', 'zp-vazio', 'Não foi possível carregar seus pontos agora.')); reposicionar(); return; }
    const livres = calcLivres(pers, regras), max = Number(regras.atributoMax) || 10;
    const topo = el('div', 'zp-hab-topo');
    topo.append(el('h4', 'zp-hab-nome', livres + (livres === 1 ? ' ponto livre' : ' pontos livres')), el('small', 'zp-hab-info', regras.pontosPorNivel + ' por nível'));
    corpo.append(topo);
    if (!livres) { corpo.append(el('small', 'zp-hab-info', 'Nada para distribuir agora. Você ganha novos pontos ao subir de nível.')); reposicionar(); return; }
    const status = el('p', 'zp-evo-status'); status.setAttribute('aria-live', 'polite');
    const add = {}; NOMES_ATRIB.forEach((a) => { add[a] = 0; });
    const total = () => NOMES_ATRIB.reduce((s, a) => s + add[a], 0);
    const lista = el('div', 'zp-evo-lista'); const linhas = {};
    let busy = false;
    const resta = el('small', 'zp-hab-info');
    const confirmar = botao('Confirmar distribuição'), cancelar = botao('Cancelar', 'zp-btn-sec');
    const todos = () => NOMES_ATRIB.forEach((a) => linhas[a]());
    NOMES_ATRIB.forEach((a) => {
      const base = Number((pers.atributos || {})[a]) || 0;
      const l = el('div', 'zp-evo-linha');
      const menos = botao('−', 'zp-btn-mini'), mais = botao('+', 'zp-btn-mini'), val = el('span', 'zp-evo-valor');
      menos.setAttribute('aria-label', 'Tirar ponto de ' + ATRIB[a]); mais.setAttribute('aria-label', 'Pôr ponto em ' + ATRIB[a]);
      l.append(el('span', 'zp-evo-nome', ATRIB[a]), menos, val, mais);
      linhas[a] = () => {
        val.textContent = (base + add[a]) + (add[a] ? ' (+' + add[a] + ')' : '');
        menos.disabled = busy || add[a] === 0; mais.disabled = busy || total() >= livres || base + add[a] >= max;
        confirmar.disabled = total() === 0 || busy; resta.textContent = (livres - total()) + ' livres';
      };
      menos.addEventListener('click', () => { if (add[a] > 0) { add[a]--; todos(); } });
      mais.addEventListener('click', () => { if (total() < livres && base + add[a] < max) { add[a]++; todos(); } });
      lista.append(l);
    });
    const aviso = el('small', 'zp-hab-info', 'Depois de confirmar, a distribuição não pode ser desfeita.');
    const acoes = el('div', 'zp-evo-acoes'); acoes.append(confirmar, cancelar, resta);
    corpo.append(lista, aviso, acoes, status); todos(); reposicionar();
    cancelar.addEventListener('click', () => fecharPopup(true));
    confirmar.addEventListener('click', async () => {
      if (busy || !total()) return;
      busy = true; todos(); cancelar.disabled = true;
      const dist = NOMES_ATRIB.filter((a) => add[a] > 0).map((a) => a + ':' + add[a]).join(',');
      const pend = pendentes.pontos && pendentes.pontos.dados === 'v1|pontos|' + dist ? pendentes.pontos
        : (pendentes.pontos = { acao: 'pontos', id: novoIdRecibo(), topico, subtitulo: 'Pontos de atributo', dados: 'v1|pontos|' + dist,
          linhas: NOMES_ATRIB.filter((a) => add[a] > 0).map((a) => ATRIB[a] + ' +' + add[a]) });
      status.className = 'zp-evo-status';
      try {
        const res = await executarRecibo(pend, (t) => { status.textContent = t; reposicionar(); });
        if (res && res.status === 'aprovada') {
          delete pendentes.pontos; status.className = 'zp-evo-status zp-evo-ok';
          status.textContent = 'Pontos distribuídos! Restam ' + res.pontosLivres + '. Atualizando o perfil…'; reposicionar();
          setTimeout(() => location.reload(), 1400); return;
        }
        if (res && (res.status === 'recusada' || res.status === 'invalido')) delete pendentes.pontos;
        status.className = 'zp-evo-status zp-evo-erro';
        status.textContent = (res && res.motivo) || 'Não foi possível concluir agora. Tente de novo.';
      } catch (e) { status.className = 'zp-evo-status zp-evo-erro'; status.textContent = (e && e.message) || 'Não foi possível concluir agora. Tente de novo.'; }
      busy = false; cancelar.disabled = false; todos(); reposicionar();
    });
  }
  let badgeOcupado = false;
  /** Mostra o "!" no canto do quadro do Nível enquanto houver pontos para distribuir (só para o dono do perfil). */
  async function badgePontos() {
    if (badgeOcupado || !ehDono()) return;
    const caixa = document.querySelector('.zup-level'); if (!caixa) return;
    badgeOcupado = true;
    try {
      const [regras, pers] = await Promise.all([fsLer('ficha_config/regras', 10), fsLer('personagens/' + idPerfil())]);
      const topico = regras && Number(regras.topicoRecibos) > 0 ? String(Number(regras.topicoRecibos)) : '';
      const livres = topico && pers && Number(regras.pontosPorNivel) > 0 ? calcLivres(pers, regras) : 0;
      let b = caixa.querySelector('.zp-pontos-badge');
      if (!livres) { if (b) b.remove(); return; }
      const texto = 'Você tem ' + livres + (livres === 1 ? ' ponto de atributo para distribuir' : ' pontos de atributo para distribuir');
      if (!b) {
        b = el('button', 'zp-pontos-badge', '!'); b.type = 'button';
        b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
        b.addEventListener('click', (e) => { e.stopPropagation(); abrirPopupPontos(b, topico); });
        caixa.append(b);
      }
      b.setAttribute('aria-label', texto); b.title = texto;
    } finally { badgeOcupado = false; }
  }

  /* ---------- Livros no inventário ---------- */
  async function blocoLivros(ctx) {
    const { pers, cfg, regras, topico } = ctx;
    const ids = Object.keys(pers.itens || {}).filter((k) => Number(pers.itens[k]) > 0);
    const docs = await Promise.all(ids.map((id) => fsLer('shop_items/' + id, 10).catch(() => null)));
    const livros = ids.map((id, i) => ({ id, item: docs[i] })).filter((x) => x.item && x.item.habilidade && Number(x.item.xpHabilidade) > 0 && cfg.lista.some((h) => h.id === x.item.habilidade));
    if (!livros.length) return null;
    const sec = el('section', 'zp-evo-bloco'); sec.append(el('h3', 'zp-hab-grupo-nome', 'Livros no inventário'));
    const grade = el('div', 'zp-hab-grade'); sec.append(grade);
    const inteligencia = Number((pers.atributos || {}).inteligencia) || 0;
    livros.forEach(({ id, item }) => {
      const hab = cfg.lista.find((h) => h.id === item.habilidade);
      const xpAtual = Number((pers.habilidades || {})[hab.id]) || 0;
      const lido = !!(pers.livrosLidos || {})[id];
      const ganho = Math.round(Number(item.xpHabilidade) * (1 + inteligencia / 20));
      const c = el('article', 'zp-hab');
      const t = el('header', 'zp-hab-topo'); t.append(el('h4', 'zp-hab-nome', item.nome || id)); c.append(t);
      c.append(el('p', 'zp-hab-desc', 'Ensina ' + hab.nome + ' (+' + ganho + ' XP de habilidade).'));
      const status = el('p', 'zp-evo-status'); status.setAttribute('aria-live', 'polite');
      const reqs = xpAtual === 0 ? requisitos(hab, pers, cfg, regras) : [];
      if (reqs.length) { const ul = el('ul', 'zp-hab-reqs'); reqs.forEach((r) => ul.append(el('li', r.ok ? 'zp-ok' : 'zp-falta', (r.ok ? '✓ ' : '✕ ') + r.texto))); c.append(ul); }
      const livre = reqs.every((r) => r.ok);
      if (lido) c.append(el('small', 'zp-hab-info', 'Você já leu este livro.'));
      else if (!topico) c.append(el('small', 'zp-hab-info', 'A leitura de livros ainda não foi ativada pela administração.'));
      else if (!livre) c.append(el('small', 'zp-hab-info', 'Ainda não dá para ler: faltam requisitos.'));
      else {
        const ler = botao('Ler livro'); let armado = false, busy = false, timer = null;
        ler.addEventListener('click', async () => {
          if (busy) return;
          if (!armado) { armado = true; ler.textContent = 'Confirmar leitura?'; timer = setTimeout(() => { armado = false; ler.textContent = 'Ler livro'; }, 4000); return; }
          clearTimeout(timer); busy = true; ler.disabled = true; status.className = 'zp-evo-status';
          const pend = pendentes['livro:' + id] || (pendentes['livro:' + id] = { acao: 'livro', id: novoIdRecibo(), topico, subtitulo: 'Leitura de livro', dados: 'v1|livro|' + id, linhas: [item.nome || id, 'Habilidade: ' + hab.nome] });
          try {
            const res = await executarRecibo(pend, (x) => { status.textContent = x; });
            if (res && res.status === 'aprovada') {
              delete pendentes['livro:' + id]; status.className = 'zp-evo-status zp-evo-ok';
              status.textContent = (res.aprendeuAgora ? 'Você aprendeu ' + hab.nome + '!' : hab.nome + ' evoluiu!') + ' +' + res.ganho + ' XP. Atualizando…';
              setTimeout(() => location.reload(), 1400); return;
            }
            if (res && (res.status === 'recusada' || res.status === 'invalido')) delete pendentes['livro:' + id];
            status.className = 'zp-evo-status zp-evo-erro'; status.textContent = (res && res.motivo) || 'Não foi possível concluir agora. Tente de novo.';
          } catch (e) { status.className = 'zp-evo-status zp-evo-erro'; status.textContent = (e && e.message) || 'Não foi possível concluir agora. Tente de novo.'; }
          busy = false; ler.disabled = false; armado = false; ler.textContent = 'Tentar de novo';
        });
        c.append(ler);
      }
      c.append(status); grade.append(c);
    });
    return sec;
  }

  // Ícones do menu lateral: os mesmos do perfil (inventário e atributos), para ficar tudo padronizado.
  const ICONE_CAT = { combate: 'weapons', oficio: 'gauntlet', social: 'attribute-domino-mask', saber: 'attribute-brain', sobrevivencia: 'attribute-oak' };
  const iconeCat = (nome) => 'var(--z-icon-' + (ICONE_CAT[norm(nome)] || 'misc') + ')';
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-');

  /** Desenha o menu lateral, os filtros e os cartões conforme a categoria e o filtro escolhidos. */
  function renderizarHabilidades(L) {
    const { cfg, regras, pers, estado } = L.dados;
    const aprendida = (h) => Number((pers.habilidades || {})[h.id]) > 0;
    const cats = []; cfg.lista.forEach((h) => { const c = h.categoria || 'Outras'; if (!cats.includes(c)) cats.push(c); });
    if (estado.cat !== 'todos' && !cats.some((c) => slug(c) === estado.cat)) estado.cat = 'todos';
    // menu lateral (mesmo visual do inventário)
    L.trilho.textContent = '';
    [{ id: 'todos', nome: 'Todos', icone: 'var(--z-icon-misc)' }].concat(cats.map((c) => ({ id: slug(c), nome: c, icone: iconeCat(c) }))).forEach((c) => {
      const b = el('button', 'zui-category'); b.type = 'button';
      b.setAttribute('aria-label', c.nome); b.setAttribute('data-label', c.nome); b.setAttribute('aria-pressed', String(estado.cat === c.id));
      const ic = el('span', 'zui-icon'); ic.style.setProperty('--inventory-icon', c.icone); ic.setAttribute('aria-hidden', 'true'); b.append(ic);
      b.addEventListener('click', () => { estado.cat = c.id; renderizarHabilidades(L); });
      L.trilho.append(b);
    });
    const naCategoria = cfg.lista.filter((h) => estado.cat === 'todos' || slug(h.categoria || 'Outras') === estado.cat);
    const nApr = naCategoria.filter(aprendida).length, nNao = naCategoria.length - nApr;
    // filtros: aprendidas (padrão) e não aprendidas
    L.filtros.textContent = '';
    [['aprendidas', 'Aprendidas', nApr], ['nao', 'Não aprendidas', nNao]].forEach(([id, rotulo, n]) => {
      const b = botao(rotulo + ' (' + n + ')', 'zp-btn-sec'); b.setAttribute('aria-pressed', String(estado.filtro === id));
      b.addEventListener('click', () => { estado.filtro = id; renderizarHabilidades(L); });
      L.filtros.append(b);
    });
    // corpo: livros do dono (se houver) e os cartões
    L.corpo.textContent = '';
    if (L.livros) L.corpo.append(L.livros);
    const mostrar = naCategoria.filter((h) => (estado.filtro === 'aprendidas') === aprendida(h));
    if (!mostrar.length) {
      const msg = estado.filtro === 'aprendidas'
        ? 'Você ainda não aprendeu nenhuma habilidade' + (estado.cat === 'todos' ? '' : ' nesta categoria') + '. Veja as não aprendidas ou leia um livro.'
        : 'Você já aprendeu todas as habilidades' + (estado.cat === 'todos' ? '' : ' desta categoria') + '.';
      L.corpo.append(el('p', 'zp-vazio', msg)); return;
    }
    const grupos = estado.cat === 'todos' ? cats.map((c) => ({ nome: c, hs: mostrar.filter((h) => (h.categoria || 'Outras') === c) })).filter((g) => g.hs.length) : [{ nome: '', hs: mostrar }];
    grupos.forEach((g) => {
      const sec = el('section', 'zp-hab-grupo'); if (g.nome) sec.append(el('h3', 'zp-hab-grupo-nome', g.nome));
      const grade = el('div', 'zp-hab-grade');
      // entre as não aprendidas, as que já podem ser aprendidas vêm primeiro
      const ordem = (h) => (aprendida(h) ? 0 : requisitos(h, pers, cfg, regras).every((r) => r.ok) ? 1 : 2);
      g.hs.map((h, i) => ({ h, i })).sort((a, b) => ordem(a.h) - ordem(b.h) || a.i - b.i).forEach((x) => grade.append(cartao(x.h, pers, cfg, regras)));
      sec.append(grade); L.corpo.append(sec);
    });
  }
  async function desenharHabilidades(L) {
    const id = idPerfil();
    L.corpo.textContent = ''; L.trilho.textContent = ''; L.filtros.textContent = '';
    try {
      const [cfg, regras, pers] = await Promise.all([fsLer('ficha_config/habilidades', 10), fsLer('ficha_config/regras', 10), id ? fsLer('personagens/' + id) : null]);
      if (!cfg || !(cfg.lista || []).length) { L.corpo.append(el('p', 'zp-vazio', 'Nenhuma habilidade cadastrada ainda.')); return; }
      L.dados = { cfg, regras: regras || {}, pers: pers || {}, estado: (L.dados && L.dados.estado) || { cat: 'todos', filtro: 'aprendidas' } };
      // Só o dono do perfil vê os livros (quem manda de verdade é o servidor, que confere o autor do recibo).
      L.livros = null;
      if (ehDono() && pers && regras) {
        const ctx = { pers, cfg, regras, topico: Number(regras.topicoRecibos) > 0 ? String(Number(regras.topicoRecibos)) : '' };
        L.livros = await blocoLivros(ctx).catch(() => null);
      }
      renderizarHabilidades(L);
    } catch (_) { L.corpo.append(el('p', 'zp-vazio', 'Não foi possível carregar as habilidades agora.')); }
  }
  function montarAba() {
    const existente = document.getElementById('panel-skills');
    if (existente) return existente;
    const inv = document.getElementById('tab-inventory'), painelInv = document.getElementById('panel-inventory');
    if (!inv || !painelInv) return null;
    const btn = inv.cloneNode(false); // copia só os atributos, sem os ouvintes do botão original
    btn.id = 'tab-skills'; btn.setAttribute('aria-label', 'Habilidades'); btn.setAttribute('data-label', 'Habilidades');
    btn.setAttribute('aria-controls', 'panel-skills'); btn.setAttribute('aria-selected', 'false'); btn.tabIndex = -1;
    btn.innerHTML = ICONE_ABA;
    inv.after(btn);
    const painel = el('section', 'zup-text-panel'); painel.id = 'panel-skills';
    painel.setAttribute('role', 'tabpanel'); painel.setAttribute('aria-labelledby', 'tab-skills'); painel.tabIndex = 0; painel.hidden = true;
    const cab = el('header', 'zup-tab-heading'); const d = el('div'); d.append(el('h2', null, 'Habilidades'), el('p', null, 'Estrelas, treino e requisitos do personagem.')); cab.append(d);
    const view = el('div', 'zp zp-view zp-habilidades'); view.style.setProperty('--zp-altura', '520px');
    const trilho = el('nav', 'zui-categories zp-hab-trilho'); trilho.setAttribute('aria-label', 'Categorias de habilidades');
    const principal = el('div', 'zp-hab-main'); const filtros = el('div', 'zp-hab-filtros'); const corpo = el('div', 'zp-body');
    principal.append(filtros, corpo);
    const layout = el('div', 'zp-hab-layout'); layout.append(trilho, principal); view.append(layout);
    const L = { trilho, filtros, corpo, dados: null, livros: null };
    painel.append(cab, view);
    painelInv.after(painel);

    const abas = () => [...document.querySelectorAll('.zup-tabs [role=tab]')];
    btn.addEventListener('click', () => {
      abas().forEach((t) => { const on = t === btn; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      document.querySelectorAll('#z-profile [role=tabpanel]').forEach((p) => { p.hidden = p !== painel; });
      desenharHabilidades(L);
    });
    btn.addEventListener('keydown', (e) => {
      const lista = abas(), i = lista.indexOf(btn);
      const alvo = e.key === 'ArrowRight' ? lista[i + 1] : e.key === 'ArrowLeft' ? lista[i - 1] : e.key === 'Home' ? lista[0] : e.key === 'End' ? lista[lista.length - 1] : null;
      if (alvo) { e.preventDefault(); alvo.click(); alvo.focus(); }
    });
    // quando outra aba é escolhida pelo motor do perfil, esconde esta
    abas().forEach((t) => {
      if (t === btn) return;
      new MutationObserver(() => { if (t.getAttribute('aria-selected') === 'true') { painel.hidden = true; btn.setAttribute('aria-selected', 'false'); btn.tabIndex = -1; } })
        .observe(t, { attributes: true, attributeFilter: ['aria-selected'] });
    });
    desenharHabilidades(L);
    return painel;
  }

  /* ---------- Vitalidade (no lugar de Reputação) ---------- */
  function valorAtributo(sigla) {
    const alvo = [...document.querySelectorAll('.zup-attribute-value')].find((v) => {
      const a = v.closest('div') && v.closest('div').querySelector('dt abbr');
      return a && norm(a.textContent) === norm(sigla);
    });
    return alvo ? Number(alvo.textContent) || 0 : null;
  }
  function vitalidade() {
    const item = [...document.querySelectorAll('.zup-meter-item')].find((i) => {
      const r = i.querySelector('.zup-meter-label > span:first-child');
      return r && /^(reputacao|vitalidade)/.test(norm(r.textContent));
    });
    if (!item) return;
    const nivelEl = document.querySelector('.zup-level strong');
    const nivel = nivelEl ? Number(nivelEl.textContent) : NaN, forca = valorAtributo('FOR');
    if (!Number.isFinite(nivel) || forca === null) return;
    const max = 10 + 2 * nivel + forca, atual = max; // fora de combate a Vitalidade está cheia
    const rotulo = item.querySelector('.zup-meter-label > span:first-child'), valor = item.querySelector('.zup-meter-label > span:last-child');
    const meter = item.querySelector('.zup-meter');
    if (rotulo && rotulo.textContent !== 'Vitalidade') { rotulo.textContent = 'Vitalidade'; item.classList.remove('z-edit-host'); } // tira o lápis de editar Reputação
    const txt = atual + ' / ' + max;
    if (valor && valor.textContent !== txt) valor.textContent = txt;
    if (meter) {
      if (meter.getAttribute('aria-label') !== 'Vitalidade') meter.setAttribute('aria-label', 'Vitalidade');
      if (meter.getAttribute('aria-valuemax') !== String(max)) meter.setAttribute('aria-valuemax', String(max));
      if (meter.getAttribute('aria-valuenow') !== String(atual)) meter.setAttribute('aria-valuenow', String(atual));
      if (meter.style.getPropertyValue('--meter-fill') !== '100%') meter.style.setProperty('--meter-fill', '100%');
    }
  }

  /* ---------- Ferimentos (dentro do campo existente) ---------- */
  function textoEfeitos(ef) {
    return Object.keys(ef || {}).map((k) => (ef[k] > 0 ? '+' : '−') + Math.abs(ef[k]) + ' ' + (ATRIB[k] || k)).join(', ');
  }
  async function ferimentos() {
    const titulo = document.getElementById('trait-injuries'); const sec = titulo && titulo.closest('section');
    if (!sec) return;
    const id = idPerfil(); if (!id) return;
    let pers = null;
    try {
      // evita buscar de novo quando o próprio painel muda por causa da lista que acabamos de desenhar
      if (ferimentos.__pers && Date.now() - ferimentos.__quando < 15000) pers = ferimentos.__pers;
      else { pers = await fsLer('personagens/' + id); ferimentos.__pers = pers; ferimentos.__quando = Date.now(); }
    } catch (_) { return; }
    const agora = Date.now();
    const lista = ((pers && pers.feridas) || []).filter((f) => f && f.nome && (!f.ate || Date.parse(f.ate) > agora));
    const assinatura = JSON.stringify(lista);
    const atual = sec.querySelector(':scope > .zp-feridas');
    const conteudo = sec.querySelector('.zup-trait-content');
    const vazioNativo = conteudo && /^nenhuma informa/.test(norm(conteudo.textContent));
    if (conteudo) conteudo.hidden = !!(lista.length && vazioNativo);
    if (atual && atual.dataset.sig === assinatura) return;
    if (atual) atual.remove();
    if (!lista.length) return;
    const ul = el('ul', 'zp-feridas'); ul.dataset.sig = assinatura;
    lista.forEach((f) => {
      const li = el('li', 'zp-ferida zp-ferida-' + norm(f.tipo || 'leve'));
      li.append(el('strong', null, f.nome));
      const ef = textoEfeitos(f.efeitos); if (ef) li.append(el('span', 'zp-ferida-ef', ef));
      li.append(el('em', 'zp-ferida-ate', f.ate ? 'até ' + new Date(f.ate).toLocaleDateString('pt-BR') : 'permanente'));
      ul.append(li);
    });
    (conteudo || titulo).after(ul);
  }

  /* ---------- início ---------- */
  function aplicar() {
    try { montarAba(); } catch (_) { /* a aba é opcional */ }
    try { vitalidade(); } catch (_) { /* barra opcional */ }
    badgePontos().catch(() => { /* botão opcional */ });
    ferimentos().catch(() => { /* lista opcional */ });
  }
  function comecar() {
    const z = document.getElementById('z-profile');
    if (!z) return;
    let n = 0;
    const t = setInterval(() => {
      if (z.dataset.mounted && document.getElementById('tab-inventory') && document.querySelector('.zup-level strong')) {
        clearInterval(t);
        aplicar();
        z.addEventListener('z-profile-value-changed', () => setTimeout(aplicar, 0));
        const status = document.querySelector('.zup-status');
        if (status) new MutationObserver(() => { try { vitalidade(); } catch (_) { /* opcional */ } }).observe(status, { childList: true, subtree: true, characterData: true });
        const traits = document.getElementById('panel-traits');
        if (traits) new MutationObserver(() => { ferimentos().catch(() => {}); }).observe(traits, { childList: true, characterData: true, subtree: true });
      } else if (++n > 80) clearInterval(t);
    }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar); else comecar();
})();
