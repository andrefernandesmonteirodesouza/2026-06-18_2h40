/**
 * 📂 ARQUIVO: 4_APP/pro_split.gs
 * ✂️ MÓDULO: DIVISOR DE TRANSAÇÕES (ENTERPRISE LOGIC & AUDIT)
 * 🔢 VERSÃO: 3.2 (DIAMOND HEADERS & PARENT-CHILD ARCHITECTURE)
 * 📅 DATA: 18/12/2025
 * 👤 AUTOR: André Fernandes (Sócio) & Gemini (Arquiteto)
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * Ferramenta avançada para dividir uma transação financeira em múltiplas partes
 * (Split), mantendo a integridade contábil e o rastro de auditoria.
 *
 * 🔄 HISTÓRICO COMPLETO DE VERSÕES:
 * - V1.0 (Enterprise Legacy): Versão antiga, incompatível com GFP 1.0.
 * - V2.0 (Migration): Primeira adaptação. Lógica destrutiva (apagava a linha original).
 * [RISCO]: Perda de histórico da transação bancária original.
 * - V3.0 (Enterprise Standard): Introdução da lógica "Shadow/Split".
 * A linha original é mantida como "S" (Shadow/Inativa) e formatada em cinza.
 * As linhas filhas herdam o ID com sufixo (-1, -2).
 * - V3.1 (Notes Compat): Adaptação para estrutura de 14 colunas.
 * [ERRO]: Falta do cabeçalho padrão Diamante.
 * - V3.2 (ATUAL - DIAMOND RESTORE):
 * > CORREÇÃO: Cabeçalho completo restaurado.
 * > AJUSTE FINO: A lógica de preservação de NOTAS foi refinada. As notas da
 * linha original são clonadas para as linhas filhas (assumindo que o contexto
 * se mantém), mas podem ser editadas depois.
 * > RASTREABILIDADE: O ID original (Coluna K) é usado como raiz para gerar os
 * IDs das filhas, garantindo árvore genealógica perfeita.
 * -----------------------------------------------------------------------------
 */

// =================================================================
// 🖥️ BACK-END (ABRE O MODAL)
// =================================================================

