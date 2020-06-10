import * as util from "../util/util.js";
import {Vector2, Vector3, Vector4, Matrix4} from "../util/vectormath.js";
import {Path, PathRender} from "./path.js";

export class AppState {
  constructor() {
    this.canvas = undefined;
    this.g = undefined;
    this.pathrender = new PathRender();
  }

  reset(canvas, g) {
    this.canvas = canvas;
    this.g = g;

    this.pathrender.init();
    let p = this.pathrender.newPath();

    p.moveTo(200, 200);
    p.lineTo(200, 300);
    p.lineTo(400, 300);
    p.lineTo(200, 200);
    p.stroke();
  }

  draw() {
    let g = this.g, canvas = this.canvas;

    g.beginPath();
    g.rect(100, 100, 300, 500);
    g.stroke();
  }

  on_tick() {
    let w = ~~((window.innerWidth-1)*devicePixelRatio);
    let h = ~~((window.innerHeight-1)*devicePixelRatio);

    if (w !== this.canvas.width || h !== this.canvas.height) {
      console.log("resize!", w, h);

      this.canvas.width = w;
      this.canvas.height = h;

      this.canvas.style["width"] = (w/devicePixelRatio) + "px";
      this.canvas.style["height"] = (h/devicePixelRatio) + "px";

      window.redraw_all();
    }
  }

  stop() {
    if (this.timer === undefined)
      return;

    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  start() {
    if (this.timer !== undefined) {
      this.stop();
    }
    this.timer = window.setInterval(() => {
      this.on_tick();
    }, 50);
  }
}

export function init_redraw_globals() {
  let animreq = undefined;
  let f = function() {
    animreq = undefined;

    _appstate.draw();
  }

  window.redraw_all = function() {
    if (animreq) {
      return;
    }

    animreq = requestAnimationFrame(f);
  }
}

export function init() {
  init_redraw_globals();

  window._appstate = new AppState();
  let canvas2d = document.createElement("canvas");
  let g = canvas2d.getContext("2d");
  canvas2d.style["position"] = "absolute";
  canvas2d.style["z-index"] = "-1";
  canvas2d.g = g;
  document.body.appendChild(canvas2d);

  _appstate.reset(canvas2d, g);
  _appstate.start();
  window.redraw_all();
}