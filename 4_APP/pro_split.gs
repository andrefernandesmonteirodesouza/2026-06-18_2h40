/**
 * 📂 ARQUIVO: 4_APP/pro_split.gs
 * ✂️ MÓDULO: DIVISOR DE TRANSAÇÕES + FATURA MANUAL + PARCELAMENTOS MANUAIS
 * 🔢 VERSÃO: 4.0 (PATCH 32A + 32B FIX + 32C — PARCELAMENTOS MANUAIS COMPLETO)
 * 📅 DATA: 2026-06-18
 * 👤 AUTOR: André Fernandes (Sócio) & Claude (Arquiteto)
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * Módulo unificado de divisão de transações financeiras, com três blocos:
 *
 * BLOCO 1 — Split normal (PRO_SPLIT): Divide uma transação em partes,
 * mantendo a linha original como "S" (Shadow) e criando filhas com IDs rastreáveis.
 *
 * BLOCO 2 — Fatura Manual / Parcelamentos (32A + 32B): Controla parcelamentos
 * futuros de cartões legados (Bradesco, Santander, XP, Inter, Nubank) sem precisar
 * de parsers. Cadastra a agenda de parcelas em DB_PARCELAMENTOS_MANUAIS e vincula
 * ao split real da fatura paga mês a mês.
 *
 * BLOCO 3 — Integração com Dashboard (32C): Função pública que retorna os dados
 * de parcelamentos manuais no mesmo formato esperado pelo Dashboard V2
 * (GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_), permitindo soma de duas fontes:
 * PicPay importado + cartões legados manuais.
 *
 * 🔄 HISTÓRICO COMPLETO DE VERSÕES:
 * - V1.0 (Enterprise Legacy): Versão antiga, incompatível com GFP 1.0.
 * - V2.0 (Migration): Primeira adaptação. Lógica destrutiva (apagava a linha original).
 *   [RISCO]: Perda de histórico da transação bancária original.
 * - V3.0 (Enterprise Standard): Introdução da lógica "Shadow/Split".
 *   A linha original é mantida como "S" (Shadow/Inativa) e formatada em cinza.
 *   As linhas filhas herdam o ID com sufixo (-1, -2).
 * - V3.1 (Notes Compat): Adaptação para estrutura de 14 colunas.
 *   [ERRO]: Falta do cabeçalho padrão Diamante.
 * - V3.2 (DIAMOND RESTORE): Cabeçalho completo restaurado. Lógica de NOTAS refinada.
 *   Rastreabilidade via ID original como raiz das filhas.
 * - V3.3 (PATCH 32A): Adição do módulo DB_PARCELAMENTOS_MANUAIS.
 *   Cadastro manual de parcelamentos futuros. Sem mexer no Split normal.
 * - V3.4 (PATCH 32B): Adição de "Dividir como Fatura Manual".
 *   [BUG]: createHtmlOutput usado em vez de createTemplate — google.script.run
 *   não funcionava no modal. Botão "Buscar parcelas previstas" era mudo.
 * - V4.0 (ATUAL — PATCH 32B FIX + 32C):
 *   > CORREÇÃO CRÍTICA: createHtmlOutput → createTemplate + initialData base64
 *     no GFP_FATURA_MANUAL_OPEN_16_1_18_32B. google.script.run agora funciona.
 *   > PATCH 32C: GFP_DASH_V2_PARCELAMENTOS_MANUAIS_16_1_18_32C() expõe os
 *     parcelamentos manuais no mesmo formato do Dashboard V2, para soma com
 *     PicPay importado. Chamada via GFP_DASH_V2_BUILD_PARCELAMENTOS_MERGE_32C().
 *   > Regra de Diamante: código Gordelício, verbose, try/catch em tudo,
 *     logs detalhados, sem simplificação de funções existentes.
 * -----------------------------------------------------------------------------
 */

// =============================================================================
// BLOCO 1 — SPLIT NORMAL (PRO_SPLIT) — ORIGINAL INTACTO
// =============================================================================

function PRO_SPLIT_openModal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const cell = sheet.getActiveCell();
  const row = cell.getRow();

  if (sheet.getName() !== "DB_TRANSACOES" || row < 2) {
    SpreadsheetApp.getUi().alert("⚠️ Selecione uma transação na aba DB_TRANSACOES para dividir.");
    return;
  }

  const range = sheet.getRange(row, 1, 1, 14);
  const values = range.getValues()[0];

  if (values[3] === 'S') {
    SpreadsheetApp.getUi().alert("⚠️ Esta linha já é uma origem de divisão (Tipo S). Edite as linhas filhas.");
    return;
  }

  const transactionData = {
    row: row,
    date: values[0] instanceof Date ? Utilities.formatDate(values[0], Session.getScriptTimeZone(), "yyyy-MM-dd") : values[0],
    desc: values[1],
    amount: Math.abs(values[2]),
    type: values[3],
    account: values[4],
    originalCat: values[5] || ""
  };

  const htmlTemplate = HtmlService.createTemplate(getSplitHtml());
  htmlTemplate.data = transactionData;

  const html = htmlTemplate.evaluate()
    .setWidth(650).setHeight(650)
    .setTitle("✂️ Dividir Lançamento (Enterprise)");

  SpreadsheetApp.getUi().showModalDialog(html, "Dividir Lançamento");
}

function PRO_SPLIT_process(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DB_TRANSACOES");

  const rowIdx = parseInt(form.originalRow);
  const originalRowRange = sheet.getRange(rowIdx, 1, 1, 14);
  const originalData = originalRowRange.getValues()[0];

  const newRows = [];
  const parts = JSON.parse(form.splitData);
  const isDebit = originalData[3] === 'D' || (typeof originalData[2] === 'number' && originalData[2] < 0);

  const parentID = originalData[10];

  parts.forEach((part, index) => {
    const newRow = [...originalData];

    newRow[1] = part.desc;

    let val = parseFloat(part.val);
    if (isDebit) val = -Math.abs(val);
    else val = Math.abs(val);

    newRow[2] = val;
    newRow[3] = isDebit ? 'D' : 'C';
    newRow[5] = part.cat;
    newRow[8] = "OK";
    newRow[10] = parentID + "-" + (index + 1);
    newRow[12] = "";

    newRows.push(newRow);
  });

  sheet.getRange(rowIdx, 2).setValue(`[DIVIDIDO] — ${originalData[1]}`);
  sheet.getRange(rowIdx, 4).setValue("S");
  sheet.getRange(rowIdx, 6).setValue("");
  sheet.getRange(rowIdx, 9).setValue("SPLIT");

  originalRowRange.setBackground("#f3f3f3").setFontColor("#999999").setFontStyle("italic");

  sheet.insertRowsAfter(rowIdx, newRows.length);
  const newRange = sheet.getRange(rowIdx + 1, 1, newRows.length, 14);
  newRange.setValues(newRows);

  newRange.setBackground(null).setFontColor(null).setFontStyle(null);
  newRange.setBorder(true, true, true, true, true, true, "#D3D3D3", SpreadsheetApp.BorderStyle.SOLID);

  try {
    const rule = sheet.getRange(rowIdx, 6).getDataValidation();
    if (rule) {
      sheet.getRange(rowIdx + 1, 6, newRows.length, 1).setDataValidation(rule);
    }
  } catch(e) {}

  return `Sucesso! Lançamento transformado em histórico e dividido em ${newRows.length} partes.`;
}

function API_GET_CATEGORIES_SPLIT() {
  if (typeof apiGetCategories === 'function') return apiGetCategories();
  return [];
}

function getSplitHtml() {
  return `<!DOCTYPE html><html><head><base target="_top"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{font-family:sans-serif;padding:20px;background:#f8f9fa}.split-row{background:#fff;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;display:flex;gap:10px;align-items:center}.total-box{font-size:1.2rem;font-weight:bold;text-align:right;margin-top:20px}.match{color:#198754}.mismatch{color:#dc3545}.btn-remove{color:#dc3545;cursor:pointer;font-weight:bold;padding:0 10px}.info-box{background:#e2e3e5;padding:10px;border-radius:8px;margin-bottom:20px;font-size:0.9rem;color:#383d41}</style></head><body><div class="mb-3"><label class="form-label text-muted small">LANÇAMENTO ORIGINAL</label><div class="fw-bold"><?= data.desc ?></div><div class="fs-4"><?= parseFloat(data.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) ?></div></div><div class="info-box"><i class="bi bi-info-circle"></i> O item original será mantido como histórico (Tipo 'S') e novos itens serão criados abaixo dele.</div><hr><div id="split-container"></div><div class="d-grid gap-2 mb-3"><button class="btn btn-outline-primary btn-sm" onclick="addRow()">+ Adicionar Parte</button></div><div class="total-box">Total: <span id="current-total">R$ 0,00</span><div id="diff-msg" style="font-size:0.8rem">Falta: R$ 0,00</div></div><div class="d-grid gap-2 mt-4"><button id="btn-save" class="btn btn-success" disabled onclick="saveSplit()">CONFIRMAR DIVISÃO</button></div><datalist id="list-cats"></datalist><script>const ORIGINAL_AMOUNT=<?= data.amount ?>;const ORIGINAL_DESC="<?= data.desc ?>";const ORIGINAL_CAT="<?= data.originalCat ?>";const ROW_ID=<?= data.row ?>;window.onload=function(){google.script.run.withSuccessHandler(function(cats){const dl=document.getElementById('list-cats');cats.forEach(c=>{const opt=document.createElement('option');opt.value=c;dl.appendChild(opt)});addRow("[SPLIT 1] "+ORIGINAL_DESC,ORIGINAL_AMOUNT,ORIGINAL_CAT);addRow("[SPLIT 2] "+ORIGINAL_DESC,0,"");recalc()}).API_GET_CATEGORIES_SPLIT()};function addRow(desc="",val=0,cat=""){const div=document.createElement('div');div.className='split-row';div.innerHTML=\`<div class="flex-grow-1"><input type="text" class="form-control form-control-sm mb-1 inp-desc" placeholder="Descrição" value="\${desc}"><input class="form-control form-control-sm inp-cat" list="list-cats" placeholder="Categoria" value="\${cat}"></div><div style="width:120px"><input type="number" class="form-control inp-val" step="0.01" value="\${val}" oninput="recalc()"></div><div class="btn-remove" onclick="this.parentElement.remove();recalc()">✕</div>\`;document.getElementById('split-container').appendChild(div)}function recalc(){let total=0;document.querySelectorAll('.inp-val').forEach(inp=>{total+=parseFloat(inp.value)||0});const diff=ORIGINAL_AMOUNT-total;const elTotal=document.getElementById('current-total');const elMsg=document.getElementById('diff-msg');const btn=document.getElementById('btn-save');elTotal.innerText=total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});if(Math.abs(diff)<0.01){elTotal.className='match';elMsg.innerHTML='<span class="text-success">✔ Valores batem!</span>';btn.disabled=false}else{elTotal.className='mismatch';elMsg.innerHTML='<span class="text-danger">Diferença: '+diff.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</span>';btn.disabled=true}}function saveSplit(){const rows=[];const els=document.querySelectorAll('.split-row');for(let el of els){const desc=el.querySelector('.inp-desc').value;const cat=el.querySelector('.inp-cat').value;const val=el.querySelector('.inp-val').value;if(!desc||!cat||val<=0){alert("Erro: Preencha descrição, categoria e valor positivo em todas as linhas.");return}rows.push({desc,cat,val})}document.getElementById('btn-save').innerText="Processando...";document.getElementById('btn-save').disabled=true;google.script.run.withSuccessHandler(function(msg){google.script.host.close()}).PRO_SPLIT_process({originalRow:ROW_ID,splitData:JSON.stringify(rows)})}</script></body></html>`;
}

