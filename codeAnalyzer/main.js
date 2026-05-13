// ═══════════════════════════════════════════════════════════════
// KONSTANTEN
// ═══════════════════════════════════════════════════════════════

const INSTR_MIN   =  8
const INSTR_MAX   = 74

const BIT_COLS    = ["D12","D11","D10","D9","D8","D7","D6","D5","D4","D3","D2","D1","D0"]
const SRC_COLS    = ["D7","D6","D1","D0"]
const DEST_COLS   = ["D10","D9","D8"]
const S_SPALTEN   = ["S7","S11","S5","S10","S13","S6","S3","S9","S4","S2","S1","S8","S12","S14"]
const MSK_SPALTEN = ["Msk0","Msk1","Msk2","Msk3","Msk4","Msk5"]   // Msk6 ignorieren

const FARBE_AKTIV   = "#cc0000"
const FARBE_INAKTIV = "#000000"


// ═══════════════════════════════════════════════════════════════
// LED-LEISTE aufbauen
// ═══════════════════════════════════════════════════════════════

const ledBar = document.getElementById("led-bar")
const leds = {}

for (let nr = INSTR_MIN; nr <= INSTR_MAX; nr++) {
  const led = document.createElement("div")
  led.className = "led"
  led.textContent = nr
  led.title = "InstrNo " + nr
  ledBar.appendChild(led)
  leds[nr] = led
}

function ledsAktualisieren(aktiveNummern) {
  for (let nr = INSTR_MIN; nr <= INSTR_MAX; nr++)
    leds[nr].classList.toggle("active", aktiveNummern.includes(nr))
}


// ═══════════════════════════════════════════════════════════════
// MASK-TABELLE
//
// Für jede aktive InstrNo:
//   1. Welche Msk0-Msk5 sind "1"?
//   2. D12D11-Wert aus aktuelleBits berechnen: D12*2 + D11 → 0..3
//   3. In DigitMaskData filtern: Mask === MskNr UND D12D11 === Wert
//   4. S-Spalten anzeigen: "E" = aktiv (grün), sonst grau
//   5. Keine aktive Maske → Zeile grau
// ═══════════════════════════════════════════════════════════════

function d1d0Berechnen() {
  // D1 = Index 11, D0 = Index 12 in aktuelleBits
  const d1 = parseInt(aktuelleBits[11]) || 0
  const d0 = parseInt(aktuelleBits[12]) || 0
  return d1 * 2 + d0   // 0, 1, 2 oder 3
}

function d12d11Berechnen() {
  // D12 = Index 0, D11 = Index 1 in aktuelleBits
  const d12 = parseInt(aktuelleBits[0]) || 0
  const d11 = parseInt(aktuelleBits[1]) || 0
  return d12 * 2 + d11   // 0, 1, 2 oder 3
}


function maskTabelleAktualisieren(aktiveNummern) {
  const tbody = document.getElementById("mask-tbody")
  tbody.innerHTML = ""

  const d12d11 = d12d11Berechnen()

  for (const nr of aktiveNummern) {

    // instrData-Eintrag für diese InstrNo
    const instr = instrData.find(r => parseInt(r["InstrNo"]) === nr)
    if (!instr) continue

    const instrName = instr["InstrName"] || ""

    // Aktive Masken ermitteln (Msk0-Msk5 === "1")
    const aktiveMasken = []
    for (let m = 0; m <= 5; m++) {
      if ((instr["Msk" + m] || "").trim() === "1")
        aktiveMasken.push(m)
    }

    // Keine aktive Maske → graue Zeile
    if (aktiveMasken.length === 0) {
      const tr = document.createElement("tr")
      tr.className = "instr-row kein-msk"
      tr.innerHTML =
        `<td class="col-instrno">${nr}</td>` +
        `<td class="col-name">${instrName}</td>` +
        `<td class="col-msk">—</td>` +
        S_SPALTEN.map(() => `<td class="s-leer">·</td>`).join("")
      tbody.appendChild(tr)
      continue
    }

    // Pro aktive Maske: passenden DigitMask-Eintrag suchen
    for (const maskNr of aktiveMasken) {

      // Suche: Mask === maskNr UND D12D11 === berechneter Wert
      const iMask   = DigitMaskHeaders["Mask"]
      const iD12D11 = DigitMaskHeaders["D12D11"]

      const maskEintrag = DigitMaskData.find(
        d => d[iMask] === maskNr && d[iD12D11] === d12d11
      )

      const tr = document.createElement("tr")
      tr.className = "instr-row"

      let zellen = `<td class="col-instrno">${nr}</td>`
      zellen    += `<td class="col-name">${instrName}</td>`
      zellen    += `<td class="col-msk">Msk${maskNr}</td>`

      // S-Spalten: "E" = aktiv (grün), null/leer = inaktiv
      for (const s of S_SPALTEN) {
        const iS   = DigitMaskHeaders[s]
        const wert = maskEintrag ? maskEintrag[iS] : null
        zellen += wert === "E"
          ? `<td class="s-aktiv">E</td>`
          : `<td class="s-leer">·</td>`
      }

      tr.innerHTML = zellen
      tbody.appendChild(tr)
    }
  }
}

