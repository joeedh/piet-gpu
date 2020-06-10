import * as jscc_util from './jscc_util.js';
import {token, tokdef, lexer, PUTLParseError} from "../util/parseutil.js";
import * as vectormath from '../util/vectormath.js';
import * as util from "../util/util.js";

let tk = (n, r, f) => new tokdef(n, r, f);

let count = (str, match) => {
  let c = 0;
  do {
    let i = str.search(match);
    if (i < 0) {
      break;
    }

    c++;

    str = str.slice(i+1, str.length);
  } while (1);

  return c;
}

let keywords = new Set([
  "CONST", "BOOL", "FLOAT", "DOUBLE", "INT", "UINT",
  "BREAK", "CONTINUE", "DO", "ELSE", "FOR", "IF", "DISCARD", "RETURN", "SWITCH", "CASE", "DEFAULT", "SUBROUTINE",
  "BVEC2", "BVEC3", "BVEC4", "IVEC2", "IVEC3", "IVEC4", "UVEC2", "UVEC3", "UVEC4", "VEC2", "VEC3", "VEC4",
  "MAT2", "MAT3", "MAT4", "CENTROID", "IN", "OUT", "INOUT",
  "UNIFORM", "PATCH", "SAMPLE", "BUFFER", "SHARED",
  "COHERENT", "VOLATILE", "RESTRICT", "READONLY", "WRITEONLY",
  "DVEC2", "DVEC3", "DVEC4", "DMAT2", "DMAT3", "DMAT4",
  "NOPERSPECTIVE", "FLAT", "SMOOTH", "LAYOUT",
  "MAT2X2", "MAT2X3", "MAT2X4",
  "MAT3X2", "MAT3X3", "MAT3X4",
  "MAT4X2", "MAT4X3", "MAT4X4",
  "DMAT2X2", "DMAT2X3", "DMAT2X4",
  "DMAT3X2", "DMAT3X3", "DMAT3X4",
  "DMAT4X2", "DMAT4X3", "DMAT4X4",
  "ATOMIC_UINT",
  "SAMPLER1D", "SAMPLER2D", "SAMPLER3D", "SAMPLERCUBE", "SAMPLER1DSHADOW", "SAMPLER2DSHADOW",
  "SAMPLERCUBESHADOW", "SAMPLER1DARRAY", "SAMPLER2DARRAY", "SAMPLER1DARRAYSHADOW",
  "SAMPLER2DARRAYSHADOW", "ISAMPLER1D", "ISAMPLER2D", "ISAMPLER3D", "ISAMPLERCUBE",
  "ISAMPLER1DARRAY", "ISAMPLER2DARRAY", "USAMPLER1D", "USAMPLER2D", "USAMPLER3D",
  "USAMPLERCUBE", "USAMPLER1DARRAY", "USAMPLER2DARRAY",
  "SAMPLER2DRECT", "SAMPLER2DRECTSHADOW", "ISAMPLER2DRECT", "USAMPLER2DRECT",
  "SAMPLERBUFFER", "ISAMPLERBUFFER", "USAMPLERBUFFER",
  "SAMPLERCUBEARRAY", "SAMPLERCUBEARRAYSHADOW",
  "ISAMPLERCUBEARRAY", "USAMPLERCUBEARRAY",
  "SAMPLER2DMS", "ISAMPLER2DMS", "USAMPLER2DMS",
  "SAMPLER2DMSARRAY", "ISAMPLER2DMSARRAY", "USAMPLER2DMSARRAY",
  "IMAGE1D", "IIMAGE1D", "UIMAGE1D", "IMAGE2D", "IIMAGE2D",
  "UIMAGE2D", "IMAGE3D", "IIMAGE3D", "UIMAGE3D",
  "IMAGE2DRECT", "IIMAGE2DRECT", "UIMAGE2DRECT",
  "IMAGECUBE", "IIMAGECUBE", "UIMAGECUBE",
  "IMAGEBUFFER", "IIMAGEBUFFER", "UIMAGEBUFFER",
  "IMAGE1DARRAY", "IIMAGE1DARRAY", "UIMAGE1DARRAY",
  "IMAGE2DARRAY", "IIMAGE2DARRAY", "UIMAGE2DARRAY",
  "IMAGECUBEARRAY", "IIMAGECUBEARRAY", "UIMAGECUBEARRAY",
  "IMAGE2DMS", "IIMAGE2DMS", "UIMAGE2DMS",
  "IMAGE2DMSARRAY", "IIMAGE2DMSARRAY", "UIMAGE2DMSARRAY",
  "STRUCT", "VOID", "WHILE",
  "IDENTIFIER", "TYPE_NAME",
  "FLOATCONSTANT", "DOUBLECONSTANT", "INTCONSTANT", "UINTCONSTANT", "BOOLCONSTANT",
  "FIELD_SELECTION",
  "LEFT_OP", "RIGHT_OP",
  "INC_OP", "DEC_OP", "LE_OP", "GE_OP", "EQ_OP", "NE_OP",
  "AND_OP", "OR_OP", "XOR_OP", "MUL_ASSIGN", "DIV_ASSIGN", "ADD_ASSIGN",
  "MOD_ASSIGN", "LEFT_ASSIGN", "RIGHT_ASSIGN", "AND_ASSIGN", "XOR_ASSIGN", "OR_ASSIGN",
  "SUB_ASSIGN",
  "LEFT_PAREN", "RIGHT_PAREN", "LEFT_BRACKET", "RIGHT_BRACKET", "LEFT_BRACE", "RIGHT_BRACE", "DOT",
  "COMMA", "COLON", "EQUAL", "SEMICOLON", "BANG", "DASH", "TILDE", "PLUS", "STAR", "SLASH", "PERCENT",
  "LEFT_ANGLE", "RIGHT_ANGLE", "VERTICAL_BAR", "CARET", "AMPERSAND", "QUESTION",
  "INVARIANT", "PRECISE",
  "HIGH_PRECISION", "MEDIUM_PRECISION", "LOW_PRECISION", "PRECISION"
]);