// =============================================================================
// BLOCO 2A — PATCH 32A: BASE DE PARCELAMENTOS MANUAIS
// =============================================================================
// Objetivo:
// - Controlar parcelamentos futuros conhecidos de cartões legados.
// - NÃO lançar futuro como despesa real na DB_TRANSACOES.
// - NÃO mexer na DRE.
// - Servir de base para o Patch 32B (Fatura Manual).
// =============================================================================

const GFP_PARC_MANUAIS_SHEET_16_1_18_32 = "DB_PARCELAMENTOS_MANUAIS";

const GFP_PARC_MANUAIS_HEADERS_16_1_18_32 = [
  "ID_PARCELAMENTO",
  "STATUS",
  "CARTAO",
  "BANCO",
  "GRUPO_DONO",
  "DESCRICAO",
  "CATEGORIA",
  "VALOR_PARCELA",
  "PARC_ATUAL",
  "PARC_TOTAL",
  "COMPETENCIA",
  "DATA_PREVISTA",
  "ID_TRANSACAO_FATURA",
  "ID_SPLIT_REALIZADO",
  "ORIGEM",
  "OBSERVACOES",
  "CRIADO_EM",
  "ATUALIZADO_EM"
];

/**
 * Cria/garante a aba DB_PARCELAMENTOS_MANUAIS com cabeçalhos, formatação e filtro.
 */
function GFP_PARC_MANUAIS_GARANTIR_ABA_16_1_18_32() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sh = ss.getSheetByName(GFP_PARC_MANUAIS_SHEET_16_1_18_32);

  if (!sh) {
    sh = ss.insertSheet(GFP_PARC_MANUAIS_SHEET_16_1_18_32);
  }

  const headers = GFP_PARC_MANUAIS_HEADERS_16_1_18_32;
  const width = headers.length;

  const current = sh.getRange(1, 1, 1, width).getValues()[0];
  const same = headers.every(function(h, i) {
    return String(current[i] || "").trim() === h;
  });

  if (!same) {
    sh.getRange(1, 1, 1, width).setValues([headers]);
  }

  sh.setFrozenRows(1);

  try {
    sh.getRange(1, 1, 1, width)
      .setFontWeight("bold")
      .setBackground("#1f4e78")
      .setFontColor("#ffffff");

    sh.getRange("H:H").setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");
    sh.getRange("L:L").setNumberFormat("dd/mm/yyyy");
    sh.autoResizeColumns(1, width);
  } catch (eFormat) {}

  try {
    const filter = sh.getFilter();
    if (!filter && sh.getLastRow() >= 1) {
      sh.getRange(1, 1, Math.max(1, sh.getLastRow()), width).createFilter();
    }
  } catch (eFilter) {}

  try {
    if (typeof GFP_LOG_HUMANO_APPEND_16_1_4_ === "function") {
      GFP_LOG_HUMANO_APPEND_16_1_4_(
        "OK",
        "Parcelamentos",
        "Aba DB_PARCELAMENTOS_MANUAIS garantida.",
        ""
      );
    }
  } catch (eLog) {}

  return {
    ok: true,
    sheet: GFP_PARC_MANUAIS_SHEET_16_1_18_32,
    headers: headers.length
  };
}

/**
 * Abre modal para cadastrar um parcelamento manual.
 * Usa createTemplate para que google.script.run funcione no modal.
 */
function GFP_PARC_MANUAIS_OPEN_CADASTRO_16_1_18_32() {
  GFP_PARC_MANUAIS_GARANTIR_ABA_16_1_18_32();

  const htmlTemplate = HtmlService.createTemplate(GFP_PARC_MANUAIS_HTML_CADASTRO_16_1_18_32_());

  htmlTemplate.data = {
    categorias: GFP_PARC_MANUAIS_LISTAR_CATEGORIAS_16_1_18_32_(),
    competenciaPadrao: GFP_PARC_MANUAIS_COMPETENCIA_ATUAL_16_1_18_32_()
  };

  const html = htmlTemplate.evaluate()
    .setWidth(760)
    .setHeight(760)
    .setTitle("💳 Cadastrar Parcelamento Manual");

  SpreadsheetApp.getUi().showModalDialog(html, "💳 Cadastrar Parcelamento Manual");
}

/**
 * Salva uma série de parcelamentos manuais na DB_PARCELAMENTOS_MANUAIS.
 * Gera automaticamente todas as parcelas da atual até a última.
 *
 * @param {Object} payload - cartao, banco, grupoDono, descricao, categoria,
 *                           valorParcela, parcAtual, parcTotal,
 *                           competenciaInicial, diaPrevisto, observacoes
 * @returns {Object} resultado com idBase, parcelasCriadas, competências
 */
function GFP_PARC_MANUAIS_SAVE_SERIE_16_1_18_32(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PARC_MANUAIS_SHEET_16_1_18_32) ||
    ss.insertSheet(GFP_PARC_MANUAIS_SHEET_16_1_18_32);

  GFP_PARC_MANUAIS_GARANTIR_ABA_16_1_18_32();

  payload = payload || {};

  const cartao = String(payload.cartao || "").trim();
  const banco = String(payload.banco || "").trim();
  const grupoDono = String(payload.grupoDono || "").trim();
  const descricao = String(payload.descricao || "").trim();
  const categoria = String(payload.categoria || "").trim();
  const observacoes = String(payload.observacoes || "").trim();

  const valorParcela = GFP_PARC_MANUAIS_PARSE_VALOR_16_1_18_32_(payload.valorParcela);
  const parcAtual = Number(payload.parcAtual || 0);
  const parcTotal = Number(payload.parcTotal || 0);

  const competenciaInicial = String(payload.competenciaInicial || "").trim();
  const diaPrevisto = Math.max(1, Math.min(28, Number(payload.diaPrevisto || 10)));

  if (!cartao) throw new Error("Informe o cartão.");
  if (!banco) throw new Error("Informe o banco.");
  if (!grupoDono) throw new Error("Informe o grupo/dono.");
  if (!descricao) throw new Error("Informe a descrição.");
  if (!categoria) throw new Error("Informe a categoria.");
  if (!valorParcela || valorParcela <= 0) throw new Error("Informe valor de parcela positivo.");
  if (!parcAtual || !parcTotal || parcAtual < 1 || parcTotal < parcAtual) {
    throw new Error("Informe parcela atual e total válidos.");
  }
  if (!/^\d{4}-\d{2}$/.test(competenciaInicial)) {
    throw new Error("Competência inicial inválida. Use AAAA-MM, exemplo: 2026-06.");
  }

  const validCats = GFP_PARC_MANUAIS_LISTAR_CATEGORIAS_16_1_18_32_();
  if (validCats.indexOf(categoria) < 0) {
    throw new Error("Categoria não encontrada na CFG_Categorias: " + categoria);
  }

  const now = new Date();
  const baseId = GFP_PARC_MANUAIS_NEW_ID_16_1_18_32_(descricao, cartao, competenciaInicial);

  const rows = [];

  for (let p = parcAtual; p <= parcTotal; p++) {
    const offset = p - parcAtual;
    const competencia = GFP_PARC_MANUAIS_ADD_MONTHS_16_1_18_32_(competenciaInicial, offset);
    const dataPrevista = GFP_PARC_MANUAIS_DATE_FROM_COMPETENCIA_16_1_18_32_(competencia, diaPrevisto);

    rows.push([
      baseId + "-P" + String(p).padStart(2, "0"),
      offset === 0 ? "PENDENTE" : "PREVISTA",
      cartao,
      banco,
      grupoDono,
      descricao,
      categoria,
      valorParcela,
      p,
      parcTotal,
      competencia,
      dataPrevista,
      "",
      "",
      "CADASTRO_MANUAL_16_1_18_32",
      observacoes,
      now,
      now
    ]);
  }

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, GFP_PARC_MANUAIS_HEADERS_16_1_18_32.length)
      .setValues(rows);

    try {
      sh.getRange(2, 8, Math.max(1, sh.getLastRow() - 1), 1)
        .setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");
      sh.getRange(2, 12, Math.max(1, sh.getLastRow() - 1), 1)
        .setNumberFormat("dd/mm/yyyy");
    } catch (eFmt) {}
  }

  try {
    if (typeof GFP_LOG_HUMANO_APPEND_16_1_4_ === "function") {
      GFP_LOG_HUMANO_APPEND_16_1_4_(
        "OK",
        "Parcelamentos",
        "Parcelamento manual cadastrado: " + descricao +
        " | " + parcAtual + "/" + parcTotal +
        " | " + cartao +
        " | " + grupoDono,
        ""
      );
    }
  } catch (eLog) {}

  ss.toast(
    "Parcelamento cadastrado: " + rows.length + " parcela(s).",
    "GFP — Parcelamentos Manuais",
    8
  );

  return {
    ok: true,
    idBase: baseId,
    parcelasCriadas: rows.length,
    primeiraCompetencia: competenciaInicial,
    ultimaCompetencia: rows.length ? rows[rows.length - 1][10] : competenciaInicial
  };
}

