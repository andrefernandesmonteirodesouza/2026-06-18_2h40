/**
 * 📂 ARQUIVO: 4_APP/backend_server.gs
 * 🖥️ MÓDULO: ROTEADOR DE INTERFACES & CONTROLADOR CENTRAL (DIAMOND EDITION)
 * 🔢 VERSÃO: 9.1 (FULL INTEGRITY + CLEANER FIX)
 * 📅 DATA: 26/12/2025
 * 👤 AUTOR: André Fernandes (Sócio) & Gemini (Arquiteto de Soluções)
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * - Mantém TODAS as funcionalidades de Voz, NLP e Parcelamento.
 * - Corrige a API do Painel para limpar cor amarela e checkbox.
 * - Corrige a ordem de leitura das transações (Crescente).
 * -----------------------------------------------------------------------------
 */

function doGet(e) {
  e = e || {};
  e.parameter = e.parameter || {};

  // Rota antiga do Painel 1.0 removida na GFP 16.0.1.
  // Mantemos uma resposta amigável para não quebrar com erro bruto caso algum link antigo exista.
  if (String(e.parameter.page || "").toLowerCase() === "review") {
    return GFP_LEGACY_REVIEW_REMOVED_HTML_16_0_1_();
  }

  // Rotas atuais preservadas:
  // /exec?u=Yan
  // /exec?u=André
  const usuario = e.parameter.u || "André";
  return renderVoiceInterface(usuario);
}

function openReviewPanel() {
  // Compatibilidade: se alguém chamar o nome antigo pelo editor,
  // redireciona para o Painel 2.0 oficial.
  if (typeof openReviewPanelV2 === "function") {
    return openReviewPanelV2();
  }

  SpreadsheetApp.getUi().alert(
    "Painel de Revisão 1.0 foi removido. Use o Painel de Revisão 2.0."
  );
}

function renderReviewPanel() {
  // Compatibilidade: não carrega mais 4_APP/frontend_panel.html.
  return GFP_LEGACY_REVIEW_REMOVED_HTML_16_0_1_();
}