// von - bis
const INSTR_BEREICHE = [
  [32, 36],   // ALU-Operationen
  [25, 30],   // Bypass-Operationen
]

function normalisieren(nr, alleNummern) {
  const bereich = INSTR_BEREICHE.find(([von, bis]) => nr >= von && nr <= bis)
  if (!bereich) return nr

  const trefferImBereich = alleNummern.filter(n => n >= bereich[0] && n <= bereich[1])
  if (trefferImBereich.length >= 2)
    console.warn(`Bereich ${bereich[0]}-${bereich[1]}: mehrere Treffer ${trefferImBereich}`)

  // ein Treffer → nr selbst zurück
  // mehrere Treffer → ersten gefundenen zurück (nicht Bereichsanfang!)
  return trefferImBereich[0]
}

function maskTabelleAlsStruktur() {
  const roheNummern      = bitsDekodieren(aktuelleBits.join(""))
  const normalisierte    = roheNummern.map(nr => normalisieren(nr, roheNummern))
  const dedupliziert     = new Set(normalisierte)
  const gefundeneNummern = Array.from(dedupliziert)
  const d1d0    = d1d0Berechnen()
  const d12d11  = d12d11Berechnen()
  const iMask   = DigitMaskHeaders["Mask"]
  const iD12D11 = DigitMaskHeaders["D12D11"]
  const ergebnis = []

  for (const nr of gefundeneNummern) {
    const instr = instrData.find(r => parseInt(r["InstrNo"]) === nr)
    if (!instr) continue

    const aktiveMasken = []
    for (let m = 0; m <= 5; m++) {
      if ((instr["Msk" + m] || "").trim() === "1")
        aktiveMasken.push(m)
    }

    // Sonderregel: Wenn sowohl Msk0 als auch Msk5 aktiv sind, dann entscheidet D1D0, welche Maske tatsächlich gilt:
    let strukturMasken = aktiveMasken
    if (aktiveMasken.includes(0) && aktiveMasken.includes(5))
      strukturMasken = d1d0 === 0 ? [0] : [5]

    for (const maskNr of strukturMasken) {
      const maskEintrag = DigitMaskData.find(
        d => d[iMask] === maskNr && d[iD12D11] === d12d11
      )

      const states = S_SPALTEN.map(s => {
        const iS   = DigitMaskHeaders[s]
        const wert = maskEintrag ? maskEintrag[iS] : null
        return wert === "E" ? 1 : 0
      })

      ergebnis.push({ instrNo: nr, msk: maskNr, states })
    }

    // Keine aktive Maske → Eintrag mit leerem states-Array
    if (aktiveMasken.length === 0)
      ergebnis.push({ instrNo: nr, msk: null, states: new Array(14).fill(0) })
  }

  return ergebnis
}



// ═══════════════════════════════════════════════════════════════
// ALLE ANZEIGEN AKTUALISIEREN
// Zentrale Funktion: wird nach jedem Bit-Klick und Zeilenklick aufgerufen
// ═══════════════════════════════════════════════════════════════

function allesAktualisieren() {
  const gefundeneNummern = bitsDekodieren(aktuelleBits.join(""))
  ledsAktualisieren(gefundeneNummern)
  diagrammAktualisieren(gefundeneNummern)
  maskTabelleAktualisieren(gefundeneNummern)

  const infoEl = document.getElementById("current-info")
  if (gefundeneNummern.length > 0)
    infoEl.textContent = "InstrNo: [" + gefundeneNummern.join(", ") + "]"
  else
    infoEl.textContent = "Bits: " + aktuelleBits.join("") + " — keine Übereinstimmung"
}