/**
 * Lista parcelas da DB_PARCELAMENTOS_MANUAIS por filtros opcionais.
 * Usada pelo Patch 32B (Fatura Manual) e pelo Patch 32C (Dashboard).
 *
 * @param {Object} filters - cartao, banco, competencia, grupoDono, status[]
 * @returns {Array} lista de objetos com os campos da aba
 */
function GFP_PARC_MANUAIS_LISTAR_PREVISTAS_16_1_18_32(filters) {
  filters = filters || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PARC_MANUAIS_SHEET_16_1_18_32);

  if (!sh || sh.getLastRow() < 2) {
    return [];
  }

  const data = sh.getRange(2, 1, sh.getLastRow() - 1, GFP_PARC_MANUAIS_HEADERS_16_1_18_32.length).getValues();

  const fCartao = String(filters.cartao || "").trim().toUpperCase();
  const fBanco = String(filters.banco || "").trim().toUpperCase();
  const fCompetencia = String(filters.competencia || "").trim();
  const fGrupo = String(filters.grupoDono || "").trim().toUpperCase();
  const statusPermitidos = filters.status || ["PENDENTE", "PREVISTA"];

  const out = [];

  data.forEach(function(r, idx) {
    const obj = GFP_PARC_MANUAIS_ROW_TO_OBJECT_16_1_18_32_(r, idx + 2);

    if (statusPermitidos.indexOf(obj.STATUS) < 0) return;
    if (fCartao && String(obj.CARTAO || "").toUpperCase() !== fCartao) return;
    if (fBanco && String(obj.BANCO || "").toUpperCase() !== fBanco) return;
    if (fCompetencia && obj.COMPETENCIA !== fCompetencia) return;
    if (fGrupo && String(obj.GRUPO_DONO || "").toUpperCase() !== fGrupo) return;

    out.push(obj);
  });

  return out;
}

/**
 * Marca parcelas como PAGA na DB_PARCELAMENTOS_MANUAIS.
 * Chamada pelo Patch 32B após salvar o split da fatura.
 *
 * @param {Array} ids - lista de ID_PARCELAMENTO a marcar
 * @param {string} idTransacaoFatura - ID da transação mãe (fatura paga)
 * @param {string} idSplitRealizado - splitId gerado pelo Patch 32B
 * @returns {Object} { ok, updated }
 */
function GFP_PARC_MANUAIS_MARCAR_PAGAS_16_1_18_32(ids, idTransacaoFatura, idSplitRealizado) {
  ids = ids || [];

  if (!ids.length) {
    return { ok: true, updated: 0 };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PARC_MANUAIS_SHEET_16_1_18_32);

  if (!sh || sh.getLastRow() < 2) {
    return { ok: false, updated: 0, reason: "DB_PARCELAMENTOS_MANUAIS vazia." };
  }

  const idSet = {};
  ids.forEach(function(id) {
    idSet[String(id || "").trim()] = true;
  });

  const width = GFP_PARC_MANUAIS_HEADERS_16_1_18_32.length;
  const range = sh.getRange(2, 1, sh.getLastRow() - 1, width);
  const values = range.getValues();

  let updated = 0;
  const now = new Date();

  values.forEach(function(r) {
    const id = String(r[0] || "").trim();

    if (!idSet[id]) return;

    r[1] = "PAGA";
    r[12] = idTransacaoFatura || r[12] || "";
    r[13] = idSplitRealizado || r[13] || "";
    r[17] = now;
    updated++;
  });

  range.setValues(values);

  try {
    if (typeof GFP_LOG_HUMANO_APPEND_16_1_4_ === "function") {
      GFP_LOG_HUMANO_APPEND_16_1_4_(
        "OK",
        "Parcelamentos",
        "Parcelas manuais marcadas como pagas: " + updated,
        ""
      );
    }
  } catch (eLog) {}

  return {
    ok: true,
    updated: updated
  };
}

/**
 * Atualiza o status de parcelas para qualquer valor válido.
 * Útil para cancelar, ignorar ou reabrir parcelas manualmente.
 *
 * @param {Array} ids - lista de ID_PARCELAMENTO
 * @param {string} status - PREVISTA | PENDENTE | PAGA | CANCELADA | ENCERRADA | IGNORADA
 * @param {string} observacaoExtra - texto opcional a anexar na coluna OBSERVACOES
 * @returns {Object} { ok, updated, status }
 */
function GFP_PARC_MANUAIS_ATUALIZAR_STATUS_16_1_18_32(ids, status, observacaoExtra) {
  ids = ids || [];
  status = String(status || "").trim().toUpperCase();

  const allowed = ["PREVISTA", "PENDENTE", "PAGA", "CANCELADA", "ENCERRADA", "IGNORADA"];

  if (allowed.indexOf(status) < 0) {
    throw new Error("Status inválido: " + status);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PARC_MANUAIS_SHEET_16_1_18_32);

  if (!sh || sh.getLastRow() < 2) {
    return { ok: false, updated: 0, reason: "DB_PARCELAMENTOS_MANUAIS vazia." };
  }

  const idSet = {};
  ids.forEach(function(id) {
    idSet[String(id || "").trim()] = true;
  });

  const width = GFP_PARC_MANUAIS_HEADERS_16_1_18_32.length;
  const range = sh.getRange(2, 1, sh.getLastRow() - 1, width);
  const values = range.getValues();

  let updated = 0;
  const now = new Date();

  values.forEach(function(r) {
    const id = String(r[0] || "").trim();

    if (!idSet[id]) return;

    r[1] = status;

    if (observacaoExtra) {
      r[15] = String(r[15] || "") + " | " + observacaoExtra;
    }

    r[17] = now;
    updated++;
  });

  range.setValues(values);

  return {
    ok: true,
    updated: updated,
    status: status
  };
}

// =============================================================================
// HELPERS INTERNOS — PARCELAMENTOS MANUAIS (32A)
// =============================================================================

function GFP_PARC_MANUAIS_ROW_TO_OBJECT_16_1_18_32_(r, rowNumber) {
  const h = GFP_PARC_MANUAIS_HEADERS_16_1_18_32;
  const obj = { rowNumber: rowNumber };
  h.forEach(function(name, i) { obj[name] = r[i]; });
  return obj;
}

function GFP_PARC_MANUAIS_LISTAR_CATEGORIAS_16_1_18_32_() {
  try {
    if (typeof API_GET_CATEGORIES_SPLIT === "function") {
      const cats = API_GET_CATEGORIES_SPLIT();
      if (cats && cats.length) {
        return cats.map(String).filter(Boolean).sort();
      }
    }
  } catch (eApi) {}

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CFG_Categorias");
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  const set = {};

  values.forEach(function(row) {
    row.forEach(function(cell) {
      const txt = String(cell || "").trim();
      if (/^\d{2}\.\d{2}\s+—\s+/.test(txt) || /^\d{2}\.\d{2}\s-\s/.test(txt)) {
        set[txt] = true;
      }
    });
  });

  return Object.keys(set).sort();
}

function GFP_PARC_MANUAIS_PARSE_VALOR_16_1_18_32_(value) {
  if (typeof value === "number") return Math.abs(value);
  const txt = String(value || "")
    .replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  const n = Number(txt);
  return isNaN(n) ? 0 : Math.abs(n);
}

function GFP_PARC_MANUAIS_COMPETENCIA_ATUAL_16_1_18_32_() {
  const now = new Date();
  const tz = Session.getScriptTimeZone() || "America/Sao_Paulo";
  return Utilities.formatDate(now, tz, "yyyy-MM");
}

