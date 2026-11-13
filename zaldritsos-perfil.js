/* ZALDRITSOS: VISUAL DAS ABAS DO PERFIL (Relações, Tracker, Conquistas)
   Encaixa no motor de perfil do fórum (#z-profile): lê o texto de cada campo e desenha o painel
   dentro de #panel-relations, #panel-tracker e #panel-achievements. A edição continua sendo a do próprio
   perfil (pena); quando o valor muda, o painel é redesenhado sozinho.
   Formato de cada campo (uma linha por item):
     Relações:   FOTO | NOME | TIPO DE RELAÇÃO
     Tracker:    FOTO | TÍTULO | DESCRIÇÃO | PERSONAGENS (separe com , ou " e ") | STATUS | LINK
     Conquistas: ID | DATA     (o ID vem do catálogo conquistas-catalogo.json)
   Ícones das conquistas: game-icons.net (Lorc), CC BY 3.0. */
(() => {
  'use strict';

  const SCRIPT = (document.currentScript && document.currentScript.src) || '';
  const BASE = SCRIPT.replace(/[^/?#]*([?#].*)?$/, '');

  /* ====== CONFIGURAÇÃO (opcional): defina window.ZAL_PERFIL_CONFIG antes de carregar este script ====== */
  const CFG = Object.assign({
    ids: { relacoes: 26, tracker: 27, conquistas: 28 },       // usados só se o motor do perfil não informar
    alturas: { relacoes: '420px', tracker: '540px', conquistas: '400px' },
    catalogoUrl: BASE + 'conquistas-catalogo.json',
    iconesUrl: BASE + 'zaldritsos-icones.js',
    iconesRemotos: 'https://cdn.jsdelivr.net/gh/game-icons/icons@master/'
  }, window.ZAL_PERFIL_CONFIG || {});

  /* ====== utilitários ====== */
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ehHttp = (u) => /^https?:\/\//i.test(u || '');
  const imagem = (src, aoFalhar) => { const i = new Image(); i.alt = ''; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer'; i.src = src; i.onerror = () => { i.remove(); aoFalhar(); }; return i; };
  const SILHUETA = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="36" r="17" fill="currentColor"/><path d="M14 100c0-22 15-37 36-37s36 15 36 37z" fill="currentColor"/></svg>';
  const carregarScript = (src) => new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = erro; document.head.append(s); });
  const linhas = (texto) => String(texto || '').split(/\r?\n/).map((l) => l.split('|').map((s) => s.trim()));
  const textoDe = (nodo) => {
    const html = nodo.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
    return new DOMParser().parseFromString('<body>' + html, 'text/html').body.textContent.replace(/ /g, ' ').trim();
  };

  /* ====== ler o valor de um campo do perfil (motor do fórum) ====== */
  const motor = () => window.ZALDRITSOS_PROFILE_CONFIG || {};
  const idCampo = (chave) => Number((motor().campos || {})[chave]) || CFG.ids[chave];
  function valorCampo(chave) {
    const nativo = document.getElementById('z-profile-native');
    const dl = nativo && nativo.querySelector('#field_id' + idCampo(chave));
    if (!dl) return '';
    // Todo campo tem uma caixa de edição escondida, mas ela só vem preenchida para o dono do perfil.
    // Então: se a caixa tem texto (dono, e é o mais atualizado), usa ela; senão usa o texto exibido.
    const ctl = dl.querySelector('.field_editable textarea, .field_editable input[type="text"]');
    const editado = ctl ? ctl.value.trim() : '';
    if (editado) return editado;
    const v = dl.querySelector('.field_uneditable');
    const exibido = v ? textoDe(v) : '';
    return exibido === '-' ? '' : exibido; // o fórum mostra "-" quando o campo está vazio
  }
  const vazio = (txt) => el('p', 'zp-vazio', txt);

  /* ================= RELAÇÕES ================= */
  function montarRelacoes(view, texto) {
    const corpo = el('div', 'zp-body'); view.append(corpo);
    const itens = linhas(texto).filter((x) => x.length >= 3 && x[1] && x[2]).map((x) => ({ foto: ehHttp(x[0]) ? x[0] : '', nome: x[1], tipo: x.slice(2).join(' | ') }));
    if (!itens.length) { corpo.append(vazio('Nenhum vínculo adicionado.')); return; }
    const grade = el('div', 'zp-rel-grid');
    itens.forEach((it) => {
      const card = el('article', 'zp-rel');
      const foto = el('div', 'zp-rel-foto');
      if (it.foto) foto.append(imagem(it.foto, () => { foto.innerHTML = SILHUETA; })); else foto.innerHTML = SILHUETA;
      const info = el('div', 'zp-rel-info'); info.append(el('h3', 'zp-rel-nome', it.nome), el('p', 'zp-rel-tipo', it.tipo));
      card.append(foto, info); grade.append(card);
    });
    corpo.append(grade);
  }

  /* ================= TRACKER ================= */
  function montarTracker(view, texto) {
    const tramas = linhas(texto).filter((x) => x.length >= 5 && x[1] && x[4]).map((x) => {
      const n = norm(x[4]);
      return { foto: ehHttp(x[0]) ? x[0] : '', t: x[1], desc: x[2], chars: x[3].split(/\s*,\s*|\s+e\s+/i).map((s) => s.trim()).filter(Boolean), status: x[4],
               st: n.includes('andamento') ? 'and' : n.includes('finaliz') ? 'fin' : 'out', link: ehHttp(x[5]) ? x[5] : '' };
    });
    if (!tramas.length) { const c = el('div', 'zp-body'); c.append(vazio('Nenhum tópico adicionado.')); view.append(c); return; }

    const personagens = [...new Set(tramas.flatMap((t) => t.chars))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    let pers = 'todos', status = 'todos', busca = '';

    const tools = el('div', 'zp-tools');
    const st = el('div', 'zp-st'); st.setAttribute('role', 'group'); st.setAttribute('aria-label', 'Filtrar por status');
    [['todos', 'Todas'], ['and', 'Em andamento'], ['fin', 'Finalizadas']].forEach(([k, rot]) => {
      const b = el('button', null, rot); b.type = 'button'; b.setAttribute('aria-pressed', k === 'todos');
      b.onclick = () => { status = k; st.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); desenhar(); };
      st.append(b);
    });
    const dir = el('div', 'zp-dir');
    const sel = el('select'); sel.setAttribute('aria-label', 'Filtrar por personagem');
    const o0 = el('option', null, 'Todos os personagens'); o0.value = 'todos'; sel.append(o0);
    personagens.forEach((n) => { const o = el('option', null, n); o.value = n; sel.append(o); });
    sel.onchange = () => { pers = sel.value; desenhar(); };
    const q = el('input'); q.type = 'search'; q.placeholder = 'Buscar trama…'; q.setAttribute('aria-label', 'Buscar trama');
    q.oninput = () => { busca = q.value; desenhar(); };
    dir.append(sel, q); tools.append(st, dir); view.append(tools);

    const corpo = el('div', 'zp-body'); view.append(corpo);
    function desenhar() {
      corpo.textContent = '';
      const nq = norm(busca);
      const lista = tramas.filter((t) => (pers === 'todos' || t.chars.includes(pers)) && (status === 'todos' || t.st === status)
        && (!nq || norm(t.t).includes(nq) || norm(t.desc).includes(nq) || norm(t.chars.join(' ')).includes(nq)));
      if (!lista.length) { corpo.append(vazio('Nenhuma trama encontrada.')); return; }
      const grade = el('div', 'zp-tr-grid');
      lista.forEach((t) => {
        const c = el('article', 'zp-tr zp-' + t.st);
        const foto = el('div', 'zp-tr-foto'); const f = el('div');
        if (t.foto) f.append(imagem(t.foto, () => { f.innerHTML = SILHUETA; })); else f.innerHTML = SILHUETA;
        foto.append(f);
        const info = el('div', 'zp-tr-info');
        info.append(el('span', 'zp-tr-status', t.status));
        const h = el('h3', 'zp-tr-titulo');
        if (t.link) { const a = el('a', null, t.t); a.href = t.link; a.target = '_blank'; a.rel = 'noopener'; h.append(a); } else h.textContent = t.t;
        info.append(h);
        if (t.desc) info.append(el('p', 'zp-tr-desc', t.desc));
        const pc = el('div', 'zp-tr-pers');
        t.chars.forEach((n) => {
          const b = el('button', 'zp-pc'); b.type = 'button'; b.title = 'Ver tramas de ' + n; b.insertAdjacentHTML('afterbegin', SILHUETA); b.append(n);
          b.onclick = () => { pers = n; sel.value = n; desenhar(); };
          pc.append(b);
        });
        info.append(pc); c.append(foto, info); grade.append(c);
      });
      corpo.append(grade);
    }
    desenhar();
  }

  /* ================= CONQUISTAS ================= */
  const ORDEM = ['lendaria', 'epica', 'rara', 'incomum', 'comum'];
  const NOME_R = { lendaria: 'Lendária', epica: 'Épica', rara: 'Rara', incomum: 'Incomum', comum: 'Comum' };
  const raridade = (s) => { const n = norm(s); return ORDEM.find((k) => n.startsWith(k.slice(0, 4))) || 'comum'; };
  const glifos = () => window.ZAL_GLIFOS || {};
  const REMOTOS = {};
  const reRemoto = /^[a-z0-9-]+\/[a-z0-9-]+$/;
  const temGlifo = (g) => Object.prototype.hasOwnProperty.call(glifos(), g);
  const caminhoGlifo = (g) => temGlifo(g) ? glifos()[g] : (REMOTOS[g] || glifos().sol || '');

  function carregarRemotos(lista) {
    const nomes = [...new Set(lista.map((a) => String(a.glifo || '')).filter((g) => reRemoto.test(g) && !temGlifo(g) && !(g in REMOTOS)))];
    return Promise.all(nomes.map((n) => fetch(CFG.iconesRemotos + n + '.svg').then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => {
        const d = [...t.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]).filter((x) => !/^M0 0h512v512H0z/.test(x)).join(' ');
        REMOTOS[n] = /^[A-Za-z0-9\s,.\-+]+$/.test(d) ? d : '';
      }).catch(() => { REMOTOS[n] = ''; })));
  }

  function injetarDefs() {
    if (document.getElementById('zp-defs')) return;
    const d = document.createElement('div'); d.id = 'zp-defs'; d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg width="0" height="0" aria-hidden="true" focusable="false"><defs>'
      + '<linearGradient id="zp-g-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f8780"/><stop offset=".45" stop-color="#5a5457"/><stop offset="1" stop-color="#2c282a"/></linearGradient>'
      + '<linearGradient id="zp-g-bisel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>'
      + '<linearGradient id="zp-g-brilho" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
      + '<radialGradient id="zp-g-fundo" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#1a1618"/><stop offset="1" stop-color="#060607"/></radialGradient>'
      + '<clipPath id="zp-cs"><path d="M9 15 L21 4 L36 12 L50 2 L64 12 L79 4 L91 15 L91 55 C91 76 73 89 50 99 C27 89 9 76 9 55 Z"/></clipPath>'
      + '<clipPath id="zp-ci"><path d="M17 21 L23 14 L37 21 L50 12.5 L63 21 L77 14 L83 21 L83 54 C83 71 68 81 50 90 C32 81 17 71 17 54 Z"/></clipPath>'
      + '</defs></svg>';
    document.body.append(d);
  }

  const ESC_EXT = 'M9 15 L21 4 L36 12 L50 2 L64 12 L79 4 L91 15 L91 55 C91 76 73 89 50 99 C27 89 9 76 9 55 Z';
  const ESC_GRV = 'M13 17 L21 9 L36 16.5 L50 6.5 L64 16.5 L79 9 L87 17 L87 55 C87 74 71 85 50 95 C29 85 13 74 13 55 Z';
  const ESC_INT = 'M17 21 L23 14 L37 21 L50 12.5 L63 21 L77 14 L83 21 L83 54 C83 71 68 81 50 90 C32 81 17 71 17 54 Z';
  function emblema(a) {
    const g = String(a.glifo || '');
    let miolo;
    if (/^https:\/\//i.test(g)) {
      miolo = '<image href="' + g.replace(/"/g, '') + '" x="17" y="12" width="66" height="78" preserveAspectRatio="xMidYMid slice" clip-path="url(#zp-ci)"/>';
    } else {
      const d = caminhoGlifo(g);
      miolo = '<g transform="translate(29 27.5) scale(.082)"><path d="' + d + '" transform="translate(9 9)" fill="#000" opacity=".55"/>'
        + '<path d="' + d + '" style="fill:color-mix(in srgb,var(--c) 38%,#cfc6bd)"/></g>';
    }
    return '<svg viewBox="0 0 100 102" aria-hidden="true">'
      + '<path d="' + ESC_EXT + '" fill="url(#zp-g-metal)"/>'
      + '<path d="' + ESC_EXT + '" fill="none" stroke="url(#zp-g-bisel)" stroke-width="1.6" stroke-linejoin="round"/>'
      + '<path d="' + ESC_EXT + '" fill="none" stroke="#000" stroke-opacity=".55" stroke-width=".8" stroke-linejoin="round"/>'
      + '<path d="' + ESC_GRV + '" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".9" stroke-linejoin="round"/>'
      + '<path d="' + ESC_GRV + '" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width=".5" stroke-linejoin="round" transform="translate(.4 .4)"/>'
      + '<path d="' + ESC_INT + '" fill="url(#zp-g-fundo)"/>'
      + '<path d="' + ESC_INT + '" fill="none" stroke-opacity=".55" stroke-width=".9" stroke-linejoin="round" style="stroke:var(--c)"/>'
      + miolo
      + (a.r === 'lendaria' ? '<g clip-path="url(#zp-cs)"><g class="zp-sh"><rect x="-70" y="-10" width="26" height="125" fill="url(#zp-g-brilho)" transform="skewX(-22)"/></g></g>' : '')
      + '<g fill="#000" fill-opacity=".5"><circle cx="21.5" cy="10.5" r="1.9"/><circle cx="78.5" cy="10.5" r="1.9"/></g>'
      + '<g fill="url(#zp-g-metal)"><circle cx="21.5" cy="10" r="1.5"/><circle cx="78.5" cy="10" r="1.5"/></g>'
      + '<circle cx="50" cy="7.5" r="3" fill="#000" fill-opacity=".55"/><circle cx="50" cy="7.2" r="2.2" style="fill:var(--c)"/><circle cx="49.2" cy="6.4" r=".7" fill="#fff" fill-opacity=".6"/>'
      + '</svg>';
  }

  // balão único, fixo na tela (abre do meio para as beiradas)
  let tip = null, ativo = null;
  function criarTip() { if (!tip) { tip = el('div', 'zp-tip'); tip.setAttribute('role', 'tooltip'); document.body.append(tip); } return tip; }
  function mostrar(btn, a) {
    criarTip();
    if (ativo) ativo.classList.remove('zp-on');
    ativo = btn; btn.classList.add('zp-on');
    tip.className = 'zp-tip zp-r-' + a.r; tip.textContent = '';
    tip.append(el('span', 'zp-rar', NOME_R[a.r]), el('h4', null, a.nome));
    if (a.desc) tip.append(el('p', null, a.desc));
    if (a.data) tip.append(el('span', 'zp-dt', 'Obtida em ' + a.data));
    const b = btn.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const x = Math.min(Math.max(12, b.left + b.width / 2 - w / 2), innerWidth - w - 12);
    let y = b.top - h - 12; if (y < 12) y = b.bottom + 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    tip.getBoundingClientRect();
    tip.classList.add('zp-show');
  }
  function esconder() { if (tip) tip.classList.remove('zp-show'); if (ativo) { ativo.classList.remove('zp-on'); ativo = null; } }
  window.addEventListener('resize', esconder);

  // catálogo (arquivo JSON no GitHub)
  let catalogoPromessa = null;
  const catalogo = () => catalogoPromessa || (catalogoPromessa = fetch(CFG.catalogoUrl, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  const garantirIcones = async () => { if (window.ZAL_GLIFOS) return; try { await carregarScript(CFG.iconesUrl); } catch (e) { /* segue sem a biblioteca */ } if (!window.ZAL_GLIFOS) window.ZAL_GLIFOS = {}; };

  function lerConquistas(texto, cat) {
    const vistos = new Set();
    return linhas(texto).filter((x) => x[0]).map((x) => {
      const id = x[0].toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(cat, id) || vistos.has(id)) return null;
      vistos.add(id);
      const c = cat[id];
      return { id, glifo: String(c.icone || ''), nome: String(c.nome || id), desc: String(c.desc || ''), r: raridade(c.raridade), data: x[1] || '' };
    }).filter(Boolean).sort((a, b) => ORDEM.indexOf(a.r) - ORDEM.indexOf(b.r));
  }

  async function montarConquistas(view, texto, vivo) {
    const corpo = el('div', 'zp-body');
    await garantirIcones();
    const lista = lerConquistas(texto, await catalogo());
    if (!lista.length) { corpo.append(vazio('Nenhuma conquista adicionada.')); if (vivo()) view.append(corpo); return; }
    await carregarRemotos(lista);
    if (!vivo()) return; // uma versão mais nova já assumiu
    injetarDefs();
    const grade = el('div', 'zp-ach-grid');
    lista.forEach((a) => {
      const b = el('button', 'zp-ach zp-r-' + a.r); b.type = 'button';
      b.setAttribute('aria-label', NOME_R[a.r] + ': ' + a.nome + '. ' + a.desc);
      const ic = el('span', 'zp-ic'); ic.innerHTML = emblema(a); b.append(ic);
      b.addEventListener('mouseenter', () => mostrar(b, a));
      b.addEventListener('mouseleave', esconder);
      b.addEventListener('focus', () => mostrar(b, a));
      b.addEventListener('blur', esconder);
      b.addEventListener('click', () => (ativo === b && tip.classList.contains('zp-show') ? esconder() : mostrar(b, a)));
      grade.append(b);
    });
    corpo.append(grade); corpo.addEventListener('scroll', esconder);
    view.append(corpo);
  }

  /* ====== ajudante no editor do perfil: escolher a conquista numa lista ====== */
  const reIdConq = () => new RegExp('(^|\\D)' + idCampo('conquistas') + '(\\D|$)');
  function ehCampoConquistas(ta) {
    if (ta.closest('#panel-achievements')) return true;
    if (reIdConq().test(ta.name || '') || reIdConq().test(ta.id || '')) return true;
    const ctx = ta.closest('[role="dialog"], .z-edit-popup, form, dl');
    return !!ctx && /conquistas/i.test((ctx.getAttribute('aria-label') || '') + ' ' + (ctx.querySelector('h1,h2,h3,legend,dt,label,header') || {}).textContent);
  }
  async function ajudanteEditor(ta) {
    if (ta.dataset.zpPick || !ehCampoConquistas(ta)) return;
    ta.dataset.zpPick = '1';
    const cat = await catalogo();
    const ids = Object.keys(cat).sort((a, b) => ORDEM.indexOf(raridade(cat[a].raridade)) - ORDEM.indexOf(raridade(cat[b].raridade)) || String(cat[a].nome).localeCompare(String(cat[b].nome), 'pt-BR'));
    if (!ids.length) return;
    const box = el('div', 'zp-pick');
    const sel = el('select'); sel.setAttribute('aria-label', 'Conquista'); const o0 = el('option', null, 'Escolha uma conquista…'); o0.value = ''; sel.append(o0);
    ids.forEach((id) => { const o = el('option', null, NOME_R[raridade(cat[id].raridade)] + ' · ' + cat[id].nome); o.value = id; sel.append(o); });
    const data = el('input'); data.type = 'text'; data.placeholder = 'Data (opcional)'; data.maxLength = 10; data.setAttribute('aria-label', 'Data');
    const add = el('button', null, 'Adicionar'); add.type = 'button';
    add.onclick = () => {
      if (!sel.value) return;
      const jaTem = ta.value.split(/\r?\n/).some((l) => l.split('|')[0].trim().toLowerCase() === sel.value);
      if (jaTem) { sel.focus(); return; }
      const d = data.value.trim().replace(/[|\r\n]/g, '');
      ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + sel.value + (d ? ' | ' + d : '');
      sel.value = ''; data.value = '';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    box.append(sel, data, add);
    ta.before(box);
  }

  /* ====== botão "?" ao lado do título de cada aba: ensina a preencher o campo ====== */
  const eAdmin = () => !!(window._userdata && Number(window._userdata.user_level) === 1);
  const cod = (t) => el('code', null, t);
  const par = (...partes) => { const p = el('p'); partes.forEach((x) => p.append(typeof x === 'string' ? document.createTextNode(x) : x)); return p; };
  const linkCatalogo = () => (CFG.catalogoUrl.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/) || []).slice(1);

  const AJUDAS = {
    relacoes: async () => [
      el('h4', null, 'Como adicionar uma relação'),
      par('Escreva uma linha por vínculo, neste formato:'),
      cod('FOTO | NOME | TIPO DE RELAÇÃO'),
      par('A foto é opcional: se deixar vazia, aparece um espaço reservado. Exemplos:'),
      cod('https://…/foto.png | Lyanna Seabra | Irmã mais nova'),
      cod(' | Ser Rodrik Dayne | Mentor e protetor'),
      par('Para adicionar outro vínculo, aperte Enter e escreva na linha de baixo. Linhas fora do formato são ignoradas.')
    ],
    tracker: async () => [
      el('h4', null, 'Como adicionar uma trama'),
      par('Escreva uma linha por trama, neste formato:'),
      cod('FOTO | TÍTULO | DESCRIÇÃO | PERSONAGENS | STATUS | LINK DO TÓPICO'),
      par('A foto e o link do tópico são opcionais. Separe os personagens por vírgula ou pela palavra "e". O status pode ser ', el('b', null, 'Em andamento'), ' ou ', el('b', null, 'Finalizado'), ' (qualquer outro aparece em cinza). Exemplo:'),
      cod('https://…/capa.png | Sussurros no Boticário | Uma encomenda estranha. | Mestre Alaric e Elara | Em andamento | https://…/t12-topico'),
      par('Para adicionar outra trama, aperte Enter e escreva na linha de baixo. Linhas fora do formato são ignoradas.')
    ],
    conquistas: async () => {
      const cat = await catalogo();
      const ids = Object.keys(cat).sort((a, b) => ORDEM.indexOf(raridade(cat[a].raridade)) - ORDEM.indexOf(raridade(cat[b].raridade)) || String(cat[a].nome).localeCompare(String(cat[b].nome), 'pt-BR'));
      const nos = [
        el('h4', null, 'Como dar uma conquista'),
        par('Escreva uma linha por conquista, neste formato:'),
        cod('ID | DATA'),
        par('A data é opcional. Exemplo:'),
        cod('lingua-afiada | 04/10/2025'),
        par('O ID é o código da conquista no catálogo. Conquistas disponíveis:')
      ];
      if (ids.length) {
        const ul = el('ul');
        ids.forEach((id) => { const li = el('li'); li.append(cod(id), document.createTextNode(' ' + (cat[id].nome || '') + ' · ' + NOME_R[raridade(cat[id].raridade)])); ul.append(li); });
        nos.push(ul);
      } else nos.push(par('(o catálogo não pôde ser carregado agora)'));
      const l = linkCatalogo();
      if (eAdmin() && l.length) nos.push(par('Para cadastrar uma conquista nova, edite o catálogo: ', Object.assign(el('a', null, 'abrir o catálogo no GitHub'), { href: 'https://github.com/' + l[0] + '/' + l[1] + '/edit/' + l[2] + '/' + l[3], target: '_blank', rel: 'noopener' })));
      return nos;
    }
  };

  let aj = null, ajBotao = null, ajTimer = 0, ajFixo = false;
  function criarAjuda() {
    if (aj) return aj;
    aj = el('div', 'zp-ajuda'); aj.setAttribute('role', 'tooltip');
    aj.addEventListener('mouseenter', () => clearTimeout(ajTimer));
    aj.addEventListener('mouseleave', () => { if (!ajFixo) fecharAjuda(true); });
    document.body.append(aj);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { ajFixo = false; fecharAjuda(); } });
    document.addEventListener('click', (e) => { if (ajBotao && !e.target.closest('.zp-help, .zp-ajuda')) { ajFixo = false; fecharAjuda(); } });
    return aj;
  }
  async function abrirAjuda(botao, chave) {
    clearTimeout(ajTimer); criarAjuda();
    if (ajBotao && ajBotao !== botao) ajBotao.setAttribute('aria-expanded', 'false');
    ajBotao = botao;
    aj.textContent = ''; aj.append(...(await AJUDAS[chave]()));
    if (ajBotao !== botao) return;
    const b = botao.getBoundingClientRect(), w = aj.offsetWidth, h = aj.offsetHeight;
    aj.style.left = Math.min(Math.max(12, b.left), innerWidth - w - 12) + 'px';
    let y = b.bottom + 8; if (y + h > innerHeight - 12) y = Math.max(12, b.top - h - 8);
    aj.style.top = y + 'px';
    aj.classList.add('zp-ajuda-on'); botao.setAttribute('aria-expanded', 'true');
  }
  function fecharAjuda(atraso) {
    clearTimeout(ajTimer);
    const f = () => { if (aj) aj.classList.remove('zp-ajuda-on'); if (ajBotao) ajBotao.setAttribute('aria-expanded', 'false'); };
    if (atraso) ajTimer = setTimeout(f, 250); else f();
  }
  function instalarAjuda(secao, chave) {
    const h2 = secao.querySelector('.zup-tab-heading h2');
    if (!h2 || h2.querySelector('.zp-help')) return;
    const rotulo = 'Como preencher: ' + h2.textContent.trim();
    const b = el('button', 'zp-help', '?'); b.type = 'button'; b.setAttribute('aria-label', rotulo); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-haspopup', 'true');
    b.addEventListener('mouseenter', () => abrirAjuda(b, chave));
    b.addEventListener('mouseleave', () => { if (!ajFixo) fecharAjuda(true); });
    b.addEventListener('focus', () => abrirAjuda(b, chave));
    b.addEventListener('blur', () => { if (!ajFixo) fecharAjuda(true); });
    b.addEventListener('click', (e) => { e.stopPropagation(); ajFixo = !(ajFixo && ajBotao === b); if (ajFixo) abrirAjuda(b, chave); else fecharAjuda(); });
    h2.append(b);
  }

  /* ====== desenhar cada painel dentro do motor do perfil ====== */
  const PAINEIS = {
    relacoes: { sel: '#panel-relations', montar: montarRelacoes },
    tracker: { sel: '#panel-tracker', montar: montarTracker },
    conquistas: { sel: '#panel-achievements', montar: montarConquistas }
  };

  function desenhar(chave) {
    const def = PAINEIS[chave];
    const secao = document.querySelector(def.sel);
    if (!secao) return;
    instalarAjuda(secao, chave);
    const texto = valorCampo(chave);
    let view = secao.querySelector(':scope > .zp-view');
    if (view && view.__zpTexto === texto) return; // nada mudou
    if (!view) { view = el('div', 'zp zp-view zp-' + chave); secao.append(view); }
    view.__zpTexto = texto;
    const tok = (view.__zpTok = (view.__zpTok || 0) + 1);
    view.style.setProperty('--zp-altura', CFG.alturas[chave]);
    view.textContent = '';
    secao.classList.add('zp-ativo'); // esconde o texto cru do motor do perfil (via CSS)
    Promise.resolve(def.montar(view, texto, () => view.__zpTok === tok)).catch(() => {
      view.remove(); secao.classList.remove('zp-ativo'); // se algo falhar, o painel original volta a aparecer
    });
  }
  const desenharTudo = () => Object.keys(PAINEIS).forEach(desenhar);

  function iniciar() {
    const z = document.getElementById('z-profile');
    if (!z) return false;
    if (!z.dataset.mounted) return false; // o motor do perfil ainda não terminou de montar
    desenharTudo();
    // o motor redesenha o painel (e avisa) quando alguém edita o campo
    z.addEventListener('z-profile-value-changed', () => setTimeout(desenharTudo, 0));
    const olhar = new MutationObserver(() => desenharTudo());
    Object.values(PAINEIS).forEach((d) => { const s = document.querySelector(d.sel); if (s) olhar.observe(s, { childList: true, characterData: true, subtree: true }); });
    return true;
  }

  function comecar() {
    if (!document.getElementById('z-profile')) return; // não é uma página de perfil
    if (!iniciar()) {
      let n = 0; const t = setInterval(() => { if (iniciar() || ++n > 60) clearInterval(t); }, 250);
    }
    // quando o editor de um campo abrir, oferece a lista de conquistas
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'TEXTAREA') ajudanteEditor(n); else if (n.querySelectorAll) n.querySelectorAll('textarea').forEach(ajudanteEditor);
    }))).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar); else comecar();
})();