// ═══════════════════════════════════════════════════════════════
// BIT-EDITOREN
// ═══════════════════════════════════════════════════════════════

let aktuelleBits = []

function editorZeichnen(containerId, spalten) {
  const container = document.getElementById(containerId)
  container.innerHTML = ""

  for (const spalte of spalten) {
    const i = BIT_COLS.indexOf(spalte)

    const col = document.createElement("div")
    col.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:2px;"

    const name = document.createElement("div")
    name.className = "bit-cell bit-label"
    name.textContent = spalte

    const cell = document.createElement("div")
    cell.className = "bit-cell"
    cell.dataset.val = aktuelleBits[i]
    cell.textContent = aktuelleBits[i]

    cell.addEventListener("click", () => {
      aktuelleBits[i] = aktuelleBits[i] === "1" ? "0" : "1"
      alleEditorenZeichnen()
      allesAktualisieren()
    })

    col.appendChild(name)
    col.appendChild(cell)
    container.appendChild(col)
  }
}

function alleEditorenZeichnen() {
  editorZeichnen("bit-cells",      BIT_COLS)
  editorZeichnen("bit-cells-src",  SRC_COLS)
  editorZeichnen("bit-cells-dest", DEST_COLS)
}


// ═══════════════════════════════════════════════════════════════
// CODE-LISTING aufbauen
// ═══════════════════════════════════════════════════════════════

const codeList = document.getElementById("code-list")
let ausgewaehlteZeile = null

for (const [idx, zeile] of codeData.entries()) {
  const label = zeile["Label"] || zeile["label"] || ""
  const addr  = zeile["Addr"]  || zeile["addr"]  || ""
  const line  = zeile["Line"]  || zeile["line"]  || ""
  const bits  = zeile["bits"]  || zeile["Bits"]  || ""
  const reass = zeile["Reass"] || zeile["reass2"] || ""

  const div = document.createElement("div")
  div.className = "code-row"
  div.innerHTML =
    `<span class="col-label">${label}</span>` +
    `<span class="col-addr">${addr}</span>`   +
    `<span>${line}</span>`                     +
    `<span class="col-bits">${bits}</span>`   +
    `<span class="col-reass">${reass}</span>`

  div.addEventListener("click", () => zeileSelektion(div, bits))
  codeList.appendChild(div)
}

function zeileSelektion(div, bits) {
  if (ausgewaehlteZeile) ausgewaehlteZeile.classList.remove("selected")
  div.classList.add("selected")
  ausgewaehlteZeile = div

  aktuelleBits = bits.split("")
  document.getElementById("bit-editor").style.display = "block"
  alleEditorenZeichnen()
  allesAktualisieren()
}

function zeileSelektionNachAddr(addr) {
  const s_addr = addr.toString(16).toUpperCase().padStart(3, "0")
  const rows = codeList.querySelectorAll(".code-row")
  for (const row of rows) {
    const rowAddr = row.querySelector(".col-addr")?.textContent.trim()
    if (rowAddr === s_addr) {
      const bits = row.querySelector(".col-bits")?.textContent.trim() || ""
      zeileSelektion(row, bits)
      row.scrollIntoView({ block: "center", inline: "nearest" })
      return true
    }
  }
  console.warn("Zeile nicht gefunden für Addr:", addr)
  return false
}


// ═══════════════════════════════════════════════════════════════
// BIT-DEKODIERUNG, finde instrNo
// ═══════════════════════════════════════════════════════════════

function bitsDekodieren(bits) {
  if (!bits || bits.length < 13) return []

  const gefunden = []

  for (const instr of instrData) {
    const nr = parseInt(instr["InstrNo"] || "")
    if (isNaN(nr) || nr < INSTR_MIN || nr > INSTR_MAX) continue

    let passt = true
    for (let i = 0; i < BIT_COLS.length; i++) {
      const erwartet = (instr[BIT_COLS[i]] || "").trim()
      if (erwartet === "") continue
      if (bits[i] !== erwartet) { passt = false; break }
    }

    if (passt) gefunden.push(nr)
  }

  return gefunden
}