function GFP_PARC_MANUAIS_ADD_MONTHS_16_1_18_32_(yyyyMm, offset) {
  const m = String(yyyyMm || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error("Competência inválida: " + yyyyMm);
  const d = new Date(Number(m[1]), Number(m[2]) - 1 + Number(offset || 0), 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function GFP_PARC_MANUAIS_DATE_FROM_COMPETENCIA_16_1_18_32_(yyyyMm, day) {
  const m = String(yyyyMm || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error("Competência inválida: " + yyyyMm);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(day || 10));
}

function GFP_PARC_MANUAIS_NEW_ID_16_1_18_32_(descricao, cartao, competencia) {
  return [
    "PM",
    Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyyMMddHHmmss"),
    Math.floor(Math.random() * 100000),
    String(descricao || "").slice(0, 12).replace(/[^A-Za-z0-9]/g, ""),
    String(cartao || "").slice(0, 8).replace(/[^A-Za-z0-9]/g, ""),
    String(competencia || "").replace(/[^0-9]/g, "")
  ].join("-");
}

/**
 * HTML do modal de cadastro de parcelamento manual.
 * Usa scriptlet <?= ?> do createTemplate para injetar categorias e competência.
 */
function GFP_PARC_MANUAIS_HTML_CADASTRO_16_1_18_32_() {
  return `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f7f8fa; color: #1f2937; }
    h2 { margin-top: 0; color: #0f3761; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { grid-column: 1 / -1; }
    label { display: block; font-size: 12px; font-weight: bold; color: #334155; margin-bottom: 4px; text-transform: uppercase; }
    input, select, textarea { width: 100%; box-sizing: border-box; padding: 9px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: #fff; }
    textarea { resize: vertical; min-height: 58px; }
    .box { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
    .hint { font-size: 12px; color: #64748b; line-height: 1.45; background: #eaf2ff; padding: 10px; border-radius: 8px; margin-bottom: 16px; }
    .btn { width: 100%; border: none; border-radius: 8px; padding: 12px; font-weight: bold; cursor: pointer; color: #fff; background: #198754; margin-top: 16px; }
    .btn:disabled { opacity: .6; cursor: wait; }
    .preview { font-size: 13px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px; margin-top: 12px; }
  </style>
</head>
<body>
  <h2>💳 Cadastrar Parcelamento Manual</h2>
  <div class="hint">
    Use para cartões legados ou faturas sem parser. Cria apenas compromissos futuros em
    <b>DB_PARCELAMENTOS_MANUAIS</b>. Não lança despesa real na DRE.
  </div>
  <div class="box">
    <div class="grid">
      <div><label>Cartão</label><input id="cartao" list="cartoes" placeholder="Ex.: Bradesco André"></div>
      <div><label>Banco</label><input id="banco" list="bancos" placeholder="Ex.: Bradesco"></div>
      <div>
        <label>Grupo/Dono</label>
        <select id="grupoDono">
          <option value="Pessoal André">Pessoal André</option>
          <option value="Pessoal Yan">Pessoal Yan</option>
          <option value="FERMONT">FERMONT</option>
          <option value="AME">AME</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div><label>Competência inicial</label><input id="competenciaInicial" value="<?= data.competenciaPadrao ?>" placeholder="2026-06"></div>
      <div class="full"><label>Descrição da compra</label><input id="descricao" placeholder="Ex.: CLARO LJ RIO SUL"></div>
      <div class="full"><label>Categoria</label><input id="categoria" list="categorias" placeholder="Digite para buscar na CFG_Categorias"></div>
      <div><label>Valor da parcela</label><input id="valorParcela" placeholder="261,90"></div>
      <div><label>Dia previsto/vencimento</label><input id="diaPrevisto" type="number" value="10" min="1" max="28"></div>
      <div><label>Parcela atual</label><input id="parcAtual" type="number" value="1" min="1"></div>
      <div><label>Total de parcelas</label><input id="parcTotal" type="number" value="1" min="1"></div>
      <div class="full"><label>Observações</label><textarea id="observacoes" placeholder="Opcional"></textarea></div>
    </div>
    <div class="preview" id="preview">Preencha os dados para ver o resumo.</div>
    <button class="btn" id="btnSalvar" onclick="salvar()">SALVAR PARCELAMENTO</button>
  </div>
  <datalist id="categorias">
    <? for (var i = 0; i < data.categorias.length; i++) { ?>
      <option value="<?= data.categorias[i] ?>"></option>
    <? } ?>
  </datalist>
  <datalist id="cartoes">
    <option value="Bradesco André"></option>
    <option value="Santander André"></option>
    <option value="XP André"></option>
    <option value="Inter André"></option>
    <option value="Nubank André"></option>
    <option value="PicPay André (Cartão)"></option>
    <option value="PicPay Yan (Cartão)"></option>
  </datalist>
  <datalist id="bancos">
    <option value="Bradesco"></option>
    <option value="Santander"></option>
    <option value="XP"></option>
    <option value="Inter"></option>
    <option value="Nubank"></option>
    <option value="PicPay"></option>
  </datalist>
  <script>
    const campos = ["cartao","banco","grupoDono","descricao","categoria","valorParcela","parcAtual","parcTotal","competenciaInicial","diaPrevisto"];
    campos.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("input", atualizarPreview); });

    function brMoneyToNumber(v) {
      v = String(v||"").replace(/\\s/g,"").replace("R$","").replace(/\\./g,"").replace(",",".");
      const n = Number(v); return isNaN(n) ? 0 : Math.abs(n);
    }

    function atualizarPreview() {
      const atual = Number(document.getElementById("parcAtual").value||0);
      const total = Number(document.getElementById("parcTotal").value||0);
      const valor = brMoneyToNumber(document.getElementById("valorParcela").value);
      const qtd = total >= atual && atual > 0 ? (total - atual + 1) : 0;
      document.getElementById("preview").innerHTML =
        "<b>Resumo:</b> serão criadas <b>"+qtd+"</b> parcela(s), da "+atual+"/"+total+" até "+total+"/"+total+".<br>"+
        "Valor futuro/controlado: <b>R$ "+(qtd*valor).toLocaleString("pt-BR",{minimumFractionDigits:2})+"</b>.";
    }

    function salvar() {
      const btn = document.getElementById("btnSalvar");
      btn.disabled = true; btn.innerText = "Salvando...";
      const payload = {
        cartao: document.getElementById("cartao").value,
        banco: document.getElementById("banco").value,
        grupoDono: document.getElementById("grupoDono").value,
        descricao: document.getElementById("descricao").value,
        categoria: document.getElementById("categoria").value,
        valorParcela: document.getElementById("valorParcela").value,
        parcAtual: document.getElementById("parcAtual").value,
        parcTotal: document.getElementById("parcTotal").value,
        competenciaInicial: document.getElementById("competenciaInicial").value,
        diaPrevisto: document.getElementById("diaPrevisto").value,
        observacoes: document.getElementById("observacoes").value
      };
      google.script.run
        .withSuccessHandler(function(res) { google.script.host.close(); })
        .withFailureHandler(function(err) {
          alert(err && err.message ? err.message : err);
          btn.disabled = false; btn.innerText = "SALVAR PARCELAMENTO";
        })
        .GFP_PARC_MANUAIS_SAVE_SERIE_16_1_18_32(payload);
    }

    atualizarPreview();
  </script>
</body>
</html>`;
}

// =============================================================================
// BLOCO 2B — PATCH 32B (CORRIGIDO): DIVIDIR COMO FATURA MANUAL
// =============================================================================
// CORREÇÃO CRÍTICA V4.0:
// A versão anterior usava HtmlService.createHtmlOutput(), que NÃO disponibiliza
// google.script.run no contexto do modal. O botão "Buscar parcelas previstas"
// chamava google.script.run silenciosamente e não recebia resposta.
//
// Correção: usar HtmlService.createTemplate() + tpl.evaluate(), igual ao
// padrão já correto do Patch 32A e do Split normal.
// O payload é transmitido via initialData (base64) como propriedade do template,
// evitando qualquer problema de interpolação de caracteres especiais em JSON.
// =============================================================================

/**
 * Abre o modal "Dividir como Fatura Manual".
 * Deve ser chamado com uma linha selecionada na aba DB_TRANSACOES.
 *
 * CORREÇÃO V4.0: createTemplate + tpl.initialData (base64) em vez de
 * createHtmlOutput + interpolação JSON direta. google.script.run agora funciona.
 */
function GFP_FATURA_MANUAL_OPEN_16_1_18_32B() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();

  if (!sh || sh.getName() !== "DB_TRANSACOES") {
    SpreadsheetApp.getUi().alert("Use este comando a partir da aba DB_TRANSACOES.");
    return;
  }

  const range = sh.getActiveRange();
  if (!range) {
    SpreadsheetApp.getUi().alert("Selecione uma linha de pagamento de fatura.");
    return;
  }

  const row = range.getRow();
  if (row <= 1) {
    SpreadsheetApp.getUi().alert("Selecione uma linha válida da DB_TRANSACOES.");
    return;
  }

  const headers = GFP_FATURA_MANUAL_MAP_DB_HEADERS_16_1_18_32B_(sh);
  const values = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];

  const dataVal = values[headers.DATA];
  const descricao = String(values[headers.DESCRICAO] || "").trim();
  const valor = Number(values[headers.VALOR] || 0);
  const conta = String(values[headers.CONTA] || "").trim();
  const tipo = String(values[headers.TIPO] || "").trim();
  const idTransacao = String(values[headers.ID_TRANSACAO] || values[headers.HASH_LINHA] || "").trim();

  if (!descricao || !valor) {
    SpreadsheetApp.getUi().alert("A linha selecionada não parece ser uma transação válida.");
    return;
  }

  const infer = GFP_FATURA_MANUAL_INFERIR_CARTAO_BANCO_16_1_18_32B_(descricao, conta);
  const competencia = GFP_FATURA_MANUAL_COMPETENCIA_FROM_DATA_16_1_18_32B_(dataVal);

  const payload = {
    row: row,
    data: GFP_FATURA_MANUAL_FORMAT_DATE_16_1_18_32B_(dataVal),
    descricao: descricao,
    valor: valor,
    valorAbs: Math.abs(valor),
    tipo: tipo,
    conta: conta,
    idTransacao: idTransacao,
    cartaoPadrao: infer.cartao,
    bancoPadrao: infer.banco,
    competenciaPadrao: competencia,
    categorias: GFP_PARC_MANUAIS_LISTAR_CATEGORIAS_16_1_18_32_()
  };

  // CORREÇÃO V4.0: createTemplate em vez de createHtmlOutput.
  // initialData é transmitido como base64 via propriedade do template,
  // depois decodificado no client-side com window.atob + JSON.parse.
  const tpl = HtmlService.createTemplate(GFP_FATURA_MANUAL_HTML_16_1_18_32B_());
  tpl.initialData = Utilities.base64Encode(
    JSON.stringify(payload),
    Utilities.Charset.UTF_8
  );

  const html = tpl.evaluate()
    .setWidth(1280)
    .setHeight(820)
    .setTitle("💳 Dividir como Fatura Manual");

  SpreadsheetApp.getUi().showModalDialog(html, "💳 Dividir como Fatura Manual");
}

/**
 * Busca parcelas previstas/pendentes na DB_PARCELAMENTOS_MANUAIS para
 * pré-preencher o modal da fatura manual.
 * Chamada via google.script.run do client-side.
 *
 * @param {Object} filters - cartao, banco, competencia
 * @returns {Array} lista de objetos de parcela no formato do modal
 */
function GFP_FATURA_MANUAL_BUSCAR_PREVISTAS_16_1_18_32B(filters) {
  filters = filters || {};

  GFP_PARC_MANUAIS_GARANTIR_ABA_16_1_18_32();

  const lista = GFP_PARC_MANUAIS_LISTAR_PREVISTAS_16_1_18_32({
    cartao: filters.cartao || "",
    banco: filters.banco || "",
    competencia: filters.competencia || "",
    status: ["PENDENTE", "PREVISTA"]
  });

  return lista.map(function(p) {
    return {
      idParcelamento: p.ID_PARCELAMENTO,
      status: p.STATUS,
      cartao: p.CARTAO,
      banco: p.BANCO,
      grupoDono: p.GRUPO_DONO,
      descricao: p.DESCRICAO,
      categoria: p.CATEGORIA,
      valorAbs: Math.abs(Number(p.VALOR_PARCELA || 0)),
      parcAtual: Number(p.PARC_ATUAL || 1),
      parcTotal: Number(p.PARC_TOTAL || 1),
      competencia: p.COMPETENCIA,
      dataPrevista: GFP_FATURA_MANUAL_FORMAT_DATE_16_1_18_32B_(p.DATA_PREVISTA),
      origem: "DB_PARCELAMENTOS_MANUAIS"
    };
  });
}

/**
 * Salva o split da fatura manual:
 * 1. Transforma linha mãe em Tipo S (histórica).
 * 2. Cria linhas filhas reais na DB_TRANSACOES.
 * 3. Marca parcelas previstas daquela competência como PAGA.
 * 4. Para itens novos parcelados, cria agenda futura em DB_PARCELAMENTOS_MANUAIS.
 *
 * @param {Object} payload - row, cartao, banco, competencia, itens[]
 * @returns {Object} { ok, splitId, children, paidParcelamentos }
 */
function GFP_FATURA_MANUAL_SAVE_SPLIT_16_1_18_32B(payload) {
  payload = payload || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) throw new Error("DB_TRANSACOES não encontrada.");

  const row = Number(payload.row || 0);
  const itens = payload.itens || [];

  if (!row || row <= 1) throw new Error("Linha mãe inválida.");
  if (!itens.length) throw new Error("Informe ao menos um item da fatura.");

  const headers = GFP_FATURA_MANUAL_MAP_DB_HEADERS_16_1_18_32B_(sh);
  const width = sh.getLastColumn();

  const parentRange = sh.getRange(row, 1, 1, width);
  const parent = parentRange.getValues()[0];

  const parentData = parent[headers.DATA];
  const parentDesc = String(parent[headers.DESCRICAO] || "").trim();
  const parentValor = Number(parent[headers.VALOR] || 0);
  const parentConta = String(parent[headers.CONTA] || "").trim();
  const parentId = String(parent[headers.ID_TRANSACAO] || parent[headers.HASH_LINHA] || ("ROW-" + row)).trim();
  const parentArquivo = String(parent[headers.ID_ARQUIVO] || "FATURA_MANUAL").trim();

  if (!parentValor) throw new Error("Valor da linha mãe inválido.");

  const soma = itens.reduce(function(acc, item) {
    return acc + Math.abs(GFP_FATURA_MANUAL_PARSE_VALOR_16_1_18_32B_(item.valorAbs));
  }, 0);

  if (Math.abs(Math.abs(parentValor) - soma) > 0.02) {
    throw new Error(
      "Soma dos itens diverge da fatura. Fatura: " +
      Math.abs(parentValor).toFixed(2) +
      " | Itens: " + soma.toFixed(2)
    );
  }

  const splitId = "FM-" + parentId + "-" + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || "America/Sao_Paulo",
    "yyyyMMddHHmmss"
  );

  const sinal = parentValor < 0 ? -1 : 1;
  const tipoFilho = sinal < 0 ? "D" : "C";

  const childRows = [];
  const idsParcelamentosPagos = [];
  const now = new Date();

  itens.forEach(function(item, idx) {
    const descricao = String(item.descricao || "").trim();
    const categoria = String(item.categoria || "").trim();
    const grupoDono = String(item.grupoDono || "").trim();
    const cartao = String(item.cartao || payload.cartao || "").trim();
    const banco = String(item.banco || payload.banco || "").trim();
    const competencia = String(item.competencia || payload.competencia || "").trim();
    const idParcelamento = String(item.idParcelamento || "").trim();

    const valorAbs = Math.abs(GFP_FATURA_MANUAL_PARSE_VALOR_16_1_18_32B_(item.valorAbs));
    const parcAtual = Number(item.parcAtual || 1);
    const parcTotal = Number(item.parcTotal || 1);

    if (!descricao) throw new Error("Item " + (idx + 1) + " sem descrição.");
    if (!categoria) throw new Error("Item " + (idx + 1) + " sem categoria.");
    if (!grupoDono) throw new Error("Item " + (idx + 1) + " sem grupo/dono.");
    if (!valorAbs) throw new Error("Item " + (idx + 1) + " sem valor.");
    if (!cartao) throw new Error("Item " + (idx + 1) + " sem cartão.");
    if (!banco) throw new Error("Item " + (idx + 1) + " sem banco.");
    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      throw new Error("Item " + (idx + 1) + " sem competência válida.");
    }

    const childId = splitId + "-I" + String(idx + 1).padStart(2, "0");

    const meta = {
      origin: "FATURA_MANUAL_SPLIT_16_1_18_32B",
      parentTransactionId: parentId,
      splitId: splitId,
      cartao: cartao,
      banco: banco,
      grupoDono: grupoDono,
      competenciaFatura: competencia,
      idParcelamentoManual: idParcelamento || "",
      parcAtual: parcAtual,
      parcTotal: parcTotal,
      parentConta: parentConta,
      parentDescricao: parentDesc,
      createdAt: now.toISOString()
    };

    const newRow = new Array(width).fill("");
    newRow[headers.DATA] = parentData;
    newRow[headers.DESCRICAO] = "[FATURA MANUAL] " + descricao;
    newRow[headers.VALOR] = valorAbs * sinal;
    newRow[headers.TIPO] = tipoFilho;
    newRow[headers.CONTA] = parentConta;
    newRow[headers.CATEGORIA] = categoria;
    newRow[headers.PARC_ATUAL] = parcAtual || "";
    newRow[headers.PARC_TOTAL] = parcTotal || "";
    newRow[headers.STATUS] = true;
    newRow[headers.NOTAS] =
      "Fatura manual confirmada | " + cartao + " | " + grupoDono + " | " + competencia +
      (parcTotal > 1 ? " | parcela " + parcAtual + "/" + parcTotal : "");
    newRow[headers.ID_TRANSACAO] = childId;
    newRow[headers.ID_ARQUIVO] = parentArquivo;
    newRow[headers.HASH_LINHA] = childId;
    newRow[headers.METADADOS] = JSON.stringify(meta);

    childRows.push(newRow);

    if (idParcelamento) {
      idsParcelamentosPagos.push(idParcelamento);
    } else if (parcTotal > parcAtual) {
      // Item novo parcelado: cria agenda futura a partir da próxima parcela
      GFP_FATURA_MANUAL_CRIAR_AGENDA_FUTURA_ITEM_16_1_18_32B_({
        cartao: cartao,
        banco: banco,
        grupoDono: grupoDono,
        descricao: descricao,
        categoria: categoria,
        valorParcela: valorAbs,
        parcAtual: parcAtual,
        parcTotal: parcTotal,
        competenciaInicial: competencia,
        idTransacaoFatura: parentId,
        idSplitRealizado: childId,
        observacoes: "Criado a partir de fatura manual/split."
      });
    }
  });

  if (!childRows.length) throw new Error("Nenhuma linha filha criada.");

  sh.insertRowsAfter(row, childRows.length);
  const childrenRange = sh.getRange(row + 1, 1, childRows.length, width);
  childrenRange.setValues(childRows);

  try {
    childrenRange.setFontStyle("italic").setFontColor("#555555").setBackground("#eef6ff");
    sh.getRange(row + 1, headers.DATA + 1, childRows.length, 1).setNumberFormat("dd/mm/yyyy");
    sh.getRange(row + 1, headers.VALOR + 1, childRows.length, 1)
      .setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");
  } catch (eFormat) {}

  // Transforma linha mãe em SPLIT histórico
  sh.getRange(row, headers.TIPO + 1).setValue("S");
  sh.getRange(row, headers.CATEGORIA + 1).clearContent();
  sh.getRange(row, headers.STATUS + 1).setValue(true);
  sh.getRange(row, headers.NOTAS + 1).setValue(
    "Fatura manual dividida | splitId=" + splitId + " | itens=" + childRows.length
  );
  sh.getRange(row, headers.DESCRICAO + 1).setValue("[FATURA MANUAL DIVIDIDA] " + parentDesc);

  try {
    sh.getRange(row, 1, 1, width).setBackground("#f3f3f3").setFontStyle("italic").setFontColor("#666666");
  } catch (eParentFmt) {}

  if (idsParcelamentosPagos.length) {
    GFP_PARC_MANUAIS_MARCAR_PAGAS_16_1_18_32(idsParcelamentosPagos, parentId, splitId);
  }

  try {
    if (typeof GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1 === "function") {
      GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1();
    }
  } catch (eVisual) {}

  try {
    if (typeof GFP_DRE_VISAO_RECONSTRUIR_16_1_5 === "function") {
      GFP_DRE_VISAO_RECONSTRUIR_16_1_5();
    }
  } catch (eDre) {}

  try {
    if (typeof GFP_LOG_HUMANO_APPEND_16_1_4_ === "function") {
      GFP_LOG_HUMANO_APPEND_16_1_4_(
        "OK",
        "Fatura Manual",
        "Fatura manual dividida | itens=" + childRows.length + " | splitId=" + splitId,
        ""
      );
    }
  } catch (eLog) {}

  ss.toast("Fatura manual dividida: " + childRows.length + " item(ns).", "GFP — Fatura Manual", 8);

  return {
    ok: true,
    splitId: splitId,
    children: childRows.length,
    paidParcelamentos: idsParcelamentosPagos.length
  };
}