function GFP_LEGACY_REVIEW_REMOVED_HTML_16_0_1_() {
  const html = `
<!doctype html>
<html>
<head>
  <base target="_top">
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f7f7fb;
      color: #111827;
      margin: 0;
      padding: 40px;
    }
    .card {
      max-width: 680px;
      margin: 60px auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 28px 32px;
      box-shadow: 0 12px 30px rgba(15,23,42,.08);
    }
    .tag {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1e3a8a;
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px;
    }
    p {
      font-size: 15px;
      line-height: 1.5;
      margin: 0;
      color: #4b5563;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="tag">GFP 16.0</div>
    <h1>Painel de Revisão 1.0 removido</h1>
    <p>Esta rota antiga não é mais usada. A revisão oficial agora é feita pelo Painel de Revisão 2.0, no menu interno da planilha.</p>
  </div>
</body>
</html>`;

  return HtmlService
    .createHtmlOutput(html)
    .setTitle("GFP — Painel 1.0 removido")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function renderVoiceInterface(usuario) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>GFP Input</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 20px; background-color: #f2f2f7; color: #333; max-width: 600px; margin: 0 auto; }
          .user-badge { background: #e5e5ea; color: #333; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; display: inline-block; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
          h2 { font-size: 22px; margin-bottom: 5px; color: #1c1c1e; }
          .hint { font-size: 12px; color: #8e8e93; margin-bottom: 25px; }
          
          /* GRID DE BOTÕES */
          .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
          
          .btn-big { color: white; border: none; padding: 25px 10px; font-size: 16px; font-weight: bold; border-radius: 18px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.1s; display: flex; flex-direction: column; align-items: center; gap: 8px; }
          .btn-big:active { transform: scale(0.96); }
          .btn-mic { background: #007aff; }
          .btn-mic.recording { background: #ff3b30; animation: pulse 1.5s infinite; }
          .btn-cam { background: #5856d6; }
          
          .separator { margin: 20px 0; color: #aeaeb2; font-size: 12px; font-weight: 500; text-transform: uppercase; }
          
          textarea { width: 100%; height: 80px; padding: 15px; border-radius: 15px; border: 1px solid #d1d1d6; font-size: 16px; box-sizing: border-box; margin-bottom: 15px; font-family: inherit; resize: none; background: #fff; }
          textarea:focus { outline: none; border-color: #007aff; box-shadow: 0 0 0 3px rgba(0,122,255,0.1); }
          
          .btn-send { background: #34c759; color: white; border: none; padding: 16px; border-radius: 14px; width: 100%; font-size: 16px; font-weight: 700; cursor: pointer; }
          
          #status { margin-top: 25px; padding: 15px; border-radius: 12px; text-align: left; display: none; background: #fff; border: 1px solid #e5e5ea; box-shadow: 0 4px 6px rgba(0,0,0,0.02); font-size: 14px; line-height: 1.5; }
          .status-loading { color: #007aff; border-left: 4px solid #007aff; }
          .status-success { color: #333; border-left: 4px solid #34c759; }
          .status-error   { color: #ff3b30; border-left: 4px solid #ff3b30; }
          
          /* Esconde o input file feio */
          #fileInput { display: none; }
          
          @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
        </style>
      </head>
      <body>
        <div class="user-badge">👤 ${usuario}</div>
        <h2>Novo Lançamento</h2>
        <div class="hint">Fale, Digite ou Tire Foto</div>
        
        <div class="action-grid">
          <button id="btnGravar" class="btn-big btn-mic" onclick="toggleRecording()">
            <span style="font-size:24px">🎙️</span>
            <span>GRAVAR</span>
          </button>
          <button id="btnFoto" class="btn-big btn-cam" onclick="document.getElementById('fileInput').click()">
            <span style="font-size:24px">📷</span>
            <span>FOTO</span>
          </button>
        </div>

        <input type="file" id="fileInput" accept="image/*" capture="environment" onchange="handleImageUpload(this)">

        <div class="separator">OU DIGITE</div>
        <textarea id="txtGasto" placeholder="Ex: Jantar 120 reais no Nubank"></textarea>
        <button id="btnEnviar" class="btn-send" onclick="sendText()">ENVIAR TEXTO</button>
        
        <div id="status"></div>

        <script>
          const USUARIO = "${usuario}";
          
          // --- ÁUDIO ---
          let mediaRecorder, audioChunks = [], isRecording = false;
          async function toggleRecording() {
            const btn = document.getElementById('btnGravar');
            if (!isRecording) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                mediaRecorder.onstop = sendAudio;
                mediaRecorder.start();
                isRecording = true;
                btn.classList.add("recording");
                btn.innerHTML = "<span style='font-size:24px'>⏹️</span><span>PARAR</span>";
                showStatus("loading", "🔴 Ouvindo...");
              } catch (e) { alert("Erro microfone: " + e.message); }
            } else {
              mediaRecorder.stop();
              isRecording = false;
              btn.classList.remove("recording");
              btn.innerHTML = "<span style='font-size:24px'>🎙️</span><span>GRAVAR</span>";
              showStatus("loading", "⏳ Processando áudio...");
            }
          }
          
          function sendAudio() {
            const blob = new Blob(audioChunks, { type: 'audio/mp4' });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onError)
                .processAudio(base64, blob.type, USUARIO); 
            };
          }

          // --- FOTO (COM COMPRESSÃO) ---
          function handleImageUpload(input) {
            if (input.files && input.files[0]) {
              const file = input.files[0];
              showStatus("loading", "⏳ Comprimindo imagem...");
              
              // Comprimir imagem no canvas antes de enviar
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 1024; // Reduz para HD (suficiente para ler texto)
                  const scaleSize = MAX_WIDTH / img.width;
                  canvas.width = MAX_WIDTH;
                  canvas.height = img.height * scaleSize;
                  
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  
                  // Converte para JPEG qualidade 0.7
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                  const base64 = dataUrl.split(',')[1];
                  
                  showStatus("loading", "🚀 Enviando foto para IA...");
                  google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onError)
                    .processImageUpload(base64, 'image/jpeg', USUARIO);
                };
              };
            }
          }

          // --- TEXTO ---
          function sendText() {
            const txt = document.getElementById('txtGasto').value;
            if(!txt) return;
            showStatus("loading", "⏳ Processando texto...");
            google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onError)
              .processText(txt, USUARIO);
          }

          // --- UI HELPERS ---
          function showStatus(type, msg) {
            const st = document.getElementById('status');
            st.style.display = 'block';
            st.className = 'status-' + type;
            st.innerHTML = msg;
          }
          
          function onSuccess(res) {
            showStatus("success", res);
            document.getElementById('txtGasto').value = "";
            document.getElementById('fileInput').value = ""; // Reset file
          }
          
          function onError(e) {
            showStatus("error", "❌ Erro: " + e.message);
          }
        </script>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html).setTitle("GFP Input");
}

// =================================================================
// 🧠 SEÇÃO 3: CONTROLADOR CENTRAL (CONTROLLER)
// =================================================================

function processText(texto, usuario) {
  return handleInput(texto, usuario);
}

function processAudio(base64, mime, usuario) {
  if (typeof transcreverAudioLegacy !== 'function') {
     throw new Error("Módulo 'voice_engine.gs' não encontrado ou inativo.");
  }
  return processAudioLegacy(base64, mime, usuario); 
}

function handleInput(textoInput, usuario) {
  const functionName = "handleInput";
  Logger.log(`[${functionName}] Processando input de ${usuario}: "${textoInput}"`);
  
  try {
    const contasDoUsuario = getAccountsForUser(usuario);
    const contextoContas = contasDoUsuario.join(", ");
    
    if (typeof processNaturalLanguage !== 'function') {
        throw new Error("Erro Crítico: Cérebro 'core_intelligence.gs' offline.");
    }
    
    const jsonIA = processNaturalLanguage(textoInput, contextoContas);
    if (!jsonIA) throw new Error("A Inteligência Artificial falhou em interpretar o comando.");

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; 
    
    let baseDateStr = jsonIA.data || "";
    if (!baseDateStr || baseDateStr.toUpperCase() === "HOJE") {
       baseDateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd/MM/yyyy");
    } else if (baseDateStr.includes("YYYY")) {
       baseDateStr = baseDateStr.replace("YYYY", currentYear);
    } else if (baseDateStr.match(/^\d{1,2}\/\d{1,2}$/)) {
       baseDateStr = baseDateStr + "/" + currentYear;
    } else if (baseDateStr.match(/^\d{1,2}$/)) {
       baseDateStr = `${baseDateStr.padStart(2,'0')}/${String(currentMonth).padStart(2,'0')}/${currentYear}`;
    }

    const numParcelas = parseInt(jsonIA.parcelas) || 1;
    const valorTotal = parseFloat(jsonIA.valor) || 0;
    const valorParcela = valorTotal / numParcelas;
    const descricaoBase = jsonIA.descricao || "Gasto não identificado";
    const conta = jsonIA.conta || "Conta Genérica";
    const categoria = jsonIA.categoria || "A Classificar";

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("DB_MEMORIA");
    
    if (!sheet) {
        sheet = ss.insertSheet("DB_MEMORIA");
        sheet.appendRow(["ID", "DATA", "DESCRICAO", "VALOR", "CONTA", "CATEGORIA", "NOTA", "STATUS", "QUEM", "METADADOS"]);
        sheet.setFrozenRows(1);
    }

    const linhasParaGravar = [];
    const parts = baseDateStr.split('/');
    const dataInicialObj = new Date(parts[2], parts[1] - 1, parts[0]);

    for (let i = 0; i < numParcelas; i++) {
      let dataParcela = new Date(dataInicialObj);
      dataParcela.setMonth(dataParcela.getMonth() + i);
      const dataFormatada = Utilities.formatDate(dataParcela, Session.getScriptTimeZone(), "dd/MM/yyyy");
      
      let descParcela = descricaoBase;
      if (numParcelas > 1) {
        descParcela = `${descricaoBase} (${i + 1}/${numParcelas})`;
      }

      const idUnico = Utilities.getUuid();
      
      linhasParaGravar.push([
        idUnico, dataFormatada, descParcela, valorParcela, conta, categoria, textoInput, "PENDENTE", usuario, JSON.stringify(jsonIA)
      ]);
    }

    if (linhasParaGravar.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, linhasParaGravar.length, 10).setValues(linhasParaGravar);
    }
    
    try { if (!sheet.getFilter()) sheet.getDataRange().createFilter(); } catch(e){}
    
    if (numParcelas > 1) {
      return `✅ Parcelado em <b>${numParcelas}x</b> de R$ ${valorParcela.toFixed(2)}<br>Total: R$ ${valorTotal}<br>📅 1ª Venc: ${baseDateStr}`;
    } else {
      return `✅ Salvo! <b>R$ ${valorTotal}</b> em <b>${conta}</b><br><small>(${categoria})</small><br><span style='font-size:10px'>📅 ${baseDateStr}</span>`;
    }

  } catch (e) {
    Logger.error(`[${functionName}] Erro de processamento: ${e.message}`);
    return "Erro no sistema: " + e.message;
  }
}

// =================================================================
// 🔌 SEÇÃO 4: HELPERS E APIs DO PAINEL (FULL RESTORED & OPTIMIZED)
// =================================================================

function getAccountsForUser(usuario) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const accs = [];
  const configSheets = ["CFG_Contas", "CFG_Cartoes"];
  configSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const rowString = data[i].join("|");
        if (rowString.includes(usuario)) accs.push(data[i][0]); 
      }
    }
  });
  return accs.length > 0 ? accs : ["Conta Genérica"];
}

function apiGetPendingTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DB_TRANSACOES");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const pending = [];
  
  // 🚨 CORREÇÃO CRÍTICA (V9.1): LOOP CRESCENTE PARA RESPEITAR O SORTER
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[8]; 
    
    if (status !== "OK" && status !== "SPLIT" && status !== "CONCILIADO") {
      if (pending.length >= 50) break;
      
      // EXTRAÇÃO DATA DE COMPRA
      let dataCompra = "";
      const desc = String(row[1]);
      const matchData = desc.match(/^\[(\d{2}\/\d{2})\]/);
      if (matchData) {
        dataCompra = matchData[1]; 
      }
      
      let dataVencimento = row[0];
      if (dataVencimento instanceof Date) {
        dataVencimento = Utilities.formatDate(dataVencimento, Session.getScriptTimeZone(), "dd/MM");
      }

      pending.push({
        rowIndex: i + 1,
        id: i,
        data: dataVencimento,
        dataCompra: dataCompra,
        descricao: row[1],
        valor: row[2],
        tipo: row[3],
        conta: row[4],
        categoriaSugestao: row[5] || "",
        nota: row[9] || "",
        isExpense: row[3] === "D" || (typeof row[2] === 'number' && row[2] < 0)
      });
    }
  }
  return pending;
}

