/**
 * 📂 ARQUIVO: 3_RULES/core_conciliation.gs
 * 🤝 MÓDULO: MOTOR DE CONCILIAÇÃO (AUTO-BAIXA)
 * 🔢 VERSÃO: 7.9 (MEMORY UPDATE)
 * 📅 DATA: 20/12/2025
 * -----------------------------------------------------------------------------
 * 🔄 HISTÓRICO DE VERSÕES:
 * - V1.1: Introdução do algoritmo de Fuzzy Match.
 * - V1.2: Adicionado Auto-Setup para criar a aba DB_MEMORIA.
 * - V1.3: Ajuste de colunas.
 * - V1.4 (ATUAL - DIAMOND STANDARD):
 * > SINCRONIZAÇÃO DE COLUNAS: Atualizado para garantir que o Auto-Setup crie
 * a aba 'DB_MEMORIA' com as exatas 10 colunas esperadas pelos módulos de entrada.
 * > ESTRUTURA: [ID, DATA, DESCRICAO, VALOR, CONTA, CATEGORIA, NOTA, STATUS, QUEM, METADADOS].
 * > LÓGICA DE MATCH: Refinada para tolerância de 4 dias e 5 centavos.
 * 📝 NOVIDADE V7.9:
 * Além de trazer a categoria para a transação oficial, este script agora vai até
 * a linha correspondente na DB_MEMORIA e muda o Status de "PENDENTE" para
 * "CONCILIADO". Isso permite criar Dashboards de "Contas a Pagar" que se limpam
 * sozinhos.
 * -----------------------------------------------------------------------------
 */


function GFP_MEMORIA_NORMALIZE_TEXT_16_1_18_13_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function GFP_MEMORIA_TO_NUMBER_16_1_18_13_(value) {
  if (typeof value === "number") return isFinite(value) ? value : NaN;
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  const cleaned = raw
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : NaN;
}

function GFP_MEMORIA_TO_DATE_ONLY_16_1_18_13_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value || "").trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function GFP_MEMORIA_DESCRICAO_PARECIDA_16_1_18_13_(descTransacao, descMemoria) {
  const a = GFP_MEMORIA_NORMALIZE_TEXT_16_1_18_13_(descTransacao);
  const b = GFP_MEMORIA_NORMALIZE_TEXT_16_1_18_13_(descMemoria);
  if (!a || !b) return false;

  const stop = {
    DE: true, DA: true, DO: true, DAS: true, DOS: true, E: true,
    COM: true, SEM: true, SALDO: true, CARTAO: true, PAGAMENTO: true,
    REALIZADO: true, COMPRA: true, ENVIADO: true, RECEBIDO: true,
    PIX: true, PARC: true, PARCELA: true
  };

  const tokensA = a.split(" ").filter(function (x) { return x.length >= 4 && !stop[x]; });
  const tokensB = b.split(" ").filter(function (x) { return x.length >= 4 && !stop[x]; });
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const setA = {};
  tokensA.forEach(function (x) { setA[x] = true; });

  return tokensB.some(function (x) {
    if (setA[x]) return true;
    return tokensA.some(function (y) {
      return (x.length >= 5 && y.indexOf(x) >= 0) || (y.length >= 5 && x.indexOf(y) >= 0);
    });
  });
}

