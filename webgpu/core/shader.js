let BASE_PATH = "./shaders"
let fs = require("fs");
let pathmod = require("path");

import {parser} from './parser.js';

export function readShader(path) {
  console.log(pathmod.resolve("./"));
  path = pathmod.resolve(BASE_PATH + "/" + path);
  console.log(path);

  let buf = fs.readFileSync(path, "utf8");
  return buf;
}

export function escapeRe(s) {
  s = s.replace(/\//g, "\\/");
  s = s.replace(/\[/g, "\\[");
  s = s.replace(/\]/g, "\\]");
  s = s.replace(/\|/g, "\\|");
  s = s.replace(/\(/g, "\\(");
  s = s.replace(/\)/g, "\\)");
  s = s.replace(/\{/g, "\\{");
  s = s.replace(/\}/g, "\\}");
  s = s.replace(/\$/g, "\\$");

  return s;
}

export function doDefs(l, defs) {
  for (let i=0; i<50; i++) {
    let l2 = doDefs_intern(l, defs);
    if (l2 === l) {
      break;
    }

    l = l2;
  }

  return l;
}

function doDefs_intern(l, defs) {
  //replace with greatest sized define
  let i = 0;
  let l2 = "";
  let _i = 0;

  while (l.length > 0) {
    if (_i++ > 1000) {
      console.warn("infinite loop detected");
      break;
    }

    let maxm, max, maxrepl, ok=false;

    for (let [re, repl] of defs.values()) {
      let m = re.exec(l);
      if (!m || m.index !== 0) continue;

      let len = m[0].length;
      if (max===undefined || len > max) {
        max = len;
        maxm = m;
        maxrepl = repl;
        ok = true;
      }
    }

    if (!ok) {
      if (l.length > 0) {
        l2 += l[0];
        l = l.slice(1, l.length);
        continue;
      } else {
        break;
      }
    }

    let lb = l.slice(maxm.index + maxm[0].length, l.length);

    l2 += maxrepl;
    l = lb;
  }

  l2 += l;
  return l2;
}

export function preprocess(buf, path, state=undefined) {
  if (state === undefined) {
    state = {
      ifstack : [],
      defs    : new Map(),
    }
  }

  let ifstack = state.ifstack;
  let defs = state.defs;

  let lines = buf.split("\n");
  let out = "";

  for (let i=0; i<lines.length; i++) {
    let l = lines[i];

    if (l.trim().startsWith("#")) {
      l = l.trim();
      l = l.slice(1, l.length).trim();

      l = l.replace(/[ \t]+/g, " ");
      l = l.split(" ");
      //console.log(l[0], l);

      if (l[0] === "define") {
        let re = escapeRe(l[1]) + "$";

        //console.log(re);
        re = new RegExp(re);

        if (l.length < 3) {
          defs.set(l[1], [re, ""]);
        } else {
          defs.set(l[1], [re, l.slice(2, l.length).join(" ").trim()]);
        }
      } else if (l[0] === "include") {
        let path2 = l[1].replace(/["'`]/g, "").trim();
        let buf2 = readShader(path2);
        out += preprocess(buf2, path2, state);
      }
    } else {
      out += doDefs(l, defs) + "\n";
    }
  }

  return out;
}

export function replaceComments(buf) {
  let lines = buf.split("\n");
  let out = "";

  for (let l of lines) {
    if (l.trim().startsWith("//")) {
      l = l.replace(/\/\//, "#");
    }

    out += l + "\n";
  }

  return out;
}


export function loadShader(path) {
  let buf = readShader(path);

  delete require.cache[require.resolve("stream")]

  let stream = require("stream");

  class ReadableString extends stream.Readable {
    constructor(str) {
      super({
        encoding : "utf8"
      });

      this.sent = false;
      this.str = str;
    }

    _read() {
      console.log("Reading!");

      if (!this.sent) {
        this.push(this.str.replace(/\r/g, ""));//Buffer.from(this.str));
        this.sent = true
      }
      else {
        this.push(null)
      }
    }
  }

  /*
    buf = preprocess(`
    #define TILE_HEIGHT 32
    #define TILE_HEIGHT_PX 1
    
    int a = TILE_HEIGHT;
    int b = TILE_HEIGHT_PX;
    
    #define BLOCK_HEIGHT 3
    
    float((BLOCK_HEIGHT * TILE_HEIGHT_PX)));
  `)
  //*/

  delete require.cache[require.resolve('glsl-tokenizer/stream')];
  delete require.cache[require.resolve('glsl-parser/stream')];

  var TokenStream = require('glsl-tokenizer/stream')
  var ParseStream = require('glsl-parser/stream')

  buf = preprocess(buf, path);
  //buf = "#version 450\n" + buf;

  window.shaderbuf = buf;

  let ast = parser.parse(buf);

  /*
  let st = new ReadableString(buf);
  st.sent = false;

  st.pipe(TokenStream())
    .pipe(ParseStream())
    .on('error', function(err) {
      console.log("got error");
    })
    .on('data', function(x) {
      console.log('ast of', x.type)
    })


  //*/

  //buf = replaceComments(buf);

  //console.log(buf);
}