/**
 * API: Salva a revisão de uma única transação (V9.1 CLEAN)
 */
/**
 * API: Salva a revisão de uma única transação (V9.1 CLEAN + GFP 14.2.2 FEEDBACK)
 */
function apiSaveReview(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("DB_TRANSACOES");
    const rowIndex = payload.rowIndex;

    const statusAntes = String(sheet.getRange(rowIndex, 9).getValue() || "").trim();
    const categoriaAntes = String(sheet.getRange(rowIndex, 6).getValue() || "").trim();

    // 1. Grava Categoria
    sheet.getRange(rowIndex, 6).setValue(payload.category);

    // 2. Registra metadados de aprovação/correção antes de virar OK
    GFP_panelRegistrarAprovacaoOuCorrecaoModelo_14_2_2_(
      sheet,
      rowIndex,
      statusAntes,
      categoriaAntes,
      payload.category,
      "PAINEL_REVISAO"
    );

    // 3. Grava Status OK e REMOVE Checkbox
    const cellStatus = sheet.getRange(rowIndex, 9);
    cellStatus.clearDataValidations(); 
    cellStatus.setValue("OK"); 

    // 4. LIMPA A COR DE FUNDO (AMARELO) DA LINHA INTEIRA
    sheet.getRange(rowIndex, 1, 1, 14).setBackground(null); 

    // 5. Treina Memória
    if (payload.learn && typeof trainMemory === 'function') {
      trainMemory(payload.originalDesc, payload.category, "PAINEL_REVISAO");
    }

    // 6. Lógica de Tipo
    applyTypeLogic_ServerSide(sheet, rowIndex, payload.category);

    // 7. Feedback do modelo, se instalado
    try {
      if (typeof GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2 === "function") {
        GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2(rowIndex);
      }
    } catch (feedbackError) {
      Logger.warn("[GFP 14.2.2] Falha no feedback apiSaveReview linha " + rowIndex + ": " + feedbackError.message);
    }

    try {
      if (typeof GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3 === "function") {
        GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3();
      }
    } catch (sortError) {
      Logger.warn("[GFP 14.3] Falha ao ordenar após apiSaveReview: " + sortError.message);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}


/**
 * API: Salva múltiplas revisões de uma vez (V9.1 CLEAN)
 */
/**
 * API: Salva múltiplas revisões de uma vez (V9.1 CLEAN + GFP 14.2.2 FEEDBACK)
 */
function apiSaveBatch(items) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("DB_TRANSACOES");

    items.forEach(item => {
        const rowIndex = item.rowIndex;

        const statusAntes = String(sheet.getRange(rowIndex, 9).getValue() || "").trim();
        const categoriaAntes = String(sheet.getRange(rowIndex, 6).getValue() || "").trim();

        sheet.getRange(rowIndex, 6).setValue(item.category);

        // Registra metadados de aprovação/correção antes de virar OK
        GFP_panelRegistrarAprovacaoOuCorrecaoModelo_14_2_2_(
          sheet,
          rowIndex,
          statusAntes,
          categoriaAntes,
          item.category,
          "PAINEL_BATCH"
        );

        const cellStatus = sheet.getRange(rowIndex, 9);
        cellStatus.clearDataValidations();
        cellStatus.setValue("OK");

        // LIMPA COR AMARELA
        sheet.getRange(rowIndex, 1, 1, 14).setBackground(null);

        applyTypeLogic_ServerSide(sheet, rowIndex, item.category);

        if (item.learn && typeof trainMemory === 'function') {
            trainMemory(item.originalDesc, item.category, "PAINEL_BATCH");
        }
    });

    // Feedback do modelo em lote, se instalado
    try {
      if (typeof GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_APPLY_14_2 === "function") {
        GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_APPLY_14_2(200);
      }
    } catch (feedbackError) {
      Logger.warn("[GFP 14.2.2] Falha no feedback apiSaveBatch: " + feedbackError.message);
    }

    try {
      if (typeof GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3 === "function") {
        GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3();
      }
    } catch (sortError) {
      Logger.warn("[GFP 14.3] Falha ao ordenar após apiSaveBatch: " + sortError.message);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}


function apiGetCategories() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("CFG_Categorias");
  if (!sheet) return ["ERRO: Aba CFG_Categorias não encontrada"];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 6, lastRow - 1, 1).getValues();
  return [...new Set(data.flat().filter(String))].sort();
}