/**
 * Cria agenda futura para item novo informado no split da fatura.
 * A parcela atual já foi lançada na DB_TRANSACOES; aqui registramos:
 * - atual como PAGA
 * - futuras como PREVISTA
 */
function GFP_FATURA_MANUAL_CRIAR_AGENDA_FUTURA_ITEM_16_1_18_32B_(item) {
  GFP_PARC_MANUAIS_GARANTIR_ABA_16_1_18_32();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PARC_MANUAIS_SHEET_16_1_18_32);

  const now = new Date();
  const baseId = GFP_PARC_MANUAIS_NEW_ID_16_1_18_32_(item.descricao, item.cartao, item.competenciaInicial);

  const rows = [];

  for (let p = Number(item.parcAtual || 1); p <= Number(item.parcTotal || 1); p++) {
    const offset = p - Number(item.parcAtual || 1);
    const competencia = GFP_PARC_MANUAIS_ADD_MONTHS_16_1_18_32_(item.competenciaInicial, offset);
    const dataPrevista = GFP_PARC_MANUAIS_DATE_FROM_COMPETENCIA_16_1_18_32_(competencia, 10);

    rows.push([
      baseId + "-P" + String(p).padStart(2, "0"),
      offset === 0 ? "PAGA" : "PREVISTA",
      item.cartao,
      item.banco,
      item.grupoDono,
      item.descricao,
      item.categoria,
      Number(item.valorParcela || 0),
      p,
      Number(item.parcTotal || 1),
      competencia,
      dataPrevista,
      offset === 0 ? item.idTransacaoFatura || "" : "",
      offset === 0 ? item.idSplitRealizado || "" : "",
      "FATURA_MANUAL_SPLIT_16_1_18_32B",
      item.observacoes || "",
      now,
      now
    ]);
  }

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, GFP_PARC_MANUAIS_HEADERS_16_1_18_32.length)
      .setValues(rows);
  }

  return { ok: true, created: rows.length, baseId: baseId };
}

