class CF {
  constructor() {
    this.cf = 0
  }
  set( value ) {
    this.cf = value & 0x1
  }
  getOutput() {
    return this.cf
  }
}

// ── ShiftRegister14 ───────────────────────────────────────────────────────────

class ShiftRegister14 {
  constructor(mode0, mode1) {
    this.data  = new Uint8Array(14).fill(3)
    this.data = [12,4,5,6,7,8,4,5,6,7,8,4,5,6]
    this.mode0 = mode0
    this.mode1 = mode1
  }

  getOutput() {
    return this.data[13];
  }

  circReg() {
    const last = this.data[13]
    for (let i = 13; i > 0; i--) this.data[i] = this.data[i - 1]
    this.data[0] = last
  }

  circ(input, instrData, state) {
    const last = this.data[13]

    const foundMode0 = instrData.maskTabelle.find(instr => instr.instrNo === this.mode0)
    const foundMode1 = instrData.maskTabelle.find(instr => instr.instrNo === this.mode1)

    if (foundMode0?.states[state] === 1) {
      for (let i = 13; i > 0; i--) this.data[i] = this.data[i - 1]
      this.data[0] = input & 0xF

    } else if (foundMode1?.states[state] === 1) {
      for (let i = 13; i > 1; i--) this.data[i] = this.data[i - 1]
      this.data[1] = input & 0xF
      this.data[0] = last

    } else {
      this.circReg()
    }
  }


  debug(startIndex, endIndex, formatString) {
    const values = [];
    for (let i = startIndex; i <= endIndex; i++) {
      values.push(this.data[i] - 3);
    }
    let valueIndex = 0;
    return formatString.replace(/0/g, () => values[valueIndex++] ?? "");
  }
}

//   Status Register, SR: Achtung hier kein XC3!
class ShiftRegister14Status extends ShiftRegister14 {
  static Digits = {
      0:-1,
      1:  6,
      2: 10,
      3:  2,
      4: 12,
      5:  4,
      6:  8,
      7:  0,
      8: 13,
      9:  5,
      10: 9,
      11: 1,
      12: 11,
      13: 3,
      14: 7,
      15: -1,
  }
  constructor(mode0) {
    super(mode0, 0)
  }

  circ(input, instrData, state) {
    let retVal = -1
    const last = this.data[13]

    const foundMode0 = instrData.maskTabelle.find(instr => instr.instrNo === this.mode0)
    const foundMode1 = instrData.maskTabelle.find(instr => instr.instrNo === 62) // bclr #all

    if (foundMode0?.states[state] === 1) {
      // Bus5-Input: Schiebt neuen Wert in data[0], schiebt alten Wert von data[0] nach data[1], und so weiter
      for (let i = 13; i > 0; i--) this.data[i] = this.data[i - 1]
      this.data[0] = input & 0xF
    } 

    // bclr #all: Schiebt 0 in data[0] wenn state aktiv

    else if (foundMode1?.states[state] === 1) {
      for (let i = 13; i > 0; i--) this.data[i] = this.data[i - 1]
      this.data[0] = 0    // Achtung hier kein XC3!
      return retVal
    }

    // btst und bset/bclr/bchg: Bitmanipulation an einem digit, abhängig von Instruktion und state
    if (!instrData.maskTabelle.find(instr => instr.instrNo === 69))
      return retVal  // keine Bit-Operationen
    
    const bits = instrData.bits || ""
    const d1 = parseInt(bits[11]) || 0
    const d0 = parseInt(bits[12]) || 0
    const bitMask = 1 << (3 - (d1 * 2 + d0))   // 0, 1, 2 oder 3

    // D9  = Index 3, D8  = Index 4,
    // D7  = Index 5, D6  = Index 6 in bits
    const d9 = parseInt(bits[3]) || 0
    const d8 = parseInt(bits[4]) || 0
    const d7 = parseInt(bits[5]) || 0
    const d6 = parseInt(bits[6]) || 0
    let digit = (d9 << 3) | (d8 << 2) | (d7 << 1) | d6    
    digit = 13 - ShiftRegister14Status.Digits[digit] 

    super.circReg()

    if (digit === state) {
      // bei diesen digit wird bitmanipulation durchgeführt, wenn die Instruktion aktiv ist. Alle anderen digits bleiben unverändert

      // btst wir immer gemacht
      const has74 = instrData.maskTabelle.some(instr => instr.instrNo === 74)
      if ((has74 && (this.data[0] & bitMask) > 0) || (!has74 && (this.data[0] & bitMask) === 0)) 
        retVal = 1
      else 
        retVal = 0
      
      const has67 = instrData.maskTabelle.some(instr => instr.instrNo === 67)
      const has68 = instrData.maskTabelle.some(instr => instr.instrNo === 68)

      if (has67 && !has68) {
        // bclr
        this.data[0] &= bitMask ^ 0xF;
      } else if (!has67 && has68) {
        // bset
        this.data[0] |= bitMask;
      } else if (has67 && has68) {
        // bchg
        this.data[0] ^= bitMask;
      }
    }
    return retVal
  }
  // Achtung hier kein XC3!
  debug(startIndex, endIndex, formatString) {
    const values = [];
    for (let i = startIndex; i <= endIndex; i++) {
      values.push(this.data[i]);
    }
    let valueIndex = 0;
    return formatString.replace(/0/g, () => values[valueIndex++] ?? "");
  }  
}