/**
 * 🛠️ FUNÇÃO AUXILIAR: Lógica de Tipo (Server-Side)
 */
function applyTypeLogic_ServerSide(sheet, rowIndex, category) {
  const rangeTipo = sheet.getRange(rowIndex, 4); 
  const tipoAtual = rangeTipo.getValue();

  if (tipoAtual === "S") return;

  const categoriasTransferencia = [
    "Pagamento de Fatura", "Faturas", "Transferência", "Transferencia", "Cartão de crédito",
    "Resgate", "Aplicação", "Investimento", "Saldo Inicial", 
    "Ajuste de Saldo", "Movimentação entre Contas"
  ];

  const ehTransferencia = categoriasTransferencia.some(termo => 
    category.toLowerCase().includes(termo.toLowerCase())
  );
  
  let novoTipo = "D"; 

  if (ehTransferencia) {
    novoTipo = "T";
  } else {
    const valor = sheet.getRange(rowIndex, 3).getValue();
    if (typeof valor === 'number') {
       novoTipo = (valor >= 0) ? "C" : "D";
    }
  }

  if (novoTipo !== tipoAtual) {
    rangeTipo.setValue(novoTipo);
  }
}

// Expondo a função de imagem para o frontend
function processImageUpload(base64, mime, user) {
  // Chama o módulo Vision Engine que criamos
  return visionPipeline(base64, mime, user);
}