function PRO_SPLIT_openModal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const cell = sheet.getActiveCell();
  const row = cell.getRow();

  // Validação de Segurança: Só roda na DB_TRANSACOES e fora do cabeçalho
  if (sheet.getName() !== "DB_TRANSACOES" || row < 2) {
    SpreadsheetApp.getUi().alert("⚠️ Selecione uma transação na aba DB_TRANSACOES para dividir.");
    return;
  }

  // Captura dados da linha (Colunas A a N = 14 colunas)
  const range = sheet.getRange(row, 1, 1, 14);
  const values = range.getValues()[0];

  // Validação de Integridade: Não permite dividir uma linha que já é origem (Tipo S)
  if (values[3] === 'S') {
    SpreadsheetApp.getUi().alert("⚠️ Esta linha já é uma origem de divisão (Tipo S). Edite as linhas filhas.");
    return;
  }

  const transactionData = {
    row: row,
    date: values[0] instanceof Date ? Utilities.formatDate(values[0], Session.getScriptTimeZone(), "yyyy-MM-dd") : values[0],
    desc: values[1],
    amount: Math.abs(values[2]), // Trabalha sempre com positivo no modal
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

// =================================================================
// ⚙️ BACK-END (PROCESSA O SPLIT COM LÓGICA "S")
// =================================================================

function PRO_SPLIT_process(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DB_TRANSACOES");
  
  const rowIdx = parseInt(form.originalRow);
  // Pega a linha inteira (14 colunas) para clonar
  const originalRowRange = sheet.getRange(rowIdx, 1, 1, 14);
  const originalData = originalRowRange.getValues()[0];
  
  const newRows = [];
  const parts = JSON.parse(form.splitData);
  const isDebit = originalData[3] === 'D' || (typeof originalData[2] === 'number' && originalData[2] < 0);
  
  // ID_TRANSACAO Original (Coluna K / Índice 10)
  const parentID = originalData[10]; 

  // 1. CRIAÇÃO DAS LINHAS FILHAS
  parts.forEach((part, index) => {
    const newRow = [...originalData]; // Clona array da linha mãe
    
    // Atualizações da Filha
    newRow[1] = part.desc; // Nova Descrição
    
    // Valor com sinal correto (Preserva D/C)
    let val = parseFloat(part.val);
    if (isDebit) val = -Math.abs(val); 
    else val = Math.abs(val);
    
    newRow[2] = val; // Novo Valor
    newRow[3] = isDebit ? 'D' : 'C'; // Garante tipo correto
    newRow[5] = part.cat; // Nova Categoria
    
    newRow[8] = "OK"; // STATUS (Coluna I) - Já nasce validado
    
    // NOTAS (Coluna J / Index 9): Mantemos a nota original nas filhas?
    // Sim, clonamos. Se o usuário quiser mudar, ele edita depois.
    // newRow[9] = originalData[9]; 
    
    // RASTREABILIDADE (O PULO DO GATO 🐱)
    // ID da Filha = ID do Pai + Sufixo sequencial (Ex: 123-1, 123-2)
    newRow[10] = parentID + "-" + (index + 1); 
    
    // Limpa metadados técnicos para evitar conflito de hash
    newRow[12] = ""; // Hash Linha
    
    newRows.push(newRow);
  });

  // 2. ATUALIZAÇÃO DA LINHA MÃE (TRANSFORMA EM "S"HADOW)
  // Não deletamos! Apenas aposentamos visualmente e logicamente.
  
  sheet.getRange(rowIdx, 2).setValue(`[DIVIDIDO] — ${originalData[1]}`); // Descrição
  sheet.getRange(rowIdx, 4).setValue("S"); // Tipo S (Split)
  sheet.getRange(rowIdx, 6).setValue(""); // Limpa Categoria
  sheet.getRange(rowIdx, 9).setValue("SPLIT"); // Status

  // FORMATAÇÃO VISUAL DA MÃE (Cinza "Fantasma")
  originalRowRange.setBackground("#f3f3f3").setFontColor("#999999").setFontStyle("italic");

  // 3. INSERÇÃO DAS FILHAS
  // Insere logo ABAIXO da mãe para manter contexto visual cronológico
  sheet.insertRowsAfter(rowIdx, newRows.length);
  const newRange = sheet.getRange(rowIdx + 1, 1, newRows.length, 14);
  newRange.setValues(newRows);
  
  // Formata as filhas (Reseta estilos herdados da mãe, se houver)
  newRange.setBackground(null).setFontColor(null).setFontStyle(null); 
  newRange.setBorder(true, true, true, true, true, true, "#D3D3D3", SpreadsheetApp.BorderStyle.SOLID);
  
  // Aplica Dropdown na coluna F das novas linhas (Se houver regra na mãe)
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

// =================================================================
// 🎨 FRONT-END (HTML EMBUTIDO)
// =================================================================

function getSplitHtml() {
  return `<!DOCTYPE html><html><head><base target="_top"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{font-family:sans-serif;padding:20px;background:#f8f9fa}.split-row{background:#fff;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;display:flex;gap:10px;align-items:center}.total-box{font-size:1.2rem;font-weight:bold;text-align:right;margin-top:20px}.match{color:#198754}.mismatch{color:#dc3545}.btn-remove{color:#dc3545;cursor:pointer;font-weight:bold;padding:0 10px}.info-box{background:#e2e3e5;padding:10px;border-radius:8px;margin-bottom:20px;font-size:0.9rem;color:#383d41}</style></head><body><div class="mb-3"><label class="form-label text-muted small">LANÇAMENTO ORIGINAL</label><div class="fw-bold"><?= data.desc ?></div><div class="fs-4"><?= parseFloat(data.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) ?></div></div><div class="info-box"><i class="bi bi-info-circle"></i> O item original será mantido como histórico (Tipo 'S') e novos itens serão criados abaixo dele.</div><hr><div id="split-container"></div><div class="d-grid gap-2 mb-3"><button class="btn btn-outline-primary btn-sm" onclick="addRow()">+ Adicionar Parte</button></div><div class="total-box">Total: <span id="current-total">R$ 0,00</span><div id="diff-msg" style="font-size:0.8rem">Falta: R$ 0,00</div></div><div class="d-grid gap-2 mt-4"><button id="btn-save" class="btn btn-success" disabled onclick="saveSplit()">CONFIRMAR DIVISÃO</button></div><datalist id="list-cats"></datalist><script>const ORIGINAL_AMOUNT=<?= data.amount ?>;const ORIGINAL_DESC="<?= data.desc ?>";const ORIGINAL_CAT="<?= data.originalCat ?>";const ROW_ID=<?= data.row ?>;window.onload=function(){google.script.run.withSuccessHandler(function(cats){const dl=document.getElementById('list-cats');cats.forEach(c=>{const opt=document.createElement('option');opt.value=c;dl.appendChild(opt)});addRow("[SPLIT 1] "+ORIGINAL_DESC,ORIGINAL_AMOUNT,ORIGINAL_CAT);addRow("[SPLIT 2] "+ORIGINAL_DESC,0,"");recalc()}).API_GET_CATEGORIES_SPLIT()};function addRow(desc="",val=0,cat=""){const div=document.createElement('div');div.className='split-row';div.innerHTML=\`<div class="flex-grow-1"><input type="text" class="form-control form-control-sm mb-1 inp-desc" placeholder="Descrição" value="\${desc}"><input class="form-control form-control-sm inp-cat" list="list-cats" placeholder="Categoria" value="\${cat}"></div><div style="width:120px"><input type="number" class="form-control inp-val" step="0.01" value="\${val}" oninput="recalc()"></div><div class="btn-remove" onclick="this.parentElement.remove();recalc()">✕</div>\`;document.getElementById('split-container').appendChild(div)}function recalc(){let total=0;document.querySelectorAll('.inp-val').forEach(inp=>{total+=parseFloat(inp.value)||0});const diff=ORIGINAL_AMOUNT-total;const elTotal=document.getElementById('current-total');const elMsg=document.getElementById('diff-msg');const btn=document.getElementById('btn-save');elTotal.innerText=total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});if(Math.abs(diff)<0.01){elTotal.className='match';elMsg.innerHTML='<span class="text-success">✔ Valores batem!</span>';btn.disabled=false}else{elTotal.className='mismatch';elMsg.innerHTML='<span class="text-danger">Diferença: '+diff.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</span>';btn.disabled=true}}function saveSplit(){const rows=[];const els=document.querySelectorAll('.split-row');for(let el of els){const desc=el.querySelector('.inp-desc').value;const cat=el.querySelector('.inp-cat').value;const val=el.querySelector('.inp-val').value;if(!desc||!cat||val<=0){alert("Erro: Preencha descrição, categoria e valor positivo em todas as linhas.");return}rows.push({desc,cat,val})}document.getElementById('btn-save').innerText="Processando...";document.getElementById('btn-save').disabled=true;google.script.run.withSuccessHandler(function(msg){google.script.host.close()}).PRO_SPLIT_process({originalRow:ROW_ID,splitData:JSON.stringify(rows)})}</script></body></html>`;
}