// ── ShiftRegister14Const ──────────────────────────────────────────────────────

class ShiftRegister14Const extends ShiftRegister14 {
  static mathConst = [
    [ 3, 3, 3, 3, 3, 3, 9, 3, 3, 3],                // 0000006000
    [ 7, 6, 7, 5,12, 7, 7,11, 4,12],                // 4342944819
    [ 5, 6, 3, 5, 8,11, 8, 3,12, 6],                // 2302585093
    [ 9,12, 6, 4, 7,10, 4,11, 3, 9],                // 6931471806
    [12, 8, 6, 4, 3, 4,10,12,11, 3],                // 9531017980
    [12,12, 8, 3, 6, 6, 3,11, 8, 6],                // 9950330853
    [12,12,12, 8, 3, 3, 6, 6, 6, 4],                // 9995003331
    [12,12,12,12, 8, 3, 3, 3, 6, 6],                // 9999500033
    [12,12,12,12,12, 8, 3, 3, 3, 3],                // 9999950000
    [12,12,12,12,12,12, 8, 3, 3, 3],                // 9999995000
    [12,12,12,12,12,12,12, 8, 3, 3],                // 9999999500
    [12,12,12,12,12,12,12,12, 8, 3],                // 9999999950
    [12,12,12,12,12,12,12,12,12, 8],                // 9999999995
    [ 9, 5,11, 6, 4,11, 8, 6, 3,11],                // 6283185308
    [10,11, 8, 6,12,11, 4, 9, 6, 7],                // 7853981634
    [12,12, 9, 9,11, 9, 8, 5, 7,12],                // 9966865249
    [12,12,12,12, 9, 9, 9, 9,11,10],                // 9999666687
    [12,12,12,12,12,12, 9, 9, 9,10],                // 9999996667
    [12,12,12,12,12,12,12,12, 9,10],                // 9999999967
    [12,12,12,12,12,12,12,12,12,12],                // 9999999999
    [12,12,12,12,12,12,12,12,12,12],                // 9999999999
    [12,12,12,12,12,12,12,12,12,12],                // 9999999999
    [12,12,12,12,12,12,12,12,12,12],                // 9999999999
    [12,12,12,12,12,12,12,12,12,12],                // 9999999999
    [ 8,10, 5,12, 8,10,10,12, 8, 4],                // 5729577951
    [ 4,10, 7, 8, 6, 5,12, 5, 8, 5],                // 1745329252
    [ 6, 4, 7, 4, 8,12, 5, 9, 8, 7],                // 3141592654
    [ 4, 8,10, 3,10,12, 9, 6, 5,10],                // 1570796327
    [ 6, 9, 3, 3, 3, 3, 3, 3, 3, 3],                // 3600000000
    [ 3, 4, 4, 3, 3, 3, 3, 3, 3, 3],                // 0110000000
    [ 4, 4, 3, 3, 3, 3, 3, 3, 3, 3],                // 1100000000
    [ 4, 3, 4, 3, 3, 3, 3, 3, 3, 3],                // 1010000000
  ];

  constructor(mode0, mode1) {
    super(mode0, mode1)
    this.selectedConst = 0
  }

  // D7  = Index 5
  // D6  = Index 6
  // D1  = Index 11
  // D0  = Index 12
  // D4  = Index 8
  selectConst(bits) {
    const d7 = parseInt(bits[5])
    const d6 = parseInt(bits[6])
    const d1 = parseInt(bits[11])
    const d0 = parseInt(bits[12])
    const d4 = parseInt(bits[8])

    // Bits zusammensetzen: D7 ist MSB, D4 ist LSB
    const wert = (d7 << 4) | (d6 << 3) | (d1 << 2) | (d0 << 1) | d4
    this.selectedConst = 31 - wert
  }
  
  loadConst() {
    // schreibt in nextData, nicht in data
    const row = ShiftRegister14Const.mathConst[this.selectedConst];
    for (let i = 0; i < 10; i++) {
      this.data[i + 1] = row[i] & 0xF;
    }
  }
  debugAddr() {
    return String(this.selectedConst).padStart(2, "0")
  }
}

// ── ShiftRegister28 ───────────────────────────────────────────────────────────