/**
 * GFP 14.2.2
 * Registra em METADADOS a aprovação/correção feita pelo painel.
 *
 * Isso permite que o feedback 14.2 saiba:
 * - qual era a categoria sugerida;
 * - qual foi a categoria final aprovada;
 * - se houve acerto ou correção.
 */
function GFP_panelRegistrarAprovacaoOuCorrecaoModelo_14_2_2_(sheet, rowIndex, statusAntes, categoriaAntes, categoriaFinal, origemPainel) {
  try {
    const status = String(statusAntes || "").trim().toUpperCase();

    const isSugestao =
      status.indexOf("GEMINI_") === 0 ||
      status.indexOf("MODELO_") === 0;

    if (!isSugestao) return;

    const metaCell = sheet.getRange(rowIndex, 14); // METADADOS
    const meta = GFP_panelParseJson_14_2_2_(metaCell.getValue());

    if (!meta.classificationParams) meta.classificationParams = {};

    const cp = meta.classificationParams;

    cp.source = cp.source || (status.indexOf("MODELO_") === 0 ? "MODELO_CLASSIFICACAO" : "GEMINI_FALLBACK_CONTROLADO");
    cp.status = cp.status || status;
    cp.statusBeforePanelApproval = status;

    // Se o Gemini/Modelo não tiver gravado suggestedCategory por algum motivo,
    // usa a categoria que estava na célula antes da aprovação.
    cp.suggestedCategory = cp.suggestedCategory || String(categoriaAntes || "").trim();

    cp.panelFinalCategory = String(categoriaFinal || "").trim();
    cp.panelApprovalOrigin = origemPainel || "PAINEL";
    cp.panelApprovedAt = new Date().toISOString();
    cp.panelPatch = "14.2.2";

    const acertou = String(cp.suggestedCategory || "").trim() === String(categoriaFinal || "").trim();

    cp.panelFeedbackPreview = acertou ? "ACERTO" : "CORRECAO";
    cp.feedbackFinalCategory = String(categoriaFinal || "").trim();
    cp.feedbackSuggestedCategory = String(cp.suggestedCategory || "").trim();

    metaCell.setValue(JSON.stringify(meta));

  } catch (e) {
    Logger.warn("[GFP 14.2.2] Falha ao registrar metadados do painel: " + e.message);
  }
}


function GFP_panelParseJson_14_2_2_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}