function debugEingabeOeffnen(debugValue, aktuellerWert, onOk) {
  const tempDiv   = document.createElement("div")
  tempDiv.innerHTML = aktuellerWert
  const reinText  = tempDiv.textContent.trim()

  let eingabeWert = reinText.split("")
  let cursorPos   = 0
  while (cursorPos < eingabeWert.length && eingabeWert[cursorPos] === "_")
    cursorPos++

  // Elemente holen
  const overlay  = document.getElementById("debug-overlay")
  const anzeige  = document.getElementById("debug-anzeige")
  const titel    = document.getElementById("debug-titel")
  const btnOk    = document.getElementById("debug-ok")
  const btnAbbrechen = document.getElementById("debug-abbrechen")

  // Befüllen und anzeigen
  titel.textContent    = "Eingabe: " + debugValue
  overlay.style.display = "flex"
  overlay.focus()

  function anzeigeAktualisieren() {
    anzeige.innerHTML = ""
    for (let i = 0; i < eingabeWert.length; i++) {
      const span = document.createElement("span")
      span.textContent = eingabeWert[i]
      if (eingabeWert[i] === "_")
        span.style.color = "#555"
      else if (i === cursorPos) {
        span.style.color      = "#000"
        span.style.background = "#4ec94e"
      } else {
        span.style.color = "#4ec94e"
      }
      anzeige.appendChild(span)
    }
  }

  function schliessen() {
    overlay.style.display = "none"
    overlay.removeEventListener("keydown", keyHandler)
  }

  function uebernehmen() {
    const neuerWert = eingabeWert.join("")
    schliessen()
    onOk(neuerWert)
  }

  function keyHandler(e) {
    e.preventDefault()
    if (e.key === "Escape")      { schliessen(); return }
    if (e.key === "Enter")       { uebernehmen(); return }
    if (e.key === "ArrowRight")  {
      cursorPos++
      while (cursorPos < eingabeWert.length && eingabeWert[cursorPos] === "_") cursorPos++
      if (cursorPos >= eingabeWert.length) cursorPos = eingabeWert.length - 1
    }
    if (e.key === "ArrowLeft")   {
      cursorPos--
      while (cursorPos >= 0 && eingabeWert[cursorPos] === "_") cursorPos--
      if (cursorPos < 0) cursorPos = 0
    }
    if (/^[0-9]$/.test(e.key) && eingabeWert[cursorPos] !== "_") {
      eingabeWert[cursorPos] = e.key
      cursorPos++
      while (cursorPos < eingabeWert.length && eingabeWert[cursorPos] === "_") cursorPos++
      if (cursorPos >= eingabeWert.length) cursorPos = eingabeWert.length - 1
    }
    anzeigeAktualisieren()
  }

  btnOk.onclick         = uebernehmen
  btnAbbrechen.onclick  = schliessen
  overlay.setAttribute("tabindex", "0")
  overlay.addEventListener("keydown", keyHandler)

  anzeigeAktualisieren()
}


// ═══════════════════════════════════════════════════════════════
// MXGRAPH: Diagramm laden
// ═══════════════════════════════════════════════════════════════

function graphErstellen(containerId) {
  const container = document.getElementById(containerId)
  const graph = new mxGraph(container)
  graph.convertValueToString = function(cell) {
    if (cell.value && typeof cell.value === "object" && cell.value.getAttribute)
      return cell.value.getAttribute("label") || ""
    return cell.value || ""
  }
  graph.setEnabled(false)
  graph.setHtmlLabels(true)
  graph.isCellFoldable = function() { return false }
  graph.setTooltips(false)
  graph.setPanning(true)
  graph.panningHandler.useLeftButtonForPanning = true
  graph.getView().setTranslate(0, 0)
  graph.getView().setScale(1)
  const xmlDoc = mxUtils.parseXml(diagramXml)
  const codec  = new mxCodec(xmlDoc)
  codec.decode(xmlDoc.documentElement, graph.getModel())

  // Zellen anklickbar machen
  graph.addListener(mxEvent.CLICK, applyRegValue())
  return graph
}

