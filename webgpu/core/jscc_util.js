import '../util/jscc.js';
import * as util from '../util/util.js';

const debug = 0;

export class Parser {
  constructor(lexer, pdata, hash) {
    this.pdata = pdata;
    this.lexer = lexer;
    this.hash = hash;
  }

  toJSON() {
    let pdata = this.pdata;

    return {
      pop_tab          : pdata.pop_tab,
      act_tab          : pdata.act_tab,
      goto_tab         : pdata.goto_tab,
      labelmap         : pdata.labelmap,
      labels           : pdata.labels,
      error_symbol     : pdata.error_symbol,
      eof_symbol       : pdata.eof_symbol,
      whitespace_token : pdata.whitespace_token,
      defact_tab       : pdata.defact_tab,
      productions      : pdata.productions,
      hash             : this.hash
    };
  }

  loadJSON(obj, actions) {
    let actions2 = {};

    actions2[0] = function(p) {
      p[0] = p[1];
    }

    for (let p of obj.productions) {
      let code = p.code.trim();
      if (code.startsWith("_")) {
        code = code.slice(1, code.length);

        actions2[p.id] = actions[code];
      }
    }

    this.pdata = obj;
    this.hash = obj.hash;
    this.pdata.actions = actions2;
  }

  parse(buf, onerror) {
    this.lexer.input(buf);

    this.onerror = onerror;

    let linemap = new Array(buf.length);
    let colmap = new Array(buf.length);

    let linei = 0, coli = 0;

    for (let i=0; i<buf.length; i++) {
      linemap[i] = linei;
      colmap[i] = coli++;

      if (buf[i] === "\n") {
        linei++;
        coli = 0;
      }
    }

    let lexer = this.lexer;
    let pdata = this.pdata;

    let pop_tab = this.pdata.pop_tab;
    let act_tab = this.pdata.act_tab;
    let goto_tab = this.pdata.goto_tab;
    let labelmap = this.pdata.labelmap

    function PcbClass() {
    }

    let actions = pdata.actions;

    PcbClass.prototype = {
      line: 1,
      column: 1,
      offset: 0,
      error_step: 0,
      src: "",
      att: "",
      la: null,
      act: null,
      lex: function () {
        if (debug) {
          console.log("next token");
        }

        let ret = lexer.next();
        if (ret === undefined) {
          this.la = pdata.eof_symbol;
          return pdata.eof_symbol;
        }

        this.att = ret.value
        this.offset = ret.lexpos

        this.la = labelmap[ret.type];
        this.token = ret;
        this.line = ret.lexer.lineno;

        return labelmap[ret.type];
      }
    }

    function get_act(top, la) {
      for (var i = 0; i < act_tab[top].length; i += 2)
        if (act_tab[top][i] === la)
          return act_tab[top][i + 1];

      return null;
    }

    function get_goto(top, pop) {
      for (var i = 0; i < goto_tab[top].length; i += 2)
        if (goto_tab[top][i] === pop)
          return goto_tab[top][i + 1];
      return null;
    }

    let sstack = [0];
    let vstack = [0];
    let defact_tab = pdata.defact_tab;
    let labels = pdata.labels;
    let err_cnt = 0;
    let rval, act, i = 0;
    let PCB = new PcbClass();

    let this2 = this;

    function doerror(p) {
      console.log(pdata);

      if (this2.onerror) {
        this2.onerror(p);
      }

      let line = -1, col = -1;
      if (p) {
        line = p.line;
        line = linemap[p.offset];
        col = colmap[p.offset];

        console.log(p);
      }

      console.log(p)
      let lines = buf.split("\n");
      let s = "";

      for (let i=line-15; i<line+25; i++) {
        if (i < 0) continue;
        if (i >= lines.length) break;

        let si = ""+i;
        while (si.length < 3) {
          si = " " + si;
        }

        s += si + ": " + lines[i] + "\n";
      }

      console.log(s);
      let message = "";

      message += `${line}:${col}: Syntax Error\n`
      let l = lines[line];
      //l = l.slice(0, col) + util.termColor(l[col], "red") + l.slice(col+1, l.length);
      message += "  " + l + "\n";

      for (let i=0; i<col+2; i++) {
        message += " ";
      }
      message += "^\n";

      console.warn(message, p);
      throw new Error(message);
    }

    console.log("%cPARSING!", "color : orange;");

    let err_off = [];
    let err_la = [];
    PCB.lex();
    while (1) {//!this.lexer.at_end()) {
      PCB.act = get_act(sstack[0], PCB.la);
      if (debug) {
        console.log(PCB.act, PCB.la);
      }

      if (PCB.act === null && defact_tab[sstack[0]] >= 0)
        PCB.act = -defact_tab[sstack[0]];
      if (PCB.act === null) {//Parse error? Try to recover!
        //Report errors only when error_step is 0, and this is not a
        //subsequent error from a previous parse
        if (PCB.error_step === 0) {
          err_cnt++;
          err_off.unshift(PCB.offset - PCB.att.length);
          err_la.unshift([]);

          for (i = 0; i < act_tab[sstack[0]].length; i += 2)
            err_la[0].push(labels[act_tab[sstack[0]][i]]);

          PCB.errorLabels = err_la;
          console.log(vstack);
          doerror(PCB);
        }

        //Perform error recovery
        while (sstack.length > 1 && PCB.act === null) {
          sstack.shift();
          vstack.shift();
          //Try to shift on error token
          PCB.act = get_act(sstack[0], PCB.la);
          if (PCB.act === error_token) {
            sstack.unshift(PCB.act);
            vstack.unshift("");
          }
        }

        //Is it better to leave the parser now?
        if (sstack.length > 1 && PCB.act !== null) {
          //Ok, now try to shift on the next tokens
          while (PCB.la !== eof) {
            PCB.act = act_tab[sstack[0]][i + 1];
            if (PCB.act != null) break;
            while (PCB.lex() != null) PCB.offset++;
          }
        }
        if (PCB.act === null || PCB.la === eof) {
          break;
        }

        //Try to parse the next three tokens successfully...
        PCB.error_step = 3;
      }

      if (PCB.act > 0) {//Shift
        //Parse tree generation
        sstack.unshift(PCB.act);
        vstack.unshift(PCB.att);
        PCB.lex();

        //Successfull shift and right beyond error recovery?
        if (PCB.error_step > 0)
          PCB.error_step--;
      } else {	//Reduce
        act = -PCB.act;
        //vstack.unshift(vstack);

        let prod = pdata.productions[act].rhs;
        let p = [null];

        p.lexer = lexer;

        for (let i=0; i<prod.length; i++) {
          p.push(vstack[prod.length-i-1]);
        }

        if (debug) {
          console.log("P", p);
        }
        //console.log("V", vstack);

        let actfunc = actions[act];
        if (!actfunc) {
          p[0] = p[1];
        } else {
          actfunc(p);
        }

        rval = p[0];
        //console.log("action", act, vstack, actfunc);

        //rval = ACTIONS(act, vstack, PCB);

        //vstack.shift();
        sstack.splice(0, pop_tab[act][1]);
        vstack.splice(0, pop_tab[act][1]);

        PCB.act = get_goto(sstack[0], pop_tab[act][0]);
        //Do some parse tree construction if desired
        //Goal symbol match?
        if (act === 0) break; //Don't use PCB.act here!

        //...and push it!
        sstack.unshift(PCB.act);
        vstack.unshift(rval);
      }
    }

    let ret = rval;
    console.log("RET", ret);
    window.noderet = ret;

    return ret;
  }
}