function runConciliationMatch(payload) {
  const functionName = "runConciliationMatch";
  Logger.log(`[${functionName}] 🏁 Iniciando rodada de conciliação...`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetTransacoes = ss.getSheetByName("DB_TRANSACOES");
  const sheetMemoria = ss.getSheetByName("DB_MEMORIA");

  if (!sheetTransacoes || !sheetMemoria) {
    Logger.warn("Abas de dados não encontradas. Conciliação abortada.");
    return;
  }

  // 1. Carrega Dados da Memória (Só os PENDENTES)
  const lastRowMem = sheetMemoria.getLastRow();
  if (lastRowMem < 2) return;
  const dataMem = sheetMemoria.getRange(2, 1, lastRowMem - 1, 10).getValues();
  
  // Filtra candidatos válidos (Status = PENDENTE)
  const memoryCandidates = [];
  dataMem.forEach((row, index) => {
    if (row[7] !== "PENDENTE") return; // Coluna H (Index 7)

    const memDate = GFP_MEMORIA_TO_DATE_ONLY_16_1_18_13_(row[1]);
    const memDesc = String(row[2] || "").trim();
    const memVal = GFP_MEMORIA_TO_NUMBER_16_1_18_13_(row[3]);
    const memAccount = String(row[4] || "").trim();
    const memCategory = String(row[5] || "").trim();

    // DB_MEMORIA é rascunho de conciliação; entrada incompleta não pode baixar transação oficial.
    if (!memDate || !memDesc || !isFinite(memVal) || !memAccount || !memCategory) return;

    memoryCandidates.push({
      rowIndex: index + 2, // Base 1 + Cabeçalho
      date: memDate,
      desc: memDesc,
      val: memVal,
      account: memAccount,
      category: memCategory
    });
  });

  Logger.log(`[${functionName}] 🧠 Candidatos na Memória: ${memoryCandidates.length}`);
  if (memoryCandidates.length === 0) return;

  // 2. Carrega Transações Recentes (Para otimizar, pega as últimas 200)
  const lastRowTrans = sheetTransacoes.getLastRow();
  if (lastRowTrans < 2) return;
  
  // Pega tudo para garantir (ou ajuste range se ficar lento)
  const dataTrans = sheetTransacoes.getDataRange().getValues();
  
  let matchCount = 0;

  // 3. O Loop do Cupido (Match Maker)
  // Varre de baixo para cima (mais recentes)
  for (let i = dataTrans.length - 1; i >= 1; i--) {
    const tRow = dataTrans[i];
    
    // Pula se já estiver categorizado/conciliado
    if (tRow[5] && tRow[5] !== "" && tRow[8] === "OK") continue;

    const tDate = GFP_MEMORIA_TO_DATE_ONLY_16_1_18_13_(tRow[0]); // Col A
    const tDesc = String(tRow[1] || "").trim();                  // Col B
    const tVal = GFP_MEMORIA_TO_NUMBER_16_1_18_13_(tRow[2]);      // Col C
    const tAccount = String(tRow[4] || "").trim();               // Col E

    // Linha real obrigatória: DB_MEMORIA nunca pode preencher linha vazia da DB_TRANSACOES.
    if (!tDate || !tDesc || !isFinite(tVal) || !tAccount) continue;

    // Busca par na memória
    for (let m = 0; m < memoryCandidates.length; m++) {
      const mem = memoryCandidates[m];
      
      // CRITÉRIOS DE DIAMANTE 💎
      
      // A. CONTA (Crucial!)
      // A conta da memória deve estar contida na conta do extrato (ex: "Nubank" em "Nubank André")
      const isAccountMatch = tAccount.toLowerCase().includes(mem.account.toLowerCase()) || 
                             mem.account.toLowerCase().includes(tAccount.toLowerCase());
      if (!isAccountMatch) continue;

      // B. VALOR (Absoluto, pois extrato vem negativo)
      const diffVal = Math.abs(Math.abs(tVal) - Math.abs(mem.val));
      if (diffVal > 0.05) continue; // Tolerância de centavos

      // C. DATA (mesmo dia ou lançamento no cartão até 3 dias depois da memória)
      const diffDays = Math.round((tDate - mem.date) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays > 3) continue;

      // D. DESCRIÇÃO (precisa haver semelhança mínima; não basta valor + conta + data)
      if (!GFP_MEMORIA_DESCRICAO_PARECIDA_16_1_18_13_(tDesc, mem.desc)) continue;

      // E. MATCH CONFIRMADO! 💘
      
      // Ação 1: Atualiza Transação Oficial
      sheetTransacoes.getRange(i + 1, 6).setValue(mem.category); // Col F: Categoria
      sheetTransacoes.getRange(i + 1, 9).setValue("OK");         // Col I: Status
      sheetTransacoes.getRange(i + 1, 10).setValue(mem.desc);    // Col J: Notas (Traz a desc original da memória)

      // Ação 2: Baixa na Memória (AQUI ESTÁ A MÁGICA)
      sheetMemoria.getRange(mem.rowIndex, 8).setValue("CONCILIADO"); // Col H: Status
      
      Logger.log(`[MATCH] Transação: "${tRow[1]}" conciliada com Memória: "${mem.desc}"`);
      
      // Remove do array de candidatos para não usar 2x
      memoryCandidates.splice(m, 1);
      matchCount++;
      break; 
    }
  }
  
  Logger.log(`[${functionName}] 🎉 Total de Matches: ${matchCount}`);
}