// =============================================================================
// HELPERS INTERNOS — FATURA MANUAL (32B)
// =============================================================================

/**
 * Mapeia os cabeçalhos da DB_TRANSACOES para índices numéricos.
 * Lança erro se algum cabeçalho obrigatório estiver ausente.
 */
function GFP_FATURA_MANUAL_MAP_DB_HEADERS_16_1_18_32B_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(h, i) { map[String(h || "").trim().toUpperCase()] = i; });

  function need(name) {
    const key = String(name || "").trim().toUpperCase();
    if (!(key in map)) throw new Error("Cabeçalho obrigatório não encontrado na DB_TRANSACOES: " + name);
    return map[key];
  }

  return {
    DATA: need("DATA"),
    DESCRICAO: need("DESCRICAO"),
    VALOR: need("VALOR"),
    TIPO: need("TIPO"),
    CONTA: need("CONTA"),
    CATEGORIA: need("CATEGORIA"),
    PARC_ATUAL: need("PARC_ATUAL"),
    PARC_TOTAL: need("PARC_TOTAL"),
    STATUS: need("STATUS"),
    NOTAS: need("NOTAS"),
    ID_TRANSACAO: need("ID_TRANSACAO"),
    ID_ARQUIVO: need("ID_ARQUIVO"),
    HASH_LINHA: need("HASH_LINHA"),
    METADADOS: need("METADADOS")
  };
}

/** Infere cartão e banco pelo texto da descrição/conta. */
function GFP_FATURA_MANUAL_INFERIR_CARTAO_BANCO_16_1_18_32B_(descricao, conta) {
  const txt = (String(descricao || "") + " " + String(conta || "")).toUpperCase();
  if (txt.includes("BRADESCO")) return { banco: "Bradesco", cartao: "Bradesco André" };
  if (txt.includes("SANTANDER")) return { banco: "Santander", cartao: "Santander André" };
  if (txt.includes("NUBANK") || txt.includes("NU ")) return { banco: "Nubank", cartao: "Nubank André" };
  if (txt.includes("INTER")) return { banco: "Inter", cartao: "Inter André" };
  if (txt.includes("XP")) return { banco: "XP", cartao: "XP André" };
  if (txt.includes("PICPAY")) return { banco: "PicPay", cartao: "PicPay André (Cartão)" };
  return { banco: "", cartao: "" };
}

/** Retorna a competência AAAA-MM de uma data. */
function GFP_FATURA_MANUAL_COMPETENCIA_FROM_DATA_16_1_18_32B_(value) {
  let d = value;
  if (!(d instanceof Date)) d = new Date(value);
  if (!d || isNaN(d.getTime())) d = new Date();
  return Utilities.formatDate(d, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM");
}

/** Formata uma data como dd/MM/yyyy. */
function GFP_FATURA_MANUAL_FORMAT_DATE_16_1_18_32B_(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy");
  }
  return String(value);
}

/** Converte string ou número para valor absoluto. */
function GFP_FATURA_MANUAL_PARSE_VALOR_16_1_18_32B_(value) {
  if (typeof value === "number") return Math.abs(value);
  const txt = String(value || "")
    .replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  const n = Number(txt);
  return isNaN(n) ? 0 : Math.abs(n);
}

/**
 * Retorna o HTML do modal "Dividir como Fatura Manual".
 *
 * CORREÇÃO V4.0: O payload NÃO é mais interpolado diretamente no HTML.
 * Em vez disso, usa o scriptlet <?= initialData ?> do createTemplate
 * para injetar o base64 codificado no servidor. O client-side decodifica
 * com window.atob + JSON.parse. Isso garante que google.script.run
 * funcione corretamente no contexto do modal do Apps Script.
 */
function GFP_FATURA_MANUAL_HTML_16_1_18_32B_() {
  return `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f7f8fa; color: #1f2937; }
    .wrap { padding: 18px 22px; }
    h2 { margin: 0 0 6px 0; color: #0f3761; }
    .sub { font-size: 12px; color: #64748b; margin-bottom: 14px; }
    .top { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px; margin-bottom: 14px; }
    .field label { display: block; font-size: 11px; color: #334155; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .field input, .field select { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #fff; }
    .original { background: #eef6ff; border: 1px solid #cfe5ff; border-radius: 10px; padding: 10px; margin-bottom: 14px; font-size: 13px; }
    .toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
    button { cursor: pointer; border: none; border-radius: 7px; padding: 9px 12px; font-weight: bold; }
    .btn-blue { background:#0d6efd; color:#fff; }
    .btn-gray { background:#e2e8f0; color:#0f172a; }
    .btn-green { background:#198754; color:#fff; width:100%; padding:13px; margin-top:12px; }
    .btn-red { background:#fee2e2; color:#b91c1c; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 12px; }
    th { background: #0f3761; color: #fff; text-align: left; padding: 7px; position: sticky; top: 0; z-index: 1; }
    td { border-bottom: 1px solid #e5e7eb; padding: 5px; vertical-align: middle; }
    td input, td select { width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #cbd5e1; border-radius: 5px; font-size: 12px; }
    .tablebox { max-height: 430px; overflow: auto; border-radius: 10px; }
    .summary { display: flex; justify-content: flex-end; gap: 22px; margin-top: 12px; font-size: 15px; font-weight: bold; }
    .ok { color:#198754; }
    .bad { color:#dc3545; }
    .small { font-size:11px; color:#64748b; }
  </style>
</head>
<body>
<div class="wrap">
  <h2>💳 Dividir como Fatura Manual</h2>
  <div class="sub">Realizado na DB_TRANSACOES + futuro na DB_PARCELAMENTOS_MANUAIS.</div>

  <div class="original">
    <b>Linha selecionada:</b> <span id="origDesc"></span><br>
    <b>Data:</b> <span id="origData"></span> |
    <b>Conta:</b> <span id="origConta"></span> |
    <b>Total:</b> R$ <span id="origValor"></span>
  </div>

  <div class="top">
    <div class="field"><label>Cartão</label><input id="cartao" list="listaCartoes"></div>
    <div class="field"><label>Banco</label><input id="banco" list="listaBancos"></div>
    <div class="field"><label>Competência da fatura</label><input id="competencia"></div>
  </div>

  <div class="toolbar">
    <button class="btn-blue" id="btnBuscar" onclick="buscarPrevistas()">Buscar parcelas previstas</button>
    <button class="btn-gray" onclick="addRow(null)">+ Adicionar item novo</button>
  </div>

  <div class="tablebox">
    <table>
      <thead>
        <tr>
          <th style="width:4%">Usar</th>
          <th style="width:13%">Grupo</th>
          <th style="width:23%">Descrição</th>
          <th style="width:24%">Categoria</th>
          <th style="width:9%">Valor</th>
          <th style="width:6%">Parc.</th>
          <th style="width:6%">Total</th>
          <th style="width:9%">Origem</th>
          <th style="width:6%"></th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>

  <div class="summary">
    <div>Fatura: R$ <span id="sumOriginal">0,00</span></div>
    <div>Itens: R$ <span id="sumItens">0,00</span></div>
    <div id="sumDiff" class="bad">Diferença: R$ 0,00</div>
  </div>

  <button class="btn-green" id="btnSave" onclick="salvar()">CONFIRMAR FATURA MANUAL</button>

  <datalist id="listaCategorias"></datalist>
  <datalist id="listaCartoes">
    <option value="Bradesco André"></option>
    <option value="Santander André"></option>
    <option value="XP André"></option>
    <option value="Inter André"></option>
    <option value="Nubank André"></option>
    <option value="PicPay André (Cartão)"></option>
    <option value="PicPay Yan (Cartão)"></option>
  </datalist>
  <datalist id="listaBancos">
    <option value="Bradesco"></option>
    <option value="Santander"></option>
    <option value="XP"></option>
    <option value="Inter"></option>
    <option value="Nubank"></option>
    <option value="PicPay"></option>
  </datalist>
</div>

<script>
  // CORREÇÃO V4.0: INITIAL é decodificado do base64 injetado pelo createTemplate.
  // Isso garante que google.script.run funcione (createHtmlOutput não disponibiliza o objeto).
  const INITIAL = (function() {
    try {
      const raw = window.atob("<?= initialData ?>");
      const decoded = decodeURIComponent(escape(raw));
      return JSON.parse(decoded);
    } catch(e) {
      return {};
    }
  })();

  function money(n) {
    return Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  function parseMoney(v) {
    if (typeof v === "number") return Math.abs(v);
    v = String(v||"").replace(/\\s/g,"").replace("R$","").replace(/\\./g,"").replace(",",".");
    const n = Number(v);
    return isNaN(n) ? 0 : Math.abs(n);
  }

  window.onload = function() {
    document.getElementById("origDesc").innerText   = INITIAL.descricao || "";
    document.getElementById("origData").innerText   = INITIAL.data || "";
    document.getElementById("origConta").innerText  = INITIAL.conta || "";
    document.getElementById("origValor").innerText  = money(INITIAL.valorAbs || 0);
    document.getElementById("sumOriginal").innerText = money(INITIAL.valorAbs || 0);
    document.getElementById("cartao").value         = INITIAL.cartaoPadrao || "";
    document.getElementById("banco").value          = INITIAL.bancoPadrao || "";
    document.getElementById("competencia").value    = INITIAL.competenciaPadrao || "";

    const dl = document.getElementById("listaCategorias");
    dl.innerHTML = "";
    (INITIAL.categorias || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      dl.appendChild(opt);
    });

    document.getElementById("tbody").innerHTML = "";

    // Se inferiu cartão automaticamente, já busca as previstas ao abrir
    if (INITIAL.cartaoPadrao) {
      buscarPrevistas();
    } else {
      addRow(null);
      updateTotals();
    }
  };

  function addRow(item) {
    item = item || {};
    const tr = document.createElement("tr");
    tr.dataset.idParcelamento = item.idParcelamento || "";
    tr.dataset.competenciaParcela = item.competencia || "";

    tr.innerHTML = \`
      <td><input type="checkbox" class="usar" checked onchange="updateTotals()"></td>
      <td>
        <select class="grupo">
          <option value="Pessoal André">Pessoal André</option>
          <option value="Pessoal Yan">Pessoal Yan</option>
          <option value="FERMONT">FERMONT</option>
          <option value="AME">AME</option>
          <option value="Outro">Outro</option>
        </select>
      </td>
      <td><input class="desc" placeholder="Descrição"></td>
      <td><input class="cat" list="listaCategorias" placeholder="Categoria"></td>
      <td><input class="valor" placeholder="0,00" oninput="updateTotals()"></td>
      <td><input class="parcAtual" type="number" min="1" value="1"></td>
      <td><input class="parcTotal" type="number" min="1" value="1"></td>
      <td><span class="origem small"></span></td>
      <td><button class="btn-red" onclick="this.closest('tr').remove();updateTotals();">✕</button></td>
    \`;

    document.getElementById("tbody").appendChild(tr);
    tr.querySelector(".grupo").value   = item.grupoDono || "Pessoal André";
    tr.querySelector(".desc").value    = item.descricao || "";
    tr.querySelector(".cat").value     = item.categoria || "";
    tr.querySelector(".valor").value   = item.valorAbs ? money(item.valorAbs) : "";
    tr.querySelector(".parcAtual").value = item.parcAtual || 1;
    tr.querySelector(".parcTotal").value = item.parcTotal || 1;
    tr.querySelector(".origem").innerText = item.origem
      ? ("Prevista " + (item.competencia || ""))
      : "Novo";

    updateTotals();
  }

  function buscarPrevistas() {
    const btn = document.getElementById("btnBuscar");
    const oldText = btn ? btn.innerText : "Buscar parcelas previstas";

    const filters = {
      cartao: document.getElementById("cartao").value,
      banco: document.getElementById("banco").value,
      competencia: document.getElementById("competencia").value
    };

    if (btn) { btn.disabled = true; btn.innerText = "Buscando..."; }

    google.script.run
      .withSuccessHandler(function(lista) {
        lista = lista || [];

        if (lista.length) {
          renderParcelas(lista);
          if (btn) { btn.disabled = false; btn.innerText = oldText; }
          return;
        }

        // Fallback: busca sem filtro de competência para mostrar outras previstas do cartão
        const fallback = { cartao: filters.cartao, banco: filters.banco, competencia: "" };

        google.script.run
          .withSuccessHandler(function(listaFallback) {
            listaFallback = listaFallback || [];

            if (listaFallback.length) {
              renderParcelas(listaFallback);
              alert(
                "Nenhuma parcela para a competência " + (filters.competencia || "informada") + ".\n\n" +
                "Mostrando " + listaFallback.length + " parcela(s) deste cartão em outras competências.\n\n" +
                "Confira antes de confirmar."
              );
            } else {
              document.getElementById("tbody").innerHTML = "";
              addRow(null);
              alert(
                "Nenhuma parcela prevista encontrada para:\n\n" +
                "Cartão: " + (filters.cartao || "-") + "\n" +
                "Banco: " + (filters.banco || "-") + "\n" +
                "Competência: " + (filters.competencia || "-") + "\n\n" +
                "Adicione os itens manualmente."
              );
            }

            if (btn) { btn.disabled = false; btn.innerText = oldText; }
            updateTotals();
          })
          .withFailureHandler(function(err) {
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
            alert(err && err.message ? err.message : String(err));
          })
          .GFP_FATURA_MANUAL_BUSCAR_PREVISTAS_16_1_18_32B(fallback);
      })
      .withFailureHandler(function(err) {
        if (btn) { btn.disabled = false; btn.innerText = oldText; }
        alert(err && err.message ? err.message : String(err));
      })
      .GFP_FATURA_MANUAL_BUSCAR_PREVISTAS_16_1_18_32B(filters);
  }

  function renderParcelas(lista) {
    document.getElementById("tbody").innerHTML = "";
    (lista || []).forEach(addRow);
    if (!lista || !lista.length) addRow(null);
    updateTotals();
  }

  function updateTotals() {
    let soma = 0;
    document.querySelectorAll("#tbody tr").forEach(tr => {
      if (!tr.querySelector(".usar").checked) return;
      soma += parseMoney(tr.querySelector(".valor").value);
    });

    const original = Number(INITIAL.valorAbs || 0);
    const diff = original - soma;
    document.getElementById("sumItens").innerText = money(soma);

    const el = document.getElementById("sumDiff");
    if (Math.abs(diff) <= 0.02) {
      el.className = "ok"; el.innerText = "OK ✔";
    } else {
      el.className = "bad"; el.innerText = "Diferença: R$ " + money(Math.abs(diff));
    }
  }

  function salvar() {
    const itens = [];

    document.querySelectorAll("#tbody tr").forEach(tr => {
      if (!tr.querySelector(".usar").checked) return;
      itens.push({
        idParcelamento: tr.dataset.idParcelamento || "",
        cartao: document.getElementById("cartao").value,
        banco: document.getElementById("banco").value,
        competencia: tr.dataset.competenciaParcela || document.getElementById("competencia").value,
        grupoDono: tr.querySelector(".grupo").value,
        descricao: tr.querySelector(".desc").value,
        categoria: tr.querySelector(".cat").value,
        valorAbs: tr.querySelector(".valor").value,
        parcAtual: tr.querySelector(".parcAtual").value,
        parcTotal: tr.querySelector(".parcTotal").value
      });
    });

    const soma = itens.reduce((acc, i) => acc + parseMoney(i.valorAbs), 0);
    const original = Number(INITIAL.valorAbs || 0);

    if (Math.abs(original - soma) > 0.02) {
      alert("A soma dos itens ainda não bate com a fatura.");
      return;
    }

    if (!itens.length) { alert("Informe ao menos um item."); return; }

    const btn = document.getElementById("btnSave");
    btn.disabled = true; btn.innerText = "Salvando...";

    google.script.run
      .withSuccessHandler(function(res) { google.script.host.close(); })
      .withFailureHandler(function(err) {
        alert(err && err.message ? err.message : String(err));
        btn.disabled = false; btn.innerText = "CONFIRMAR FATURA MANUAL";
      })
      .GFP_FATURA_MANUAL_SAVE_SPLIT_16_1_18_32B({
        row: INITIAL.row,
        cartao: document.getElementById("cartao").value,
        banco: document.getElementById("banco").value,
        competencia: document.getElementById("competencia").value,
        itens: itens
      });
  }
</script>
</body>
</html>`;
}