class ShiftRegister28 {
  constructor( mode0 ) {
    this.data     = new Uint8Array(28).fill(3)
    this.mode0 = mode0
  }

  getOutput() {
    return this.data[27];
  }

  circ( input, instrData, state ) {
    const last = this.data[27];
    const foundMode0 = instrData.maskTabelle.find(instr => instr.instrNo === this.mode0)

    if (foundMode0?.states[state] === 1) {
       for (let i = 27; i > 0; i--) this.data[i] = this.data[i - 1];
       this.data[0] = input & 0xF;
    } 
    else {
       for (let i = 27; i > 0; i--) this.data[i] = this.data[i - 1];
       this.data[0] = last;
    }
  }

  debug(startIndex, endIndex, formatString) {
    // Werte aus data-Bereich sammeln, XC3-Dekodierung (-3)
    const values = [];
    for (let i = startIndex; i <= endIndex; i++) {
      values.push(this.data[i] - 3);
    }

    // Format-String durchlaufen: '0' → nächster Wert, sonst Zeichen übernehmen
    let result = "";
    let valueIndex = 0;

    for (const ch of formatString) {
      if (ch === "0") {
        if (valueIndex < values.length) {
          result += values[valueIndex++];
        }
      } else {
        result += ch;
      }
    }

    return result;
  }
}

// ── ALU ───────────────────────────────────────────────────────────────────────

class ALU {
  constructor() {
    this.output     = 3;  // XC3-codiertes 0
    this.carry      = 0;
    this.nextOutput = 3;
    this.nextCarry  = 0;
    this.Bus5       = 3; // XC3-codiertes 0
  }

  #fromXC3(val) { return val - 3; }
  #toXC3(val)   { return val + 3; }

  addsub(Bus4, ALU_In2_Bus, instrData, state) {
    // Delayed
    this.output = this.nextOutput;
    this.Bus5  =  this.nextOutput; // Bus5 spiegelt ALU-Output wider
    this.carry  = this.nextCarry;

    const addSubInstr  = [32, 33, 34, 35, 36];
    const bypassInstr  = [25, 26, 27, 28, 29, 30];

    const foundAddSub = instrData.maskTabelle.find(
      instr => addSubInstr.includes(instr.instrNo) && instr.states[state] === 1
    );

    const foundBypass = instrData.maskTabelle.find(
      instr => bypassInstr.includes(instr.instrNo) && instr.states[state] === 1
    );

    if (foundAddSub) {
      const subtract = instrData.maskTabelle.some(instr => instr.instrNo === 37);

      const a = this.#fromXC3(Bus4);
      const b = this.#fromXC3(ALU_In2_Bus);
      let result;
      let newCarry;

      if (subtract) {
        result = a - b - this.carry;
        if (result < 0) { result += 10; newCarry = 1; }
        else            {               newCarry = 0; }
      } else {
        result = a + b + this.carry;
        if (result >= 10) { result -= 10; newCarry = 1; }
        else              {               newCarry = 0; }
      }

      this.nextCarry  = newCarry;
      this.nextOutput = this.#toXC3(result);
      return

    }
    // auch wenn eine Add/Sub-Operation ansteht, kann Bypassaktiv sein 
    if (foundBypass) {
      this.Bus5 = Bus4; // Bus5 spiegelt Bus4 wider, wenn Bypass-Operation ansteht    
      return

    }
  }

  debug() {
    return this.#fromXC3(this.nextOutput)
  }
  setRegisterValue(value) {
    this.nextOutput = this.#toXC3(value)
    this.Output = this.#toXC3(value)
  }
}


/* class ALU {
  constructor() {
    this.output     = 3;  // XC3-codiertes 0
    this.carry      = 0;
    this.nextOutput = 3;
    this.nextCarry  = 0;
  }

  #fromXC3(val) { return val - 3; }
  #toXC3(val)   { return val + 3; }

  addsub(Bus4, ALU_In2_Bus, subtract, bypass) {
    // Delayed
    this.output = this.nextOutput;
    this.carry  = this.nextCarry;

    const a = this.#fromXC3(Bus4);
    const b = this.#fromXC3(ALU_In2_Bus);

    let result;
    let newCarry;

    if (subtract) {
      result = a - b - this.carry;       // liest current carry
      if (result < 0) { result += 10; newCarry = 1; }
      else            {               newCarry = 0; }
    } else {
      result = a + b + this.carry;       // liest current carry
      if (result >= 10) { result -= 10; newCarry = 1; }
      else              {               newCarry = 0; }
    }

    this.nextCarry  = newCarry;
    this.nextOutput = this.#toXC3(result);

    return bypass ? Bus4 : this.output;
  }
  debug() {
    let result = ""
    result = this.output  
    return result;
  }        
}
 */