export function getParser(lexer, parsedef, tokenlist, prec, parserName) {
  if (parserName === undefined) {
    throw new Error("parserName cannot be undefined");
  }

  let grammar = "/~ We use our own lexical scannar ~/\n";

  let visit = {};

  var _i = 0;

  for (let list of prec) {
    let prec = list[0];
    if (prec === "left")
      prec = "<";
    else if (prec === "right")
      prec = ">"
    else
      prec = ""

    grammar += prec + " ";
    for (let i=1; i<list.length; i++) {
      if (i > 1) {
        grammar += "  ";
      }
      grammar += ` '${_i++}' ${list[i]}\n`

      visit[list[i]] = 1;
    }
    grammar += ";\n";

  }

  for (let t of tokenlist) {
    if (t in visit) {
      continue;
    }

    grammar += `'${_i++}'  ${t} \n`
  }
  grammar += ";\n\n##\n\n";

  parsedef.reverse();

  let idgen = 0;
  for (let p of parsedef) {
    p.id = idgen++;
  }

  for (let p of parsedef) {
    let lines = p.grammar.split("\n");
    let li = 0;

    for (let l of lines) {
      if (li === 0) {
        l = "               " + l;
      }

      if (l.trim().length === 0) {
        li++;
        continue;
      }

      grammar += l + ` [*_${p.id}*]\n`;
      li++;
    }

    grammar += "\n;\n";
  }

  let actions = {};
  for (let p of parsedef) {
    actions[""+p.id] = p.func;
    p.func.grammar = p.grammar;
  }

  //if (localStorage
  let hash = util.strhash(grammar);
  let storageKey = "parseTable_" + parserName;
  let parser;
  if (storageKey in localStorage) {
    let buf = localStorage[storageKey];

    try {
      let json = JSON.parse(buf);
      console.log(json);
      parser = new Parser(lexer);
      parser.loadJSON(json, actions);
    } catch (error) {
      util.print_stack(error);
      console.warn("failed to load parse tables from localStorage; rebuilding. . .");
      parser = undefined;
    }
  }

  window.grammar = grammar;

  if (parser) {
    console.log("Old hash:", parser.hash, "new hash:", hash);

    if (parser.hash === hash) {
      window.parser = parser;
      return parser;
    }
  }

  /*
  return {
    parse() {

    }
  }//*/

  console.log(grammar);
  console.log(`Building parse tables (will be cached in localStorage[${storageKey}]. . .`);

  let parse_grammar = jscc.require("lib/jscc/parse");
  let integrity = jscc.require("lib/jscc/integrity");
  let first = jscc.require("lib/jscc/first");
  let tabgen = jscc.require("lib/jscc/tabgen");
  let lexdfa = jscc.require("lib/jscc/lexdfa");
  let global = jscc.require("lib/jscc/global");
  let printtab = jscc.require("lib/jscc/printtab");
  let MODE_GEN = jscc.require("lib/jscc/enums/MODE_GEN");
  let SPECIAL = jscc.require("lib/jscc/enums/SPECIAL");
  var templateString = global.DEFAULT_DRIVER;

  console.log(parse_grammar);
  let ret = parse_grammar(grammar, "grammar");

  let driver = templateString;
  if (!ret) {
    integrity.undef();
    integrity.unreachable();
    first.first();
    tabgen.lalr1_parse_table(false);
    integrity.check_empty_states();
    global.dfa_states = lexdfa.create_subset(global.nfa_states.value);
    global.dfa_states = lexdfa.minimize_dfa(global.dfa_states);

    let pdata = {};

    var pop_tab_json = [];
    for (var i = 0; i < global.productions.length; i++) {
      pop_tab_json.push([global.productions[i].lhs, global.productions[i].rhs.length]);
    }

    pdata.pop_tab = pop_tab_json;

    var act_tab_json = [];
    for (var i = 0; i < global.states.length; i++) {
      var act_tab_json_item = [];

      for (let j = 0; j < global.states[i].actionrow.length; j++) {
        act_tab_json_item.push(global.states[i].actionrow[j].symbol,
          global.states[i].actionrow[j].action);
      }
      act_tab_json.push(act_tab_json_item);
    }

    pdata.act_tab = act_tab_json;

    var goto_tab_json = [];
    for (var i = 0; i < global.states.length; i++) {
      var goto_tab_json_item = [];

      for (let j = 0; j < global.states[i].gotorow.length; j++) {
        goto_tab_json_item.push(global.states[i].gotorow[j].symbol,
          global.states[i].gotorow[j].action);
      }
      goto_tab_json.push(goto_tab_json_item);
    }

    pdata.goto_tab = goto_tab_json;

    var defact_tab_json = [];
    for (var i = 0; i < global.states.length; i++) {
      defact_tab_json.push(global.states[i].def_act);
    }

    pdata.defact_tab = defact_tab_json;

    let arr2 = [];
    for (var i = 0; i < global.symbols.length; i++) {
      arr2.push(global.symbols[i].label);
    }

    pdata.labels = arr2;

    var eof_id = -1;
    // Find out which symbol is for EOF
    for (var i = 0; i < global.symbols.length; i++) {
      if (global.symbols[i].special === SPECIAL.EOF) {
        eof_id = i;
        break;
      }
    }
    pdata.eof_symbol = eof_id;

    var error_id = -1;
    for (var i = 0; i < global.symbols.length; i++) {
      if (global.symbols[i].special === SPECIAL.ERROR) {
        error_id = i;
        break;
      }
    }
    pdata.error_symbol = error_id;

    pdata.whitespace_token = printtab.get_whitespace_symbol_id();

    let labelmap = {};
    for (let i=0; i<pdata.labels.length; i++) {
      labelmap[pdata.labels[i]] = i;
    }
    pdata.labelmap = labelmap;

    pdata.productions = global.productions;

    let actions2 = {};
    actions2[0] = function(p) {
      p[0] = p[1];
    }

    for (let p of global.productions) {
      let code = p.code.trim();
      if (code.startsWith("_")) {
        code = code.slice(1, code.length);

        actions2[p.id] = actions[code];
      }
    }

    pdata.actions = actions2;

    //ret = driver;
    ret = pdata;

    console.log(printtab.print_symbol_labels());
  }
  window.grammar = ret;
  console.log(ret);

  parser = new Parser(lexer, ret, hash);

  localStorage[storageKey] = JSON.stringify(parser);
  window.parser = parser;

  return parser;
}