// =============================================================================
// BLOCO 3 — PATCH 32C: INTEGRAÇÃO COM DASHBOARD V2
// =============================================================================
// Objetivo:
// - Expor os parcelamentos da DB_PARCELAMENTOS_MANUAIS no mesmo formato
//   que GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_ do backend_dashboard_v2.gs.
// - O Dashboard V2 chama GFP_DASH_V2_BUILD_PARCELAMENTOS_MERGE_32C() em vez
//   de GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_() diretamente.
// - O merge soma as duas fontes: PicPay importado + cartões legados manuais.
// - NÃO mexe no backend_dashboard_v2.gs — a integração é via chamada desta função.
//
// COMO INTEGRAR NO backend_dashboard_v2.gs (ÚNICA ALTERAÇÃO NECESSÁRIA):
// Localizar:
//   result.parcelamentos = GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_(allParsed, { ... });
// Substituir por:
//   result.parcelamentos = GFP_DASH_V2_BUILD_PARCELAMENTOS_MERGE_32C(allParsed, { ... });
// =============================================================================

/**
 * PATCH 32C — Merge de parcelamentos PicPay + Manuais para o Dashboard V2.
 *
 * Chame esta função em backend_dashboard_v2.gs, substituindo a chamada a
 * GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_(allParsed, opts) por:
 *   GFP_DASH_V2_BUILD_PARCELAMENTOS_MERGE_32C(allParsed, opts)
 *
 * @param {Array} allParsed - transações já parseadas (fonte PicPay/importado)
 * @param {Object} opts - year, month, accountFilter (mesmo formato do original)
 * @returns {Object} resultado no mesmo formato de GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_
 */
function GFP_DASH_V2_BUILD_PARCELAMENTOS_MERGE_32C(allParsed, opts) {
  opts = opts || {};

  // 1. Resultado base com os parcelamentos importados (PicPay etc.)
  let base = { ok: false, installments: [], series: [], cards: [], endings: [],
               kpis: { totalFuture: 0, nextMonthTotal: 0, totalInstallments: 0,
                       activePlans: 0, biggestCard: "—", biggestCardValue: 0,
                       reliefMonth: "—", reliefValue: 0 },
               empty: true };

  try {
    if (typeof GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_ === "function") {
      base = GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_(allParsed, opts);
    }
  } catch (eBase) {
    try {
      if (typeof GFP_LOG_HUMANO_APPEND_16_1_4_ === "function") {
        GFP_LOG_HUMANO_APPEND_16_1_4_("WARN", "Dashboard32C",
          "Erro ao chamar GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_: " + eBase.message, "");
      }
    } catch(eLog) {}
  }

  // 2. Parcelamentos manuais da DB_PARCELAMENTOS_MANUAIS
  let manuais = { installments: [], series: [], cards: [], endings: [],
                  kpis: { totalFuture: 0, nextMonthTotal: 0, totalInstallments: 0,
                          activePlans: 0, biggestCard: "—", biggestCardValue: 0 } };

  try {
    manuais = GFP_DASH_V2_PARC_MANUAIS_BUILD_32C_(opts);
  } catch (eManuais) {
    try {
      if (typeof GFP_LOG_HUMANO_APPEND_16_1_4_ === "function") {
        GFP_LOG_HUMANO_APPEND_16_1_4_("WARN", "Dashboard32C",
          "Erro ao construir parcelamentos manuais: " + eManuais.message, "");
      }
    } catch(eLog) {}
  }

  // 3. Merge: combina as duas fontes
  const merged = GFP_DASH_V2_PARC_MERGE_RESULTS_32C_(base, manuais, opts);

  return merged;
}

/**
 * Constrói os dados de parcelamentos a partir da DB_PARCELAMENTOS_MANUAIS,
 * no mesmo formato esperado pelo Dashboard V2.
 *
 * @param {Object} opts - year, month, accountFilter
 * @returns {Object} resultado no formato do Dashboard V2
 */