let tokendef = [
  tk("ID", /[a-zA-Z$_]+[a-zA-Z0-9$_]*/, (t) => {
    if (keywords.has(t.value.toUpperCase())) {
      t.type = t.value.toUpperCase();
    }

    return t;
  }),
  tk("FLOATCONSTANT", /[0-9]+\.([0-9]*)?/, (t) => {
    t.value = parseFloat(t.value);
    return t;
  }),
  tk("INTCONSTANT", /[0-9]+/, (t) => {
    t.value = parseInt(t.value);
    return t;
  }),
  tk("BOOLCONSTANT", /(true|false)/),
  tk("DOUBLECONSTANT", /[0-9]+(\.[0-9]*)?d/, (t) => {
    t.value = t.value.slice(0, t.value.length-1);
    t.value = parseFloat(t.value);

    return t;
  }),
  tk("LPAREN", /\(/),
  tk("RPAREN", /\)/),
  tk("STRLIT", /".*(?<!\\)\"/, (t) => {
    let v = t.value;
    t.lexer.lineno += count(t.value, "\n");
    return t;
  }),
  tk("WS", /[ \t\n\r]/, (t) => {
    t.lexer.lineno += count(t.value, "\n");
    //drop token by not returning it
  }),
  tk("COMMA", /\,/),
  tk("COLON", /:/),
  tk("LSBRACKET", /\[/),
  tk("RSBRACKET", /\]/),
  tk("LBRACKET", /\{/),
  tk("RBRACKET", /\}/),
  tk("DOT", /\./),
  tk("PLUS", /\+/),
  tk("MINUS", /\-/),
  tk("TIMES", /\*/),
  tk("DIVIDE", /\//),
  tk("EXP", /\*\*/),
  tk("LAND", /\&\&/),
  tk("BITAND", /\&/),
  tk("LOR", /\|\|/),
  tk("BITOR", /\|/),
  tk("EQUALS", /==/),
  tk("NEQUALS", /\!=/),
  tk("ASSIGN", /=/),
  tk("LEQUALS", /\<\=/),
  tk("GEQUALS", /\>\=/),
  tk("LTHAN", /\</),
  tk("GTHAN", /\>/),
  tk("MOD", /\%/),
  tk("XOR", /\^/),
  tk("BITINV", /\~/),
  tk("INC", /\+\+/),
  tk("DEC", /\-\-/)

];