const graph1 = graphErstellen("container1")
const graph2 = graphErstellen("container2")
// ═══════════════════════════════════════════════════════════════
// INSTR-ZELLEN SAMMELN
// zellenEintraege: { zelle, invertiert, gruppe: [25,26,...] }
// invertiert = true  → rot wenn KEINE der Gruppe aktiv
// invertiert = false → rot wenn IRGENDEINE der Gruppe aktiv
// ═══════════════════════════════════════════════════════════════

const zellenEintraege = []
  for (const graph of [graph1, graph2]) {
    for (const zelle of Object.values(graph.getModel().cells)) {
      const val = zelle.value
      if (!val || typeof val !== "object" || !val.getAttribute) continue

      const instrAttr = val.getAttribute("instr")
      if (!instrAttr || instrAttr === "") continue

      // Alle Nummern aus dem Attribut parsen
      const teile = instrAttr.split(",")

      // Gruppe = alle absoluten Nummern
      const gruppe = []
      for (const teil of teile) {
        const nr = parseInt(teil.trim())
        if (!isNaN(nr))
          gruppe.push(Math.abs(nr))
      }

      // invertiert wenn mindestens eine Nummer negativ ist
      const invertiert = teile.some(t => parseInt(t.trim()) < 0)

      zellenEintraege.push({ graph, zelle, invertiert, gruppe })
    }
  }
console.log("zellenEintraege:", zellenEintraege.length)


// setze Register auf Eingabewert, damit sie im Diagramm angezeigt werden