function GFP_DASH_V2_PARC_MANUAIS_BUILD_32C_(opts) {
  opts = opts || {};

  const year  = Number(opts.year  || new Date().getFullYear());
  const month = Number(opts.month || (new Date().getMonth() + 1));
  const startMonth = year + "-" + String(month).padStart(2, "0");
  const startDate  = new Date(year, month - 1, 1);
  const tz = Session.getScriptTimeZone() || "America/Sao_Paulo";

  // Busca todas as parcelas PREVISTAS e PENDENTES
  let todas = [];
  try {
    todas = GFP_PARC_MANUAIS_LISTAR_PREVISTAS_16_1_18_32({ status: ["PENDENTE", "PREVISTA"] });
  } catch (eList) {
    return { installments: [], series: [], cards: [], endings: [],
             kpis: { totalFuture: 0, nextMonthTotal: 0, totalInstallments: 0,
                     activePlans: 0, biggestCard: "—", biggestCardValue: 0 } };
  }

  // Agrupa por parcelamento base (mesmo GRUPO_DONO+DESCRICAO+CARTAO+PARC_TOTAL)
  // para construir a visão de "encerramento"
  const grupos = {};
  const monthMap = {};
  const cardMap  = {};
  let totalFuture = 0;
  let totalInstallments = 0;
  const installments = [];

  todas.forEach(function(p) {
    const competencia = String(p.COMPETENCIA || "");
    if (!competencia || competencia < startMonth) return; // ignora passado

    const valorAbs = Math.abs(Number(p.VALOR_PARCELA || 0));
    if (!valorAbs) return;

    const parcAtual = Number(p.PARC_ATUAL || 1);
    const parcTotal = Number(p.PARC_TOTAL || 1);
    const cartao    = String(p.CARTAO || "Sem cartão");
    const descricao = String(p.DESCRICAO || "");
    const categoria = String(p.CATEGORIA || "");
    const grupoDono = String(p.GRUPO_DONO || "");

    // Data prevista para ordenação
    let dataPrevista = p.DATA_PREVISTA;
    if (!(dataPrevista instanceof Date) || isNaN(dataPrevista)) {
      const m = competencia.match(/^(\d{4})-(\d{2})$/);
      dataPrevista = m
        ? new Date(Number(m[1]), Number(m[2]) - 1, 10)
        : startDate;
    }

    const dueKey   = Utilities.formatDate(dataPrevista, tz, "yyyy-MM-dd");
    const dueLabelBr = Utilities.formatDate(dataPrevista, tz, "dd/MM/yyyy");
    const monthsLeft = (dataPrevista.getFullYear() - startDate.getFullYear()) * 12
                     + (dataPrevista.getMonth() - startDate.getMonth());

    // Acumula totais
    if (!monthMap[competencia]) monthMap[competencia] = 0;
    monthMap[competencia] += valorAbs;

    if (!cardMap[cartao]) cardMap[cartao] = 0;
    cardMap[cartao] += valorAbs;

    totalFuture += valorAbs;
    totalInstallments++;

    installments.push({
      dueKey: dueKey,
      dueLabel: dueLabelBr,
      monthKey: competencia,
      monthLabel: competencia,  // será formatado pelo Dashboard
      description: descricao,
      installmentLabel: parcAtual + "/" + parcTotal,
      value: -valorAbs,         // despesa = negativo
      valueAbs: valorAbs,
      account: cartao,
      category: categoria,
      grupoDono: grupoDono,
      monthsLeft: monthsLeft,
      origem: "MANUAL",
      idParcelamento: String(p.ID_PARCELAMENTO || "")
    });

    // Agrupa para endings
    const gKey = [descricao.toUpperCase(), cartao.toUpperCase(), categoria.toUpperCase(),
                  String(parcTotal)].join("|");

    if (!grupos[gKey] || parcAtual > grupos[gKey].parcAtual) {
      grupos[gKey] = {
        descricao: descricao,
        cartao: cartao,
        categoria: categoria,
        valorAbs: valorAbs,
        parcAtual: parcAtual,
        parcTotal: parcTotal,
        grupoDono: grupoDono,
        competencia: competencia,
        dataPrevista: dataPrevista
      };
    }
  });

  // Série mensal (próximos 18 meses)
  const series = Object.keys(monthMap).sort().slice(0, 18).map(function(m) {
    return { monthKey: m, label: m, fullLabel: m, value: monthMap[m] || 0 };
  });

  // Cards
  const cards = Object.keys(cardMap)
    .map(function(c) { return { label: c, value: cardMap[c] }; })
    .sort(function(a, b) { return b.value - a.value; });

  // Endings: parcelamentos que estão encerrando
  const endings = Object.keys(grupos).map(function(k) {
    const g = grupos[k];
    const remaining = g.parcTotal - g.parcAtual;
    return {
      description: g.descricao,
      account: g.cartao,
      category: g.categoria,
      monthlyValue: -g.valorAbs,
      monthlyAbs: g.valorAbs,
      remaining: remaining,
      current: g.parcAtual,
      total: g.parcTotal,
      finalMonth: g.competencia,
      finalMonthLabel: g.competencia,
      finalDateLabel: Utilities.formatDate(g.dataPrevista, tz, "dd/MM/yyyy"),
      grupoDono: g.grupoDono,
      origem: "MANUAL"
    };
  }).sort(function(a, b) {
    if (a.finalMonth !== b.finalMonth) return a.finalMonth < b.finalMonth ? -1 : 1;
    return b.monthlyAbs - a.monthlyAbs;
  });

  installments.sort(function(a, b) {
    if (a.monthKey !== b.monthKey) return a.monthKey < b.monthKey ? -1 : 1;
    return b.valueAbs - a.valueAbs;
  });

  const nextMonthTotal = monthMap[startMonth] || 0;
  const biggestCard    = cards.length ? cards[0] : { label: "—", value: 0 };

  return {
    ok: true,
    installments: installments,
    series: series,
    cards: cards,
    endings: endings,
    kpis: {
      totalFuture: totalFuture,
      nextMonthTotal: nextMonthTotal,
      totalInstallments: totalInstallments,
      activePlans: endings.length,
      biggestCard: biggestCard.label,
      biggestCardValue: biggestCard.value
    }
  };
}

/**
 * Faz o merge dos resultados de parcelamentos importados com os manuais.
 * Combina installments, series, cards, endings e recalcula KPIs.
 *
 * @param {Object} base    - resultado de GFP_DASH_V2_BUILD_PARCELAMENTOS_16_1_6_
 * @param {Object} manuais - resultado de GFP_DASH_V2_PARC_MANUAIS_BUILD_32C_
 * @param {Object} opts    - year, month
 * @returns {Object} resultado merged no formato do Dashboard V2
 */
function GFP_DASH_V2_PARC_MERGE_RESULTS_32C_(base, manuais, opts) {
  opts = opts || {};

  const year  = Number(opts.year  || new Date().getFullYear());
  const month = Number(opts.month || (new Date().getMonth() + 1));
  const startMonth = year + "-" + String(month).padStart(2, "0");

  // Combina installments
  const allInstallments = (base.installments || []).concat(manuais.installments || []);
  allInstallments.sort(function(a, b) {
    if (a.monthKey !== b.monthKey) return a.monthKey < b.monthKey ? -1 : 1;
    return b.valueAbs - a.valueAbs;
  });

  // Combina endings
  const allEndings = (base.endings || []).concat(manuais.endings || []);
  allEndings.sort(function(a, b) {
    if (a.finalMonth !== b.finalMonth) return a.finalMonth < b.finalMonth ? -1 : 1;
    return b.monthlyAbs - a.monthlyAbs;
  });

  // Merge de séries mensais (soma por mês)
  const seriesMap = {};
  (base.series || []).forEach(function(s) { seriesMap[s.monthKey] = (seriesMap[s.monthKey] || 0) + (s.value || 0); });
  (manuais.series || []).forEach(function(s) { seriesMap[s.monthKey] = (seriesMap[s.monthKey] || 0) + (s.value || 0); });

  const allSeries = Object.keys(seriesMap).sort().slice(0, 18).map(function(m) {
    return {
      monthKey: m,
      label: m,
      fullLabel: m,
      value: seriesMap[m] || 0
    };
  });

  // Merge de cards
  const cardMap = {};
  (base.cards || []).forEach(function(c) { cardMap[c.label] = (cardMap[c.label] || 0) + (c.value || 0); });
  (manuais.cards || []).forEach(function(c) { cardMap[c.label] = (cardMap[c.label] || 0) + (c.value || 0); });

  const allCards = Object.keys(cardMap)
    .map(function(label) { return { label: label, value: cardMap[label] }; })
    .sort(function(a, b) { return b.value - a.value; });

  // KPIs combinados
  const baseKpis    = base.kpis    || {};
  const manuaisKpis = manuais.kpis || {};

  const totalFuture      = (baseKpis.totalFuture      || 0) + (manuaisKpis.totalFuture      || 0);
  const nextMonthTotal   = (baseKpis.nextMonthTotal   || 0) + (manuaisKpis.nextMonthTotal   || 0);
  const totalInstallments= (baseKpis.totalInstallments|| 0) + (manuaisKpis.totalInstallments|| 0);
  const activePlans      = (baseKpis.activePlans      || 0) + (manuaisKpis.activePlans      || 0);

  const biggestCard = allCards.length ? allCards[0] : { label: "—", value: 0 };

  // Relief recalculado sobre série merged (maior queda mês a mês)
  let relief = { monthLabel: "—", value: 0 };
  for (let i = 1; i < allSeries.length; i++) {
    const drop = (allSeries[i-1].value || 0) - (allSeries[i].value || 0);
    if (drop > relief.value) {
      relief = { monthLabel: allSeries[i].fullLabel || allSeries[i].monthKey, value: drop };
    }
  }

  const empty = totalInstallments === 0;

  return {
    ok: true,
    version: "32C-merge",
    startMonth: startMonth,
    startMonthLabel: startMonth,
    kpis: {
      totalFuture: totalFuture,
      nextMonthTotal: nextMonthTotal,
      totalInstallments: totalInstallments,
      activePlans: activePlans,
      biggestCard: biggestCard.label,
      biggestCardValue: biggestCard.value,
      reliefMonth: relief.monthLabel,
      reliefValue: relief.value
    },
    series: allSeries,
    cards: allCards,
    endings: allEndings.slice(0, 40),
    installments: allInstallments.slice(0, 180),
    empty: empty,
    _sources: {
      picpay: {
        installments: (base.installments || []).length,
        totalFuture: baseKpis.totalFuture || 0
      },
      manuais: {
        installments: (manuais.installments || []).length,
        totalFuture: manuaisKpis.totalFuture || 0
      }
    }
  };
}