/* ============================================================
   EduGestão — app.js
   Toda a lógica da aplicação + integração Supabase
   ============================================================ */

// ─── ESTADO GLOBAL ──────────────────────────────────────────
const state = {
  turmaAtiva: 'CK1',
  viewAtiva: 'dashboard',
  alunos: [],
  notas: [],
  presencas: [],
  atividades: [],
  aulas: [],
  aulaFiltro: 'todos',
  supabase: null,
  deleteCallback: null,
};

// ─── TURMAS ─────────────────────────────────────────────────
const TURMAS = ['CK1','CK2','CK3','CK4','CT1','CT2','CT3','CT4'];

// ─── SUPABASE ───────────────────────────────────────────────
function getSupabaseConfig() {
  return {
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
  };
}

async function supabaseRequest(method, table, body = null, query = '') {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  const endpoint = `${url}/rest/v1/${table}${query}`;
  const res = await fetch(endpoint, {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// CRUD genérico
const DB = {
  async select(table, filter = '') {
    const data = await supabaseRequest('GET', table, null, `?${filter}`);
    return data || [];
  },
  async insert(table, row) {
    const data = await supabaseRequest('POST', table, row);
    return data && data[0] ? data[0] : null;
  },
  async update(table, id, changes) {
    const data = await supabaseRequest('PATCH', table, changes, `?id=eq.${id}`);
    return data && data[0] ? data[0] : null;
  },
  async remove(table, id) {
    await supabaseRequest('DELETE', table, null, `?id=eq.${id}`);
    return true;
  },
};

// ─── FALLBACK LOCAL ──────────────────────────────────────────
// Quando sem Supabase, salva no localStorage
const LOCAL = {
  load() {
    try {
      state.alunos     = JSON.parse(localStorage.getItem('alunos') || '[]');
      state.notas      = JSON.parse(localStorage.getItem('notas') || '[]');
      state.presencas  = JSON.parse(localStorage.getItem('presencas') || '[]');
      state.atividades = JSON.parse(localStorage.getItem('atividades') || '[]');
      state.aulas      = JSON.parse(localStorage.getItem('aulas') || '[]');
    } catch { /* ignore */ }
  },
  save() {
    localStorage.setItem('alunos',     JSON.stringify(state.alunos));
    localStorage.setItem('notas',      JSON.stringify(state.notas));
    localStorage.setItem('presencas',  JSON.stringify(state.presencas));
    localStorage.setItem('atividades', JSON.stringify(state.atividades));
    localStorage.setItem('aulas',      JSON.stringify(state.aulas));
  },
  nextId(arr) {
    return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1;
  },
};

// ─── UTILITÁRIOS ────────────────────────────────────────────
function uid() { return Date.now() + Math.random().toString(36).slice(2, 7); }

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✔', error: '✖', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(id) {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById(id).classList.remove('active');
}

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function getInitials(name) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function scoreLabel(s) {
  if (s >= 8) return 'A';
  if (s >= 6) return 'B';
  if (s >= 4) return 'C';
  return 'D';
}

function barColor(pct) {
  if (pct >= 80) return 'green';
  if (pct >= 60) return 'blue';
  if (pct >= 40) return 'yellow';
  return 'red';
}

// ─── ALUNOS DA TURMA ATIVA ───────────────────────────────────
function alunosTurma() {
  return state.alunos.filter(a => a.turma === state.turmaAtiva);
}

// ─── RENDER: DASHBOARD ───────────────────────────────────────
function renderDashboard() {
  const alunos = alunosTurma();
  document.getElementById('dash-turma-name').textContent = formatTurma(state.turmaAtiva);
  document.getElementById('stat-alunos').textContent = alunos.length;
  document.getElementById('stat-atividades').textContent =
    state.atividades.filter(a => a.turma === state.turmaAtiva).length;

  // Aulas e carga horária
  const aulasT = state.aulas.filter(a => a.turma === state.turmaAtiva);
  document.getElementById('stat-aulas').textContent = aulasT.length;
  const cargaTotal = aulasT.reduce((s, a) => s + (a.tipo === 'AE' ? 1 : 2), 0);
  document.getElementById('stat-carga').textContent = cargaTotal + 'h';

  // Frequência média
  const presArr = state.presencas.filter(p => p.turma === state.turmaAtiva);
  let freqMedia = '—';
  if (presArr.length && alunos.length) {
    const totalP = presArr.filter(p => p.status === 'P').length;
    const total  = presArr.length;
    freqMedia = total > 0 ? Math.round((totalP / total) * 100) + '%' : '—';
  }
  document.getElementById('stat-presenca').textContent = freqMedia;

  // Média de notas
  const notasArr = state.notas.filter(n => {
    const al = state.alunos.find(a => a.id == n.aluno_id);
    return al && al.turma === state.turmaAtiva;
  });
  let mediaNotas = '—';
  if (notasArr.length) {
    const sum = notasArr.reduce((s, n) => s + parseFloat(n.nota), 0);
    mediaNotas = (sum / notasArr.length).toFixed(1);
  }
  document.getElementById('stat-media').textContent = mediaNotas;

  // Ranking
  const rkEl = document.getElementById('ranking-list');
  if (!alunos.length) {
    rkEl.innerHTML = '<p class="empty-state">Nenhum aluno na turma.</p>';
  } else {
    const scores = alunos.map(a => {
      const nArr = state.notas.filter(n => n.aluno_id == a.id);
      const media = nArr.length
        ? nArr.reduce((s, n) => s + parseFloat(n.nota), 0) / nArr.length : null;
      const pArr = state.presencas.filter(p => p.aluno_id == a.id && p.turma === state.turmaAtiva);
      const freq = pArr.length
        ? (pArr.filter(p => p.status === 'P').length / pArr.length) * 100 : null;
      const score = ((media || 5) + (freq != null ? freq / 10 : 5)) / 2;
      return { aluno: a, media, freq, score };
    }).sort((a, b) => b.score - a.score);

    const posClass = ['gold', 'silver', 'bronze'];
    rkEl.innerHTML = scores.map((s, i) => {
      const sc = s.score.toFixed(1);
      const cls = sc >= 8 ? 'high' : sc >= 6 ? 'mid' : 'low';
      return `<div class="ranking-item">
        <span class="rank-pos ${posClass[i] || ''}">${i + 1}º</span>
        <span class="rank-name">${s.aluno.nome}</span>
        <span class="rank-score ${cls}">${sc}</span>
      </div>`;
    }).join('');
  }

  // Alertas
  const alEl = document.getElementById('alert-list');
  const alerts = [];
  alunos.forEach(a => {
    const pArr = state.presencas.filter(p => p.aluno_id == a.id && p.turma === state.turmaAtiva);
    if (pArr.length >= 3) {
      const freq = pArr.filter(p => p.status === 'P').length / pArr.length;
      if (freq < 0.75) alerts.push({ type: 'danger', icon: '⚠', msg: `${a.nome} — Frequência baixa (${Math.round(freq*100)}%)` });
    }
    const nArr = state.notas.filter(n => n.aluno_id == a.id);
    if (nArr.length) {
      const media = nArr.reduce((s, n) => s + parseFloat(n.nota), 0) / nArr.length;
      if (media < 5) alerts.push({ type: 'danger', icon: '✖', msg: `${a.nome} — Média abaixo de 5 (${media.toFixed(1)})` });
      else if (media < 7) alerts.push({ type: 'warn', icon: '⚡', msg: `${a.nome} — Média em risco (${media.toFixed(1)})` });
    }
  });

  if (!alerts.length) {
    alEl.innerHTML = '<p class="empty-state">Nenhum alerta. Turma estável! ✓</p>';
  } else {
    alEl.innerHTML = alerts.map(a =>
      `<div class="alert-item ${a.type}"><span class="alert-icon">${a.icon}</span><span>${a.msg}</span></div>`
    ).join('');
  }
}

// ─── RENDER: ALUNOS ─────────────────────────────────────────
function renderAlunos(filter = '') {
  const tbody = document.getElementById('tbody-alunos');
  let alunos = alunosTurma();
  if (filter) alunos = alunos.filter(a => a.nome.toLowerCase().includes(filter.toLowerCase()));

  if (!alunos.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum aluno encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = alunos.map((a, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${a.nome}</strong></td>
      <td>${a.matricula || '—'}</td>
      <td>${formatTurma(a.turma)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit" onclick="editAluno(${a.id})">✎ Editar</button>
          <button class="btn-icon remove" onclick="confirmDelete('aluno', ${a.id})">✕ Remover</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ─── RENDER: PRESENÇA ────────────────────────────────────────
function renderPresenca() {
  const alunos = alunosTurma();
  const tbody  = document.getElementById('tbody-presenca');
  const dateVal = document.getElementById('date-presenca').value;

  if (!alunos.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum aluno na turma.</td></tr>';
  } else {
    tbody.innerHTML = alunos.map(a => {
      const existing = state.presencas.find(
        p => p.aluno_id == a.id && p.data === dateVal && p.turma === state.turmaAtiva
      );
      const status = existing ? existing.status : 'P';
      return `
        <tr>
          <td><strong>${a.nome}</strong></td>
          <td>
            <div class="presenca-toggle">
              <button class="toggle-btn ${status==='P'?'present':''}" onclick="setPresenca(${a.id},'P','${dateVal}')">P</button>
              <button class="toggle-btn ${status==='A'?'absent':''}" onclick="setPresenca(${a.id},'A','${dateVal}')">F</button>
              <button class="toggle-btn ${status==='J'?'justified':''}" onclick="setPresenca(${a.id},'J','${dateVal}')">J</button>
            </div>
          </td>
          <td>
            <input type="text" placeholder="Justificativa..." style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:5px 10px;color:var(--text);font-size:12px;width:180px"
              id="just-${a.id}"
              value="${existing && existing.justificativa ? existing.justificativa : ''}" />
          </td>
        </tr>`;
    }).join('');
  }

  // Histórico
  renderHistoricoPresenca();
}

function setPresenca(alunoId, status, data) {
  const idx = state.presencas.findIndex(
    p => p.aluno_id == alunoId && p.data === data && p.turma === state.turmaAtiva
  );
  if (idx >= 0) {
    state.presencas[idx].status = status;
  } else {
    state.presencas.push({ id: LOCAL.nextId(state.presencas), aluno_id: alunoId, data, status, turma: state.turmaAtiva, justificativa: '' });
  }
  LOCAL.save();
  renderPresenca();
}

function salvarPresenca() {
  const alunos  = alunosTurma();
  const dateVal = document.getElementById('date-presenca').value;
  if (!dateVal) { toast('Selecione uma data.', 'error'); return; }

  alunos.forEach(a => {
    const justEl = document.getElementById(`just-${a.id}`);
    const just   = justEl ? justEl.value : '';
    const idx    = state.presencas.findIndex(
      p => p.aluno_id == a.id && p.data === dateVal && p.turma === state.turmaAtiva
    );
    if (idx >= 0) {
      state.presencas[idx].justificativa = just;
    } else {
      state.presencas.push({ id: LOCAL.nextId(state.presencas), aluno_id: a.id, data: dateVal, status: 'P', turma: state.turmaAtiva, justificativa: just });
    }
  });

  LOCAL.save();
  toast('Presença salva com sucesso!', 'success');
  renderPresenca();
}

function renderHistoricoPresenca() {
  const el = document.getElementById('historico-presenca');
  const datas = [...new Set(
    state.presencas.filter(p => p.turma === state.turmaAtiva).map(p => p.data)
  )].sort((a, b) => b.localeCompare(a));

  if (!datas.length) {
    el.innerHTML = '<p class="empty-state">Nenhum registro.</p>';
    return;
  }

  el.innerHTML = datas.slice(0, 10).map(d => {
    const arr = state.presencas.filter(p => p.data === d && p.turma === state.turmaAtiva);
    const P = arr.filter(p => p.status === 'P').length;
    const A = arr.filter(p => p.status === 'A').length;
    const J = arr.filter(p => p.status === 'J').length;
    return `<div class="hist-item">
      <span class="hist-date">${formatDate(d)}</span>
      <div class="hist-badges">
        <span class="hist-badge p">✓ ${P}</span>
        <span class="hist-badge a">✕ ${A}</span>
        ${J ? `<span class="hist-badge j">J ${J}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─── RENDER: NOTAS ───────────────────────────────────────────
function renderNotas() {
  const tbody = document.getElementById('tbody-notas');
  const alunos = alunosTurma().map(a => a.id);
  const notas  = state.notas.filter(n => alunos.includes(n.aluno_id));

  if (!notas.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma nota lançada.</td></tr>';
    return;
  }

  tbody.innerHTML = notas.map(n => {
    const al = state.alunos.find(a => a.id == n.aluno_id);
    const v  = parseFloat(n.nota);
    const cls = v >= 7 ? 'high' : v >= 5 ? 'mid' : 'low';
    return `<tr>
      <td><strong>${al ? al.nome : '—'}</strong></td>
      <td>${n.bimestre}º Bim.</td>
      <td>${n.disciplina}</td>
      <td><span class="nota-chip ${cls}">${v.toFixed(1)}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit" onclick="editNota(${n.id})">✎ Editar</button>
          <button class="btn-icon remove" onclick="confirmDelete('nota', ${n.id})">✕ Remover</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── RENDER: ATIVIDADES ──────────────────────────────────────
function renderAtividades() {
  const el = document.getElementById('atividades-grid');
  const ativs = state.atividades.filter(a => a.turma === state.turmaAtiva);

  if (!ativs.length) {
    el.innerHTML = '<p class="empty-state">Nenhuma atividade cadastrada.</p>';
    return;
  }

  el.innerHTML = ativs.map(a => `
    <div class="ativ-card">
      <div class="ativ-card-top">
        <span class="ativ-titulo">${a.titulo}</span>
        <span class="ativ-peso p${a.peso}">Peso ${a.peso}</span>
      </div>
      <div class="ativ-disciplina">📚 ${a.disciplina}</div>
      <div class="ativ-desc">${a.descricao || '—'}</div>
      <div class="ativ-footer">
        <span class="ativ-data">📅 ${formatDate(a.data_entrega)}</span>
        <div class="action-btns">
          <button class="btn-icon edit" onclick="editAtividade(${a.id})">✎</button>
          <button class="btn-icon remove" onclick="confirmDelete('atividade', ${a.id})">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ─── AULAS: HELPERS ─────────────────────────────────────────
function calcFimAula(inicio, tipo) {
  if (!inicio) return '';
  const [h, m] = inicio.split(':').map(Number);
  const dur = tipo === 'AE' ? 60 : 120; // minutos
  const total = h * 60 + m + dur;
  const fh = Math.floor(total / 60) % 24;
  const fm = total % 60;
  return String(fh).padStart(2, '0') + ':' + String(fm).padStart(2, '0');
}

function atualizarFimAula() {
  const tipo   = document.getElementById('aula-tipo').value;
  const inicio = document.getElementById('aula-inicio').value;
  const fim    = calcFimAula(inicio, tipo);
  document.getElementById('aula-fim').value = fim;

  const durMin = tipo === 'AE' ? 60 : 120;
  const label  = tipo === 'AE' ? '1 hora (Aula AE)' : '2 horas (Aula Regular)';
  const infoTxt = inicio
    ? `${inicio} → ${fim} · Duração: ${label}`
    : `Duração: ${label}`;
  document.getElementById('aula-duracao-txt').textContent = infoTxt;
}

// ─── RENDER: AULAS ───────────────────────────────────────────
function renderAulas() {
  const aulasAll = state.aulas.filter(a => a.turma === state.turmaAtiva)
    .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));

  const filtro = state.aulaFiltro;
  const aulas  = filtro === 'todos' ? aulasAll
    : aulasAll.filter(a => a.tipo === filtro);

  // Resumo
  const regular = aulasAll.filter(a => a.tipo === 'regular').length;
  const ae      = aulasAll.filter(a => a.tipo === 'AE').length;
  const carga   = regular * 2 + ae * 1;

  document.getElementById('res-total-aulas').textContent  = aulasAll.length;
  document.getElementById('res-aulas-regular').textContent = regular;
  document.getElementById('res-aulas-ae').textContent      = ae;
  document.getElementById('res-carga-total').textContent   = carga + 'h';

  // Tabela
  const tbody = document.getElementById('tbody-aulas');
  if (!aulas.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Nenhuma aula ${filtro !== 'todos' ? 'deste tipo ' : ''}registrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = aulas.map((a, i) => {
    const tipoCls  = a.tipo === 'AE' ? 'ae' : 'regular';
    const tipoText = a.tipo === 'AE' ? 'AE · 1h' : 'Regular · 2h';
    const durMin   = a.tipo === 'AE' ? 60 : 120;
    const durText  = a.tipo === 'AE' ? '1h00' : '2h00';
    return `<tr>
      <td>${i + 1}</td>
      <td>${formatDate(a.data)}</td>
      <td><span class="aula-tipo-chip ${tipoCls}">${tipoText}</span></td>
      <td>${a.disciplina || '—'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.conteudo || ''}">${a.conteudo || '—'}</td>
      <td><span class="hora-display">${a.inicio || '—'}</span></td>
      <td><span class="hora-display">${a.fim || '—'}</span></td>
      <td><span class="aula-duracao-chip">${durText}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit" onclick="editAula(${a.id})">✎ Editar</button>
          <button class="btn-icon remove" onclick="confirmDelete('aula', ${a.id})">✕ Remover</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── AULAS: CRUD ─────────────────────────────────────────────
function editAula(id) {
  const a = state.aulas.find(x => x.id == id);
  if (!a) return;
  document.getElementById('aula-id').value        = a.id;
  document.getElementById('aula-tipo').value      = a.tipo;
  document.getElementById('aula-disciplina').value= a.disciplina || '';
  document.getElementById('aula-conteudo').value  = a.conteudo || '';
  document.getElementById('aula-data').value      = a.data || '';
  document.getElementById('aula-inicio').value    = a.inicio || '';
  document.getElementById('aula-fim').value       = a.fim || '';
  document.getElementById('modal-aula-title').textContent = 'Editar Aula';
  atualizarFimAula();
  openModal('modal-aula');
}

function salvarAula() {
  const tipo      = document.getElementById('aula-tipo').value;
  const disciplina= document.getElementById('aula-disciplina').value.trim();
  const conteudo  = document.getElementById('aula-conteudo').value.trim();
  const data      = document.getElementById('aula-data').value;
  const inicio    = document.getElementById('aula-inicio').value;
  const fim       = calcFimAula(inicio, tipo);
  const id        = document.getElementById('aula-id').value;

  if (!data)    { toast('Informe a data da aula.', 'error'); return; }
  if (!inicio)  { toast('Informe o horário de início.', 'error'); return; }

  if (id) {
    const idx = state.aulas.findIndex(a => a.id == id);
    if (idx >= 0) state.aulas[idx] = { ...state.aulas[idx], tipo, disciplina, conteudo, data, inicio, fim };
    toast('Aula atualizada.', 'success');
  } else {
    state.aulas.push({ id: LOCAL.nextId(state.aulas), tipo, disciplina, conteudo, data, inicio, fim, turma: state.turmaAtiva });
    toast('Aula registrada!', 'success');
  }

  LOCAL.save();
  closeModal('modal-aula');
  renderAll();
}

// ─── RENDER: DESEMPENHO SELECT ──────────────────────────────
function renderDesempenhoSelect() {
  const sel = document.getElementById('select-aluno-desemp');
  const alunos = alunosTurma();
  sel.innerHTML = '<option value="">Selecione um aluno...</option>' +
    alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
}

function renderDesempenho(alunoId) {
  const el = document.getElementById('desempenho-content');
  if (!alunoId) { el.innerHTML = '<p class="empty-state">Selecione um aluno para ver o desempenho.</p>'; return; }

  const aluno = state.alunos.find(a => a.id == alunoId);
  if (!aluno) { el.innerHTML = '<p class="empty-state">Aluno não encontrado.</p>'; return; }

  // Notas
  const nArr = state.notas.filter(n => n.aluno_id == alunoId);
  const mediaNotas = nArr.length
    ? nArr.reduce((s, n) => s + parseFloat(n.nota), 0) / nArr.length : null;

  // Presença
  const pArr = state.presencas.filter(p => p.aluno_id == alunoId && p.turma === state.turmaAtiva);
  const freq = pArr.length
    ? Math.round((pArr.filter(p => p.status === 'P').length / pArr.length) * 100) : null;

  // Atividades
  const ativCount = state.atividades.filter(a => a.turma === state.turmaAtiva).length;

  // Score global (0–10)
  const partes = [];
  if (mediaNotas !== null) partes.push(mediaNotas);
  if (freq !== null) partes.push(freq / 10);
  const score = partes.length ? partes.reduce((s, v) => s + v, 0) / partes.length : 0;
  const grade = scoreLabel(score);

  const notasHTML = nArr.length
    ? nArr.map(n => {
        const v  = parseFloat(n.nota);
        const cls = v >= 7 ? 'high' : v >= 5 ? 'mid' : 'low';
        return `<div class="nota-row">
          <span class="nota-row-disc">${n.disciplina}</span>
          <span class="nota-row-bim">${n.bimestre}º Bim.</span>
          <span class="nota-chip ${cls}">${v.toFixed(1)}</span>
        </div>`;
      }).join('')
    : '<p class="empty-state">Sem notas lançadas.</p>';

  el.innerHTML = `
    <div class="desemp-card">
      <div class="desemp-header">
        <div class="desemp-avatar">${getInitials(aluno.nome)}</div>
        <div>
          <div class="desemp-nome">${aluno.nome}</div>
          <div class="desemp-meta">Matrícula: ${aluno.matricula || '—'} · Turma: ${formatTurma(aluno.turma)}</div>
        </div>
        <div class="desemp-score-badge">
          <div class="score-circle ${grade}">${grade}</div>
          <div class="score-label">Conceito</div>
        </div>
      </div>

      <div class="desemp-metrics">
        <div class="metric-item">
          <div class="metric-label">Média Geral</div>
          <div class="metric-value">${mediaNotas !== null ? mediaNotas.toFixed(1) : '—'}</div>
          <div class="metric-bar">
            <div class="metric-bar-fill ${barColor(mediaNotas ? mediaNotas * 10 : 0)}"
              style="width:${mediaNotas ? mediaNotas * 10 : 0}%"></div>
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Frequência</div>
          <div class="metric-value">${freq !== null ? freq + '%' : '—'}</div>
          <div class="metric-bar">
            <div class="metric-bar-fill ${barColor(freq || 0)}"
              style="width:${freq || 0}%"></div>
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Aulas Presentes</div>
          <div class="metric-value">${pArr.filter(p => p.status === 'P').length}/${pArr.length}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Atividades</div>
          <div class="metric-value">${ativCount}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Score Geral</div>
          <div class="metric-value" style="color:var(--accent)">${score.toFixed(1)}</div>
          <div class="metric-bar">
            <div class="metric-bar-fill blue" style="width:${score * 10}%"></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:0">
        <h3>Notas por Disciplina</h3>
        <div class="desemp-notas-list">${notasHTML}</div>
      </div>
    </div>`;
}

// ─── HELPERS FORMATAÇÃO ─────────────────────────────────────
function formatTurma(t) {
  // CK1 → CK 1
  return t.replace(/(\D+)(\d)/, '$1 $2');
}

// ─── ALUNO: CRUD ────────────────────────────────────────────
function editAluno(id) {
  const a = state.alunos.find(x => x.id == id);
  if (!a) return;
  document.getElementById('aluno-id').value = a.id;
  document.getElementById('aluno-nome').value = a.nome;
  document.getElementById('aluno-matricula').value = a.matricula || '';
  document.getElementById('aluno-turma').value = a.turma;
  document.getElementById('modal-aluno-title').textContent = 'Editar Aluno';
  openModal('modal-aluno');
}

function salvarAluno() {
  const nome  = document.getElementById('aluno-nome').value.trim();
  const matr  = document.getElementById('aluno-matricula').value.trim();
  const turma = document.getElementById('aluno-turma').value;
  const id    = document.getElementById('aluno-id').value;

  if (!nome) { toast('Informe o nome do aluno.', 'error'); return; }

  if (id) {
    const idx = state.alunos.findIndex(a => a.id == id);
    if (idx >= 0) state.alunos[idx] = { ...state.alunos[idx], nome, matricula: matr, turma };
    toast('Aluno atualizado.', 'success');
  } else {
    state.alunos.push({ id: LOCAL.nextId(state.alunos), nome, matricula: matr, turma });
    toast('Aluno adicionado!', 'success');
  }

  LOCAL.save();
  closeModal('modal-aluno');
  renderAll();
}

// ─── NOTA: CRUD ─────────────────────────────────────────────
function populateNotaAlunos() {
  const sel = document.getElementById('nota-aluno');
  const alunos = alunosTurma();
  sel.innerHTML = alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
}

function editNota(id) {
  const n = state.notas.find(x => x.id == id);
  if (!n) return;
  populateNotaAlunos();
  document.getElementById('nota-id').value      = n.id;
  document.getElementById('nota-aluno').value   = n.aluno_id;
  document.getElementById('nota-disciplina').value = n.disciplina;
  document.getElementById('nota-bimestre').value= n.bimestre;
  document.getElementById('nota-valor').value   = n.nota;
  document.getElementById('modal-nota-title').textContent = 'Editar Nota';
  openModal('modal-nota');
}

function salvarNota() {
  const alunoId   = document.getElementById('nota-aluno').value;
  const disc      = document.getElementById('nota-disciplina').value.trim();
  const bimestre  = document.getElementById('nota-bimestre').value;
  const nota      = parseFloat(document.getElementById('nota-valor').value);
  const id        = document.getElementById('nota-id').value;

  if (!disc) { toast('Informe a disciplina.', 'error'); return; }
  if (isNaN(nota) || nota < 0 || nota > 10) { toast('Nota deve ser entre 0 e 10.', 'error'); return; }
  if (!alunoId) { toast('Selecione um aluno.', 'error'); return; }

  if (id) {
    const idx = state.notas.findIndex(n => n.id == id);
    if (idx >= 0) state.notas[idx] = { ...state.notas[idx], aluno_id: parseInt(alunoId), disciplina: disc, bimestre, nota };
    toast('Nota atualizada.', 'success');
  } else {
    state.notas.push({ id: LOCAL.nextId(state.notas), aluno_id: parseInt(alunoId), disciplina: disc, bimestre, nota, turma: state.turmaAtiva });
    toast('Nota lançada!', 'success');
  }

  LOCAL.save();
  closeModal('modal-nota');
  renderAll();
}

// ─── ATIVIDADE: CRUD ─────────────────────────────────────────
function editAtividade(id) {
  const a = state.atividades.find(x => x.id == id);
  if (!a) return;
  document.getElementById('ativ-id').value        = a.id;
  document.getElementById('ativ-titulo').value    = a.titulo;
  document.getElementById('ativ-desc').value      = a.descricao || '';
  document.getElementById('ativ-disciplina').value= a.disciplina;
  document.getElementById('ativ-data').value      = a.data_entrega || '';
  document.getElementById('ativ-peso').value      = a.peso;
  document.getElementById('modal-atividade-title').textContent = 'Editar Atividade';
  openModal('modal-atividade');
}

function salvarAtividade() {
  const titulo  = document.getElementById('ativ-titulo').value.trim();
  const desc    = document.getElementById('ativ-desc').value.trim();
  const disc    = document.getElementById('ativ-disciplina').value.trim();
  const data    = document.getElementById('ativ-data').value;
  const peso    = document.getElementById('ativ-peso').value;
  const id      = document.getElementById('ativ-id').value;

  if (!titulo) { toast('Informe o título da atividade.', 'error'); return; }

  if (id) {
    const idx = state.atividades.findIndex(a => a.id == id);
    if (idx >= 0) state.atividades[idx] = { ...state.atividades[idx], titulo, descricao: desc, disciplina: disc, data_entrega: data, peso };
    toast('Atividade atualizada.', 'success');
  } else {
    state.atividades.push({ id: LOCAL.nextId(state.atividades), titulo, descricao: desc, disciplina: disc, data_entrega: data, peso, turma: state.turmaAtiva });
    toast('Atividade criada!', 'success');
  }

  LOCAL.save();
  closeModal('modal-atividade');
  renderAll();
}

// ─── DELETE CONFIRMAÇÃO ──────────────────────────────────────
function confirmDelete(tipo, id) {
  const msgs = { aluno: 'aluno (e todos seus dados)', nota: 'esta nota', atividade: 'esta atividade' };
  document.getElementById('confirm-msg').textContent =
    `Tem certeza que deseja excluir ${msgs[tipo] || 'este item'}?`;
  state.deleteCallback = () => executeDelete(tipo, id);
  openModal('modal-confirm');
}

function executeDelete(tipo, id) {
  if (tipo === 'aluno') {
    state.alunos    = state.alunos.filter(a => a.id != id);
    state.notas     = state.notas.filter(n => n.aluno_id != id);
    state.presencas = state.presencas.filter(p => p.aluno_id != id);
    toast('Aluno removido.', 'info');
  } else if (tipo === 'nota') {
    state.notas = state.notas.filter(n => n.id != id);
    toast('Nota removida.', 'info');
  } else if (tipo === 'atividade') {
    state.atividades = state.atividades.filter(a => a.id != id);
    toast('Atividade removida.', 'info');
  } else if (tipo === 'aula') {
    state.aulas = state.aulas.filter(a => a.id != id);
    toast('Aula removida.', 'info');
  }
  LOCAL.save();
  renderAll();
}

// ─── RENDER ALL ──────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderAlunos(document.getElementById('search-aluno').value);
  renderPresenca();
  renderNotas();
  renderAtividades();
  renderAulas();
  renderDesempenhoSelect();
  // desempenho só atualiza se aluno selecionado
  const selDesemp = document.getElementById('select-aluno-desemp').value;
  if (selDesemp) renderDesempenho(selDesemp);
}

// ─── SUPABASE CONFIG ─────────────────────────────────────────
async function salvarConfig() {
  const url = document.getElementById('sb-url').value.trim();
  const key = document.getElementById('sb-key').value.trim();
  if (!url || !key) { toast('Preencha URL e chave.', 'error'); return; }

  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);

  // Testa conexão
  const data = await supabaseRequest('GET', 'alunos', null, '?limit=1');
  if (data !== null) {
    toast('Supabase conectado!', 'success');
    updateSupabaseStatus(true);
    closeModal('modal-supabase');
    await syncFromSupabase();
  } else {
    toast('Falha na conexão. Verifique URL e chave.', 'error');
  }
}

async function syncFromSupabase() {
  const [alunos, notas, presencas, atividades, aulas] = await Promise.all([
    DB.select('alunos'),
    DB.select('notas'),
    DB.select('presencas'),
    DB.select('atividades'),
    DB.select('aulas'),
  ]);
  if (alunos.length)     state.alunos     = alunos;
  if (notas.length)      state.notas      = notas;
  if (presencas.length)  state.presencas  = presencas;
  if (atividades.length) state.atividades = atividades;
  if (aulas.length)      state.aulas      = aulas;
  renderAll();
  toast('Dados sincronizados do Supabase.', 'success');
}

function updateSupabaseStatus(connected) {
  const el  = document.getElementById('supabase-status');
  const dot = el.querySelector('.status-dot');
  const txt = el.querySelector('span:last-child');
  dot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
  txt.textContent = connected ? 'Supabase conectado' : 'Supabase desconectado';
}

// ─── NAVEGAÇÃO ───────────────────────────────────────────────
function switchView(view) {
  state.viewAtiva = view;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  document.getElementById('breadcrumb-view').textContent =
    view.charAt(0).toUpperCase() + view.slice(1);
  renderAll();
}

function switchTurma(turma) {
  state.turmaAtiva = turma;
  document.querySelectorAll('.turma-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.turma === turma);
  });
  document.getElementById('breadcrumb-turma').textContent = formatTurma(turma);
  document.getElementById('turma-badge').textContent = formatTurma(turma);
  document.getElementById('dash-turma-name') && (document.getElementById('dash-turma-name').textContent = formatTurma(turma));
  renderAll();
}

// ─── EVENT LISTENERS ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Data
  document.getElementById('date-display').textContent =
    new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  document.getElementById('date-presenca').value =
    new Date().toISOString().split('T')[0];

  // Carrega dados locais
  LOCAL.load();

  // Verifica Supabase
  const { url, key } = getSupabaseConfig();
  if (url && key) {
    updateSupabaseStatus(true);
    document.getElementById('sb-url').value = url;
    document.getElementById('sb-key').value = key;
  }

  // NAV
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // TURMAS
  document.querySelectorAll('.turma-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTurma(btn.dataset.turma));
  });

  // SIDEBAR TOGGLE
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sb   = document.getElementById('sidebar');
    const main = document.querySelector('.main');
    if (window.innerWidth <= 768) {
      sb.classList.toggle('mobile-open');
    } else {
      sb.classList.toggle('collapsed');
      main.classList.toggle('expanded');
    }
  });

  // MODAIS CLOSE
  document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal || btn.closest('.modal').id));
  });

  document.getElementById('modal-overlay').addEventListener('click', () => {
    document.querySelectorAll('.modal.active').forEach(m => closeModal(m.id));
  });

  // CONFIG SUPABASE
  document.getElementById('btn-config').addEventListener('click', () => openModal('modal-supabase'));
  document.getElementById('btn-salvar-config').addEventListener('click', salvarConfig);

  // ALUNO
  document.getElementById('btn-add-aluno').addEventListener('click', () => {
    document.getElementById('aluno-id').value = '';
    document.getElementById('aluno-nome').value = '';
    document.getElementById('aluno-matricula').value = '';
    document.getElementById('aluno-turma').value = state.turmaAtiva;
    document.getElementById('modal-aluno-title').textContent = 'Adicionar Aluno';
    openModal('modal-aluno');
  });
  document.getElementById('btn-salvar-aluno').addEventListener('click', salvarAluno);

  // PRESENÇA
  document.getElementById('btn-salvar-presenca').addEventListener('click', salvarPresenca);
  document.getElementById('date-presenca').addEventListener('change', renderPresenca);

  // NOTA
  document.getElementById('btn-add-nota').addEventListener('click', () => {
    document.getElementById('nota-id').value = '';
    document.getElementById('nota-disciplina').value = '';
    document.getElementById('nota-valor').value = '';
    document.getElementById('modal-nota-title').textContent = 'Lançar Nota';
    populateNotaAlunos();
    openModal('modal-nota');
  });
  document.getElementById('btn-salvar-nota').addEventListener('click', salvarNota);

  // ATIVIDADE
  document.getElementById('btn-add-atividade').addEventListener('click', () => {
    document.getElementById('ativ-id').value = '';
    document.getElementById('ativ-titulo').value = '';
    document.getElementById('ativ-desc').value = '';
    document.getElementById('ativ-disciplina').value = '';
    document.getElementById('ativ-data').value = '';
    document.getElementById('ativ-peso').value = '1';
    document.getElementById('modal-atividade-title').textContent = 'Nova Atividade';
    openModal('modal-atividade');
  });
  document.getElementById('btn-salvar-atividade').addEventListener('click', salvarAtividade);

  // CONFIRM DELETE
  document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (state.deleteCallback) state.deleteCallback();
    state.deleteCallback = null;
    closeModal('modal-confirm');
  });

  // SEARCH ALUNO
  document.getElementById('search-aluno').addEventListener('input', e => {
    renderAlunos(e.target.value);
  });

  // DESEMPENHO SELECT
  document.getElementById('select-aluno-desemp').addEventListener('change', e => {
    renderDesempenho(e.target.value);
  });

  // AULAS — botão adicionar
  document.getElementById('btn-add-aula').addEventListener('click', () => {
    document.getElementById('aula-id').value         = '';
    document.getElementById('aula-tipo').value       = 'regular';
    document.getElementById('aula-disciplina').value = '';
    document.getElementById('aula-conteudo').value   = '';
    document.getElementById('aula-data').value       = new Date().toISOString().split('T')[0];
    document.getElementById('aula-inicio').value     = '';
    document.getElementById('aula-fim').value        = '';
    document.getElementById('modal-aula-title').textContent = 'Registrar Aula';
    atualizarFimAula();
    openModal('modal-aula');
  });

  // AULAS — recalcula fim ao mudar tipo ou início
  document.getElementById('aula-tipo').addEventListener('change', atualizarFimAula);
  document.getElementById('aula-inicio').addEventListener('input', atualizarFimAula);
  document.getElementById('aula-inicio').addEventListener('change', atualizarFimAula);

  // AULAS — salvar
  document.getElementById('btn-salvar-aula').addEventListener('click', salvarAula);

  // AULAS — filtros
  document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.aulaFiltro = btn.dataset.filtro;
      renderAulas();
    });
  });

  // Render inicial
  renderAll();
});