let lex = new lexer(tokendef, (t) => {
  console.log("Token error");
  return true;
});


let binops = new Set([
  ".", "/", "*", "**", "^", "%", "&", "+", "-", "&&", "||", "&", "|", "<",
  ">", "==", "=", "<=", ">="//, "(", ")"
]);

let precedence = [
  ["left", "TIMES", "DIV"],
  ["left", "PLUS", "MINUS"],
  ["left", "BITAND", "BITOR", "XOR"],
  ["left", "NEQUALS", "EQUALS"],
  ["left", "GEQUALS", "LEQUALS", "GTHAN", "LTHAN"],
  ["left", "LAND", "LOR"],
  ["left", "DOT"],
  ["left", "ASSIGN"],
]


function indent(n, chr="  ") {
  let s = "";
  for (let i=0; i<n; i++) {
    s += chr;
  }

  return s;
}

export class Node extends Array {
  constructor(type) {
    super();
    this.type = type;
    this.parent = undefined;
  }

  push(n) {
    n.parent = this;
    return super.push(n);
  }

  remove(n) {
    let i = this.indexOf(n);

    if (i < 0) {
      console.log(n);
      throw new Error("item not in array");
    }

    while (i < this.length) {
      this[i] = this[i+1];
      i++;
    }

    n.parent = undefined;
    this.length--;

    return this;
  }

  insert(starti, n) {
    let i = this.length-1;
    this.length++;

    if (n.parent) {
      n.parent.remove(n);
    }

    while (i > starti) {
      this[i] = this[i-1];
      i--;
    }

    n.parent = this;
    this[starti] = n;

    return this;
  }

  replace(n, n2) {
    if (n2.parent) {
      n2.parent.remove(n2);
    }

    this[this.indexOf(n)] = n2;
    n.parent = undefined;
    n2.parent = this;

    return this;
  }

  toString(t=0) {
    let tab = indent(t, "-");

    let typestr = this.type;

    if (this.value !== undefined) {
      typestr +=  " : " + this.value;
    } else if (this.op !== undefined) {
      typestr += " (" + this.op + ")";
    }

    let s = tab + typestr + " {\n"
    for (let c of this) {
      s += c.toString(t+1);
    }
    s += tab + "}\n";

    return s;
  }
}

let parsedef = [
  {
    grammar : `var_expr: ID`,
    func    : (p) => {
      p[0] = new Node("ID")
      p[0].value = p[1];
    }
  },
  {
    grammar : `intconstant: INTCONSTANT`,
    func : (p) => {
      p[0] = new Node("IntConstant");
      p[0].value = p[1];
    }
  },
  {
    grammar : `floatconstant: FLOATCONSTANT`,
    func : (p) => {
      p[0] = new Node("FloatConstant");
      p[0].value = p[1];
    }
  },
  {
    grammar : `boolconstant: BOOLCONSTANT`,
    func : (p) => {
      p[0] = new Node("BoolConstant");
      p[0].value = p[1];
    }
  },
  {
    grammar : `uintconstant: UINTCONSTANT`,
    func : (p) => {
      p[0] = new Node("UIntConstant");
      p[0].value = p[1];
    }
  },

  {
    grammar : `expression: INTCONSTANT`,
    func : (p) => {
      p[0] = new Node("IntConstant");
      p[0].value = p[1];
    }
  },

  {
    grammar : `primary_expression:  var_expr
                                  | INTCONSTANT
                                  | UINTCONSTANT
                                  | FLOATCONSTANT
                                  | BOOLCONSTANT
                                  | LSBRACKET expression RSBRACKET`,
    func : (p) => {
      if (p.length === 2) {
        p[0] = p[1];
      } else if (p.length === 4) {
        p[0] = p[2];
      }
    }
  },
]



let tokens = [];
for (let key of keywords) {
  tokens.push(key);
}
for (let tk of tokendef) {
  tokens.push(tk.name);
}

export let parser = jscc_util.getParser(lex, parsedef, tokens, precedence);


