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
  async function desenharHabilidades(corpo) {
    const id = idPerfil();
    corpo.textContent = '';
    try {
      const [cfg, regras, pers] = await Promise.all([fsLer('ficha_config/habilidades', 10), fsLer('ficha_config/regras', 10), id ? fsLer('personagens/' + id) : null]);
      if (!cfg || !(cfg.lista || []).length) { corpo.append(el('p', 'zp-vazio', 'Nenhuma habilidade cadastrada ainda.')); return; }
      const p = pers || {};
      const grupos = []; const por = {};
      cfg.lista.forEach((h) => { const k = h.categoria || 'Outras'; if (!por[k]) { por[k] = []; grupos.push(k); } por[k].push(h); });
      grupos.forEach((g) => {
        const sec = el('section', 'zp-hab-grupo'); sec.append(el('h3', 'zp-hab-grupo-nome', g));
        const grade = el('div', 'zp-hab-grade');
        // aprendidas primeiro, depois as que já podem ser aprendidas, depois as bloqueadas
        const ordem = (h) => (Number((p.habilidades || {})[h.id]) > 0 ? 0 : requisitos(h, p, cfg, regras).every((r) => r.ok) ? 1 : 2);
        por[g].map((h, i) => ({ h, i })).sort((a, b) => ordem(a.h) - ordem(b.h) || a.i - b.i).forEach((x) => grade.append(cartao(x.h, p, cfg, regras)));
        sec.append(grade); corpo.append(sec);
      });
    } catch (_) { corpo.append(el('p', 'zp-vazio', 'Não foi possível carregar as habilidades agora.')); }
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
    const view = el('div', 'zp zp-view zp-habilidades'); view.style.setProperty('--zp-altura', '420px');
    const corpo = el('div', 'zp-body'); view.append(corpo);
    painel.append(cab, view);
    painelInv.after(painel);

    const abas = () => [...document.querySelectorAll('.zup-tabs [role=tab]')];
    btn.addEventListener('click', () => {
      abas().forEach((t) => { const on = t === btn; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      document.querySelectorAll('#z-profile [role=tabpanel]').forEach((p) => { p.hidden = p !== painel; });
      desenharHabilidades(corpo);
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
    desenharHabilidades(corpo);
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