function applyRegValue() {
  return function (sender, evt) {
    const zelle = evt.getProperty("cell")
    if (!zelle) return

    const val = zelle.value
    if (!val || typeof val !== "object" || !val.getAttribute) return

    // alle relevanten Attribute ausgeben
    const debugRegister = val.getAttribute("Debug")
    const instrAttr = val.getAttribute("instr")
    const labelAttr = val.getAttribute("label")

    console.log("Zelle geklickt:", {
      label: labelAttr,
      instr: instrAttr,
      Debug: debugRegister
    })
    const aktuellerWert = val.getAttribute("label") || ""
    debugEingabeOeffnen(debugRegister, aktuellerWert, (neuerWert) => {
      console.log("Neuer Wert für", debugRegister, ":", neuerWert)
      // alle Register-Instanzen durchlaufen:
      for (const [name, obj] of Object.entries(registerMap)) {
        if (name === debugRegister) {
          console.log("setRegisterValue:", name)
          if (typeof obj.setRegisterValue === "function"){        // Methode existiert, aufrufen
            obj.setRegisterValue(parseInt(neuerWert))
            for (const g of [graph1, graph2]) 
              updateDebugText(g, name,obj.debug())
          }
        }
      }
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// DIAGRAMM AKTUALISIEREN
// ═══════════════════════════════════════════════════════════════

function zelleEinfaerben(graph, zelle, sollRot) {
  const farbe = sollRot ? FARBE_AKTIV : FARBE_INAKTIV
  if (zelle.isEdge()) {
    graph.setCellStyles(mxConstants.STYLE_STROKECOLOR, farbe, [zelle])
  } else {
    graph.setCellStyles(mxConstants.STYLE_FILLCOLOR,   farbe, [zelle])
    graph.setCellStyles(mxConstants.STYLE_STROKECOLOR, farbe, [zelle])
  }
}

function diagrammAktualisieren(aktiveNummern) {
  graph1.getModel().beginUpdate()
  graph2.getModel().beginUpdate()
  try {

    for (const eintrag of zellenEintraege) {

      // prüfen ob irgendeine Nummer der Gruppe aktiv ist
      const eineAktiv = eintrag.gruppe.some(nr => aktiveNummern.includes(nr))

      // invertiert: rot wenn KEINE aktiv
      // normal:     rot wenn IRGENDEINE aktiv
      const sollRot = eintrag.invertiert ? !eineAktiv : eineAktiv

      zelleEinfaerben(eintrag.graph,eintrag.zelle, sollRot)
    }

  } finally {
    graph1.getModel().endUpdate()
    graph2.getModel().endUpdate()
  }
}


// ═══════════════════════════════════════════════════════════════
// Registerinhalte debuggen
// ═══════════════════════════════════════════════════════════════

function findCellByDebug(graph, debugValue) {
  const model = graph.getModel();
  const root = model.getRoot();
  
  // Rekursiv alle Kinder durchsuchen
  function search(cell) {
    const val = cell.getValue();
    if (val && val.getAttribute && val.getAttribute('Debug') === debugValue) {
      return cell;
    }
    const childCount = model.getChildCount(cell);
    for (let i = 0; i < childCount; i++) {
      const result = search(model.getChildAt(cell, i));
      if (result) return result;
    }
    return null;
  }

  return search(root);
}

function updateDebugText(graph, debugValue, newText) {
  const cell = findCellByDebug(graph, debugValue);
  if (!cell) { console.warn('Nicht gefunden:', debugValue); return; }

  const model = graph.getModel();
  model.beginUpdate();
  try {
    const value = cell.getValue().cloneNode(true);
    
    // Aktuelles Label holen
    const label = value.getAttribute('label');
    
    // Nur den Text innerhalb von <font ...>TEXT</font> ersetzen
    const newLabel = label.replace(/>([^<]*)<\/font>/, `>${newText}</font>`);
    
    value.setAttribute('label', newLabel);
    model.setValue(cell, value);
  } finally {
    model.endUpdate();
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP
// Sammelt den aktuellen Zustand und übergibt ihn an den Emulator.
// addr und bits kommen aus der selektierten Code-Zeile,
// maskTabelle aus der aktuellen Dekodierung.
// ═══════════════════════════════════════════════════════════════

function stepAusfuehren() {
  if (!ausgewaehlteZeile) {
    console.warn("Step: keine Zeile selektiert")
    return
  }

  // Addr direkt aus dem DOM lesen (zweite Spalte der selektierten Zeile)
  const addr = ausgewaehlteZeile.querySelector(".col-addr").textContent.trim()
  const zeile = codeData.find(z => (z["Addr"] || z["addr"] || "").trim() === addr)

  if (!zeile) {
    console.warn("Step: Zeile nicht gefunden für Addr:", addr)
    return
  }

  const instrData = {
    addr:        zeile["Addr"]  || zeile["addr"]  || "",
    bits:        aktuelleBits.join(""),
    maskTabelle: maskTabelleAlsStruktur()
  }

  console.log("Step:", instrData)
  emulatorStep(instrData)
}

/// <reference path="./classes.js" />

let ra = new ALU
let r0 = new ShiftRegister28(51)
let r1 = new ShiftRegister28(53)
let r2 = new ShiftRegister14(48, 43)
let r3 = new ShiftRegister14(42, 41)
let rc = new ShiftRegister14Const(58, 55)
let rd = new ShiftRegister14(11, 20)
let sr = new ShiftRegister14Status(23)
let cf = new CF()
const fifo = []

const registerMap = {
  RA: ra,
  r0: r0,
  r1: r1,
  r2: r2,
  r3: r3,
  rc: rc,
  rd: rd,
  sr: sr
}

function destAddrAusBits(bits) {
  if (!bits || bits.length !== 13) return 0

  const destBits = [
    bits[0],   // A9  <- d9
    bits[1],   // A8  <- d8
    bits[2],   // A7  <- d7
    bits[3],   // A6  <- d6
    bits[4],   // A5  <- d5
    bits[5],   // A4  <- d4
    bits[6],   // A3  <- d3
    bits[11],  // A2  <- d2
    bits[12],  // A1  <- d1
    bits[8],  // A0  <- d0
  ]

  const destInt = parseInt(destBits.join(""), 2)
  return destInt ^ 0b0111111111
}

function emulatorStep( instrData ) {

  // Befehle ohne aktive Maske
  for (const instr of instrData.maskTabelle) {
    switch( instr.instrNo ) {
      case 64:
        rc.selectConst(instrData.bits)
        break
    }
  }

  // Die 14 Zyklen eines Befehls
  for (let i = 13; i >= 0; i--){
    // default beide Bus = 0 ( 3 XC3)
    let Bus4 = 3
    let ALU_In2_Bus = 3          
    for (const instr of instrData.maskTabelle) {
      const instrNo = instr.instrNo
      const mask = instr.states[i]
      switch( instrNo) {

        // -----------------------------------------------------------------------
        // zuerst die Belegung von Bus4 und ALU_In2_Bus festlegen, default beide 0
        // -----------------------------------------------------------------------

        // #1 -> ALU_In2_Bus
        case 17:
          if ( mask )
            ALU_In2_Bus = 1 + 3
          break

        // #9 -> ALU_In2_Bus
        case 12:
          if ( mask )
            ALU_In2_Bus = 9 + 3
          break

        // 56,57 RC->Bus4
        case 56:
        case 57:
          if ( mask )
            Bus4 = rc.getOutput()
          break

        // 15,16 RD->Bus4
        case 15:
        case 16:
          if ( mask )
            Bus4 = rd.getOutput()
          break

        // 18,19 RD->ALU_In2_Bus
        case 18:
        case 19:
          if ( mask )
            ALU_In2_Bus = rd.getOutput()
          break        



        // 39,40 R3->Bus4
        case 39:
        case 40:
          if ( mask )
            Bus4 = r3.getOutput()
          break
      }
    }
    
    ra.addsub( Bus4, ALU_In2_Bus,instrData,i) 

    // -----------------------------------------------------------------------
    // ALU oder Bypass steht an Bus5, diesen in die dest schreiben
    // -----------------------------------------------------------------------

    r0.circ(ra.Bus5, instrData, i)
    r2.circ(ra.Bus5, instrData, i)
    r3.circ(ra.Bus5, instrData, i)
    rc.circ(ra.Bus5, instrData, i)
    rd.circ(ra.Bus5, instrData, i)
    const srRetVal = sr.circ(ra.Bus5, instrData, i)
    if (srRetVal >= 0) {
      cf.set(srRetVal)
    }
  }

  // Load Const hat keinen aktiven Zustand, sondern reagiert auf InstrNo allein, muss nach circ RC erfolgen
  // ist eingentlich move rc,rc
  for (const instr of instrData.maskTabelle) {
    switch( instr.instrNo ) {
      case 61:
        rc.loadConst()
        break
    }
  }

  // jmp/call/ret
  const currAddr = parseInt(instrData.addr, 16)
  const destAddr = destAddrAusBits(instrData.bits)
  const hasJMP = instrData.maskTabelle.some(instr => instr.instrNo === 71)
  const hasJcc = instrData.maskTabelle.some(instr => instr.instrNo === 72)
  const hasCALL = instrData.maskTabelle.some(instr => instr.instrNo === 9)
  const hasRET = instrData.maskTabelle.some(instr => instr.instrNo === 10)
  // JMP
  if (hasJMP) {
    zeileSelektionNachAddr(destAddr)
  }
  // Jcc  
  else if (hasJcc && cf.getOutput()) {
    zeileSelektionNachAddr(destAddr)
  }

  // CALL
  else if (hasCALL) {
    fifo.push(currAddr + 1 ) // Rücksprungadresse ist nächste Zeile
    zeileSelektionNachAddr(destAddr)
  } 
  // RET
  else if (hasRET) {
    const returnAddr = fifo.pop()
    if (returnAddr) {
      zeileSelektionNachAddr(returnAddr)
    }
  }
  else
    zeileSelektionNachAddr(currAddr + 1 ) // Normalfall: nächste Zeile



  for (const g of [graph1, graph2]) {
    updateDebugText(g, "RA",     ra.debug())
    updateDebugText(g, "CF",     cf.getOutput())
    updateDebugText(g, "R0.0",   r0.debug(0,  13, "0_0000000000_000"))
    updateDebugText(g, "R0.1",   r0.debug(14, 27, "0_0000000000_000"))
    updateDebugText(g, "R2.0",   r2.debug(0,  0,  "0"))
    updateDebugText(g, "R2.1",   r2.debug(1,  13, "0000000000_000"))
    updateDebugText(g, "R3.0",   r3.debug(0,  0,  "0"))
    updateDebugText(g, "R3.1",   r3.debug(1,  13, "0000000000_000"))
    updateDebugText(g, "RC.0",   rc.debug(0,  0,  "0"))
    updateDebugText(g, "RC.1",   rc.debug(1,  13, "0000000000_000"))
    updateDebugText(g, "RC.addr",rc.debugAddr())
    updateDebugText(g, "RD.0",   rd.debug(0,  0,  "0"))
    updateDebugText(g, "RD.1",   rd.debug(1,  13, "0000000000_000"))
    updateDebugText(g, "SR",     sr.debug(0,  13, "0000_00000_00_00_0"))
  }
}