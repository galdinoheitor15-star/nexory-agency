(() => {
  "use strict";
  const C = window.ZK_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  /* Origem do lead (UTM do anúncio) */
  const params = new URLSearchParams(location.search);
  const origem = store.get("zk_origem") || {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
    if (params.get(k)) origem[k] = params.get(k);
  });
  store.set("zk_origem", origem);

  /* Links do config */
  const waLink = (msg) => (C.whatsapp ? `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}` : "");
  $$("[data-wa]").forEach((a) => {
    const href = waLink(a.dataset.wa);
    if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; } else a.hidden = true;
  });
  $$("[data-ig]").forEach((a) => { a.href = C.instagram || "#"; });
  $$("[data-ano]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  const vagas = Math.max(0, Math.min(5, Number(C.vagasFundadores ?? 5)));
  $$("[data-vagas]").forEach((el) => { el.textContent = vagas; });
  $$(".dots").forEach((d) => {
    d.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < vagas ? "on" : ""}" style="--i:${i}"></i>`).join("");
  });

  /* ---------------------------------------------------------------
     Fundo 3D do topo: fitas brilhantes em WebGL (um único shader).
     Otimização: resolução reduzida, pausa fora da tela e com a aba
     escondida, e qualidade que se ajusta sozinha se o aparelho sofrer.
     --------------------------------------------------------------- */
  const glState = { scroll: 0 };
  (function fundo3D() {
    const canvas = $("#gl");
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance", premultipliedAlpha: false });
    if (!gl) return; // sem WebGL fica o degradê do CSS

    const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uScroll;uniform float uIntro;
const vec3 C0=vec3(.008,.063,.141);
const vec3 C1=vec3(.020,.149,.349);
const vec3 C2=vec3(.329,.514,.702);
const vec3 C3=vec3(.490,.627,.792);
const vec3 C4=vec3(.757,.910,1.);
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float t=uTime;
  vec3 col=C0;
  col+=C1*.7*smoothstep(1.2,0.,length(uv-vec2(.45,.3)));
  col+=C1*.35*smoothstep(1.,0.,length(uv-vec2(-.6,-.45)));
  float zoom=mix(1.45,1.,uIntro)+uScroll*.45;
  vec2 m=uMouse*.05;
  for(int i=0;i<6;i++){
    float fi=float(i);
    float k=fi/5.;
    float z=1.3-fi*.1;
    vec2 p=uv*zoom*z+m*(.3+k*.9);
    p=vec2(p.x*.9+p.y*.43,p.y*.9-p.x*.43);
    float ph=fi*1.37;
    float a1=.15+.05*sin(ph);
    float f1=1.2+.22*fi;
    float f2=2.6+.3*fi;
    float g1=p.x*f1+t*(.32+.04*fi)+ph;
    float g2=p.x*f2-t*.24+ph*2.1;
    float y=a1*sin(g1)+.055*sin(g2)+(fi-2.5)*.085;
    float sl=a1*f1*cos(g1)+.055*f2*cos(g2);
    float inv=inversesqrt(1.+sl*sl);
    float d=(p.y-y)*inv;
    float w=.022+.016*sin(p.x*1.6+t*.45+ph)+.01*fi;
    float s=d/w;
    vec3 base=mix(C1,C2,k*.9);
    if(abs(s)<1.){
      float nz=sqrt(1.-s*s);
      vec3 n=normalize(vec3(-sl*inv*s,inv*s,nz));
      vec3 L=normalize(vec3(-.45,.7,.55));
      float dif=max(dot(n,L),0.);
      float sp=pow(max(dot(n,normalize(L+vec3(0.,0.,1.))),0.),42.);
      float fr=pow(1.-nz,2.4);
      vec3 rc=base*(.16+.95*dif)+C4*sp*(.5+.7*k)+C3*fr*.5;
      float edge=smoothstep(1.,.82,abs(s));
      col=mix(col,rc,edge*(.42+.58*k));
    }
    col+=C2*.045*exp(-abs(d)*20.)*(.35+k);
  }
  col*=1.-.5*dot(uv*.85,uv*.85);
  col+=(hash(gl_FragCoord.xy+fract(t))-.5)*.014;
  gl_FragColor=vec4(col*uIntro,1.);
}`;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ["uRes", "uTime", "uMouse", "uScroll", "uIntro"].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    const mobile = matchMedia("(max-width: 760px)").matches;
    let escala = mobile ? 0.5 : 0.62;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr * escala));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr * escala));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(U.uRes, w, h);
    };
    resize();
    let resizeT;
    addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 150); }, { passive: true });

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    if (finePointer) {
      addEventListener("pointermove", (e) => {
        mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
        mouse.ty = (0.5 - e.clientY / innerHeight) * 2;
      }, { passive: true });
    }

    const desenhar = (tempo, intro) => {
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform1f(U.uTime, tempo);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform1f(U.uScroll, glState.scroll);
      gl.uniform1f(U.uIntro, intro);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    if (reduce) { desenhar(8, 1); return; } // quadro parado, sem movimento

    let visivel = true, rodando = false, raf = 0;
    const t0 = performance.now();
    let ultimo = t0, quadros = 0, somaDt = 0;
    const loop = (agora) => {
      if (!visivel || document.hidden) { rodando = false; return; }
      const dt = agora - ultimo; ultimo = agora;
      // Ajuste automático: se ficar abaixo de ~45 fps, reduz a resolução
      if (quadros < 120) {
        quadros++; somaDt += dt;
        if (quadros === 120 && somaDt / 120 > 22 && escala > 0.3) { escala *= 0.72; resize(); quadros = 0; somaDt = 0; }
      }
      const s = (agora - t0) / 1000;
      const k = clamp(s / 2.2, 0, 1);
      desenhar(s, 1 - Math.pow(1 - k, 3));
      raf = requestAnimationFrame(loop);
    };
    const ligar = () => {
      if (rodando || !visivel || document.hidden) return;
      rodando = true; ultimo = performance.now();
      raf = requestAnimationFrame(loop);
    };
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) ligar(); }).observe(canvas);
    document.addEventListener("visibilitychange", ligar);
    ligar();
  })();

  /* Camadas do "7" em 3D: várias cópias em profundidade formam o volume */
  const seven = $("#seven3d");
  if (seven) {
    const N = 14;
    // Do fundo (#052659) até perto da frente (#5483B3); a face da frente usa o degradê do CSS
    const de = [5, 38, 89], ate = [84, 131, 179];
    seven.innerHTML = Array.from({ length: N }, (_, k) => {
      const z = (k - (N - 1)) * 2.6;
      if (k === N - 1) return `<span style="transform:translateZ(${z}px)">7</span>`;
      const f = k / (N - 2);
      const cor = de.map((c, j) => Math.round(c + (ate[j] - c) * f)).join(",");
      return `<span style="transform:translateZ(${z}px);color:rgb(${cor})">7</span>`;
    }).join("");
  }

  /* ---------------------------------------------------------------
     Efeitos ligados à rolagem num único requestAnimationFrame:
     topo sai com parallax, celular e "7" giram em 3D conforme rolam.
     --------------------------------------------------------------- */
  const heroInner = $(".hero-inner");
  const stage = $("#stage"), phone = $("#phone3d");
  const sevenStage = seven ? seven.parentElement : null;
  const vistos = new Set();
  if ("IntersectionObserver" in window) {
    const ioVisto = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? vistos.add(e.target) : vistos.delete(e.target))));
    [heroInner, stage, sevenStage].forEach((el) => el && ioVisto.observe(el));
  }
  const progresso = (el) => {
    const r = el.getBoundingClientRect();
    return clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
  };
  let agendado = false;
  const aplicarRolagem = () => {
    agendado = false;
    const y = scrollY, vh = innerHeight;
    glState.scroll = clamp(y / vh, 0, 1);
    if (reduce) return;
    if (heroInner && y < vh * 1.3) {
      const k = clamp(y / (vh * 0.75), 0, 1);
      heroInner.style.transform = `translate3d(0,${y * 0.3}px,0) scale(${1 - k * 0.06})`;
      heroInner.style.opacity = String(1 - k);
    }
    if (phone && vistos.has(stage)) {
      const p = progresso(stage);
      phone.style.transform = `rotateY(${-28 + p * 40}deg) rotateX(${16 - p * 22}deg) translateZ(${p * 40}px)`;
    }
    if (seven && vistos.has(sevenStage)) {
      const p = progresso(sevenStage);
      seven.style.transform = `rotateY(${-42 + p * 64}deg) rotateX(${12 - p * 18}deg)`;
    }
  };
  addEventListener("scroll", () => { if (!agendado) { agendado = true; requestAnimationFrame(aplicarRolagem); } }, { passive: true });
  aplicarRolagem();

  /* Revelação ao rolar (sobe e se endireita em 3D) */
  $$("[data-stagger]").forEach((grupo) => {
    [...grupo.children].forEach((filho, i) => {
      filho.classList.add("reveal");
      filho.style.setProperty("--d", `${i * 90}ms`);
    });
  });
  const aoAparecer = new Map();
  const alvos = $$(".reveal, .steps, .vagas, .proj article, #calc");
  const mostrar = (el) => {
    el.classList.add("in");
    const fn = aoAparecer.get(el);
    if (fn) fn();
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) { mostrar(e.target); io.unobserve(e.target); }
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    alvos.forEach((el) => io.observe(el));
  } else {
    alvos.forEach(mostrar);
  }

  /* Cartões inclinam em 3D e a luz segue o mouse (só com mouse de verdade) */
  if (finePointer && !reduce) {
    $$("[data-tilt]").forEach((card) => {
      let raf = 0, ev = null;
      const pintar = () => {
        raf = 0;
        const r = card.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
        card.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 10}deg) translateZ(6px)`;
      };
      card.addEventListener("pointerenter", () => { card.style.transition = "transform .18s ease-out, background-color .3s ease, border-color .3s ease"; });
      card.addEventListener("pointermove", (e) => { ev = e; if (!raf) raf = requestAnimationFrame(pintar); });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(raf); raf = 0;
        card.style.transition = "transform .7s cubic-bezier(0.23,1,0.32,1), background-color .3s ease, border-color .3s ease";
        card.style.transform = "";
      });
    });
  }

  /* Conversa de demonstração */
  const chat = $("#chat");
  if (chat) {
    const MSGS = [
      { from: "cli", t: "Boa noite! Vocês têm horário para limpeza essa semana?", time: "23:04" },
      { from: "ia", t: "Boa noite! Temos sim. Quinta às 9h ou sexta às 14h. Qual fica melhor para você?", time: "23:04" },
      { from: "cli", t: "Sexta às 14h", time: "23:05" },
      { from: "ia", t: "Pronto, Mariana! Agendei sexta, 14h, com a Dra. Paula. Te mando um lembrete na quinta. Posso ajudar em mais alguma coisa?", time: "23:05" },
      { from: "cli", t: "Só isso, obrigada!", time: "23:05" },
    ];
    const bubble = (m) => {
      const b = document.createElement("div");
      b.className = `bubble ${m.from}`;
      b.textContent = m.t;
      const t = document.createElement("time");
      t.textContent = m.time;
      b.append(t);
      return b;
    };
    const status = () => {
      const s = document.createElement("div");
      s.className = "chat-status";
      s.textContent = "Consulta agendada em 41 segundos";
      return s;
    };
    if (reduce) {
      MSGS.forEach((m) => chat.append(bubble(m)));
      chat.append(status());
    } else {
      let visible = false;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(chat);
      const waitVisible = async () => { while (!visible || document.hidden) await sleep(400); };
      (async function loop() {
        for (;;) {
          await waitVisible();
          chat.replaceChildren();
          await sleep(500);
          for (const m of MSGS) {
            await waitVisible();
            if (m.from === "ia") {
              const typing = document.createElement("div");
              typing.className = "typing";
              typing.innerHTML = "<i></i><i></i><i></i>";
              chat.append(typing);
              await sleep(1200);
              typing.remove();
            } else {
              await sleep(1000);
            }
            chat.append(bubble(m));
          }
          await sleep(600);
          chat.append(status());
          await sleep(5000);
        }
      })();
    }
  }

  /* Calculadora: o valor conta até o resultado */
  const calc = $("#calc");
  let custoMensal = 0;
  if (calc) {
    const p = $("#calc-pessoas"), h = $("#calc-horas"), c = $("#calc-custo");
    const mes = $("#calc-mes"), ano = $("#calc-ano");
    let mostrado = 0, raf = 0, ativo = false;
    const pintar = (v) => { mes.textContent = brl(v); ano.textContent = brl(v * 12); };
    const contar = (alvo) => {
      cancelAnimationFrame(raf);
      if (reduce) { mostrado = alvo; pintar(alvo); return; }
      const de = mostrado, t0 = performance.now(), dur = 800;
      const passo = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        mostrado = de + (alvo - de) * (1 - Math.pow(1 - k, 3));
        pintar(mostrado);
        if (k < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    };
    const trilho = (el) => el.style.setProperty("--p", `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
    const update = () => {
      const pessoas = +p.value, horas = +h.value, custo = +c.value;
      [p, h, c].forEach(trilho);
      $("#out-pessoas").textContent = pessoas === 1 ? "1 pessoa" : `${pessoas} pessoas`;
      $("#out-horas").textContent = `${horas} h`;
      $("#out-custo").textContent = brl(custo);
      custoMensal = pessoas * horas * 4.33 * custo;
      if (ativo) contar(custoMensal); else pintar(custoMensal);
    };
    [p, h, c].forEach((el) => el.addEventListener("input", update));
    update();
    aoAparecer.set(calc, () => { ativo = true; mostrado = 0; contar(custoMensal); });
  }

  /* ---------------------------------------------------------------
     Aplicação em etapas: no fim, abre o WhatsApp com o resumo
     --------------------------------------------------------------- */
  const dlg = $("#aplicacao");
  if (!dlg) return;
  const form = $("form", dlg), body = $(".apl-body", dlg), bar = $(".bar i", dlg), count = $(".count", dlg);
  const back = $("[data-back]", dlg), next = $("[data-next]", dlg), foot = $(".apl-foot", dlg);

  const SOLUCOES = [
    "Agentes de Inteligência Artificial",
    "Automação de Processos Empresariais",
    "Sistemas de Gestão Inteligente",
    "Desenvolvimento de Sites Institucionais",
    "Criação de Landing Pages",
    "Sistemas e Aplicações Web Personalizadas",
    "Chatbots e Atendimento Inteligente",
    "Integração entre Sistemas e APIs",
    "Análise de Dados e Relatórios Inteligentes",
    "Soluções de IA Personalizadas",
    "E-commerce e Lojas Virtuais",
    "Consultoria em Tecnologia e Inteligência Artificial",
    "Desenvolvimento de Aplicativos",
    "Modernização e Digitalização de Processos",
    "Outra solução",
  ];

  const STEPS = [
    { title: "Para começar, como falamos com você?", hint: "Leva 2 minutos. No fim, o WhatsApp abre com o resumo das suas respostas.",
      fields: [
        { name: "nome", label: "Seu nome", type: "text", autocomplete: "name" },
        { name: "whatsapp", label: "WhatsApp com DDD", type: "tel", autocomplete: "tel", inputmode: "tel" },
      ] },
    { title: "Qual é o seu cargo?", name: "cargo", options: ["Dono ou sócio", "Diretor", "Gerente", "Outro"] },
    { title: "Qual é a sua empresa?",
      fields: [
        { name: "empresa", label: "Nome da empresa", type: "text", autocomplete: "organization" },
        { name: "setor", label: "Setor (ex.: clínica, loja, indústria, escritório)", type: "text" },
      ] },
    { title: "Quantas pessoas trabalham na empresa?", name: "colaboradores", options: ["1 a 5", "6 a 20", "21 a 50", "51 a 200", "Mais de 200"] },
    { title: "Quais soluções sua empresa precisa?", hint: "Selecione uma ou mais opções", name: "necessidade", multi: true, numerar: true, options: SOLUCOES },
    { title: "Qual tarefa mais toma tempo da sua equipe hoje?", hint: "Uma ou duas frases já bastam.",
      fields: [{ name: "dor", label: "Ex.: responder clientes no WhatsApp, montar relatório, lançar pedidos", type: "textarea" }] },
    { title: "Se fizer sentido, quando quer começar?", name: "quando", options: ["Este mês", "Nos próximos 3 meses", "Só estou pesquisando"] },
    { title: "Qual orçamento você tem em mente?", hint: "Isso nos ajuda a montar uma proposta que caiba no seu bolso.", name: "investimento", options: ["Até R$ 3 mil", "R$ 3 a 10 mil", "R$ 10 a 25 mil", "Mais de R$ 25 mil"] },
  ];

  let i = 0;
  let a = store.get("zk_aplicacao") || {};
  let parcialEnviado = false;
  const save = () => store.set("zk_aplicacao", a);

  const trilha = (x) => {
    if (x.quando === "Só estou pesquisando") return "pesquisa";
    if (x.investimento === "Até R$ 3 mil") return "pronta";
    if (x.investimento === "R$ 3 a 10 mil") return "expressa";
    return "high";
  };

  const send = (etapa) => {
    if (!C.webhook) return;
    const payload = { ...a, etapa, trilha: etapa === "completa" ? trilha(a) : undefined, origem, pagina: location.href, data: new Date().toISOString() };
    try {
      fetch(C.webhook, { method: "POST", mode: "no-cors", keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    } catch {}
  };

  const maskPhone = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  function render() {
    const s = STEPS[i];
    bar.style.transform = `scaleX(${i / STEPS.length})`;
    count.textContent = `${i + 1} de ${STEPS.length}`;
    foot.hidden = false;
    back.hidden = i === 0;
    next.hidden = !!s.options && !s.multi;
    next.firstChild.textContent = i === STEPS.length - 1 ? "Ir para o WhatsApp " : "Continuar ";

    const wrap = document.createElement("div");
    wrap.className = "step-in";
    wrap.style.display = "grid";
    wrap.style.gap = "18px";
    const h = document.createElement("h2");
    h.id = "apl-title";
    h.textContent = s.title;
    wrap.append(h);
    if (s.hint) { const p = document.createElement("p"); p.className = "hint"; p.textContent = s.hint; wrap.append(p); }

    if (s.options) {
      const list = document.createElement("div");
      list.className = s.options.length > 8 ? "opts many" : "opts";
      list.setAttribute("role", "group");
      list.setAttribute("aria-labelledby", "apl-title");
      const marcado = (o) => (s.multi ? lista(a[s.name]).includes(o) : a[s.name] === o);
      const contador = document.createElement("p");
      contador.className = "sel-count";
      contador.setAttribute("aria-live", "polite");
      const atualizar = () => {
        $$(".opt", list).forEach((x) => x.setAttribute("aria-pressed", marcado(x.dataset.v) ? "true" : "false"));
        if (s.multi) {
          const n = lista(a[s.name]).length;
          contador.textContent = n === 0 ? "" : n === 1 ? "1 solução selecionada" : `${n} soluções selecionadas`;
        }
      };
      s.options.forEach((o, k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = s.multi ? "opt multi" : "opt";
        b.dataset.v = o;
        b.style.setProperty("--i", k);
        if (s.numerar) {
          const n = document.createElement("span"); n.className = "n"; n.textContent = String(k + 1).padStart(2, "0");
          b.append(n);
        }
        const t = document.createElement("span"); t.className = "t"; t.textContent = o;
        b.append(t);
        b.addEventListener("click", () => {
          if (s.multi) {
            let sel = lista(a[s.name]);
            sel = sel.includes(o) ? sel.filter((x) => x !== o) : sel.concat(o);
            a[s.name] = SOLUCOES.filter((x) => sel.includes(x)); // mantém a ordem da lista
            save();
            atualizar();
            $(".err", body).textContent = "";
          } else {
            a[s.name] = o;
            save();
            atualizar();
            setTimeout(goNext, reduce ? 0 : 200);
          }
        });
        list.append(b);
      });
      wrap.append(list);
      if (s.multi) wrap.append(contador);
      atualizar();
    } else {
      s.fields.forEach((f) => {
        const label = document.createElement("label");
        label.className = "inp";
        label.textContent = f.label;
        const el = document.createElement(f.type === "textarea" ? "textarea" : "input");
        if (f.type !== "textarea") el.type = f.type;
        el.name = f.name;
        el.id = `apl-${f.name}`;
        if (f.autocomplete) el.autocomplete = f.autocomplete;
        if (f.inputmode) el.inputMode = f.inputmode;
        el.value = a[f.name] || "";
        el.addEventListener("input", () => {
          if (f.name === "whatsapp") el.value = maskPhone(el.value);
          a[f.name] = el.value; save();
        });
        label.append(el);
        wrap.append(label);
      });
    }
    const err = document.createElement("p");
    err.className = "err";
    err.setAttribute("role", "alert");
    wrap.append(err);

    body.replaceChildren(wrap);
    body.scrollTop = 0;
    const first = $("input, textarea, .opt[aria-pressed='true'], .opt", wrap);
    if (first && !matchMedia("(max-width: 560px)").matches) first.focus({ preventScroll: true });
  }

  function validate() {
    const s = STEPS[i];
    const err = $(".err", body);
    if (s.options) {
      if (s.multi) {
        if (lista(a[s.name]).length) return true;
        err.textContent = "Selecione pelo menos uma solução.";
        return false;
      }
      return !!a[s.name];
    }
    for (const f of s.fields) {
      const v = (a[f.name] || "").trim();
      if (!v) { err.textContent = "Preencha este campo para continuar."; $(`#apl-${f.name}`).focus(); return false; }
      if (f.name === "whatsapp" && v.replace(/\D/g, "").length < 10) {
        err.textContent = "Confira o WhatsApp: precisa ter DDD e número.";
        $(`#apl-${f.name}`).focus();
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validate()) return;
    if (i === 0 && !parcialEnviado) { send("parcial"); parcialEnviado = true; }
    if (i < STEPS.length - 1) { i++; render(); } else finish();
  }

  function finish() {
    a.trilha = trilha(a);
    send("completa");
    bar.style.transform = "scaleX(1)";
    count.textContent = "Pronto";
    foot.hidden = true;

    const nome = (a.nome || "").split(" ")[0];
    // Resumo das 8 respostas, que vai pronto para o WhatsApp da Zunkuft
    const linhas = [
      "Olá! Acabei de responder as perguntas no site da Zunkuft.",
      "",
      `*Nome:* ${a.nome || "-"}`,
      `*Cargo:* ${a.cargo || "-"}`,
      `*Empresa:* ${a.empresa || "-"}${a.setor ? ` (${a.setor})` : ""}`,
      `*Equipe:* ${a.colaboradores || "-"} pessoas`,
      `*Preciso de:* ${lista(a.necessidade).join(", ") || "-"}`,
      `*O que mais toma tempo hoje:* ${a.dor || "-"}`,
      `*Quando quero começar:* ${a.quando || "-"}`,
      `*Orçamento escolhido:* ${a.investimento || "-"}`,
    ];
    if (a.custo_estimado) linhas.push(`*Custo estimado do trabalho manual:* ${brl(a.custo_estimado)} por mês`);
    const wa = waLink(linhas.join("\n"));

    const box = document.createElement("div");
    box.className = "result step-in";
    box.innerHTML = `<div class="ok" aria-hidden="true">✓</div>`;
    const h = document.createElement("h2"); h.id = "apl-title";
    h.textContent = `Pronto, ${nome}! Agora é só enviar.`;
    const p = document.createElement("p"); p.className = "muted";
    p.textContent = wa
      ? "Vamos abrir o WhatsApp da Zunkuft com o resumo das suas respostas já escrito. Toque em enviar e o orçamento chega por lá."
      : `Recebemos suas respostas. Vamos te chamar no WhatsApp ${a.whatsapp || ""} em instantes.`;
    box.append(h, p);
    if (wa) {
      const el = document.createElement("a");
      el.className = "btn btn-primary"; el.href = wa; el.textContent = "Abrir o WhatsApp";
      box.append(el);
      setTimeout(() => { location.href = wa; }, reduce ? 300 : 1400);
    }
    body.replaceChildren(box);
    store.del("zk_aplicacao");
    a = {};
    i = 0;
    parcialEnviado = false;
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); goNext(); });
  back.addEventListener("click", () => { if (i > 0) { i--; render(); } });
  $("[data-close]", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  const open = (extra) => {
    if (a.necessidade) a.necessidade = lista(a.necessidade).filter((x) => SOLUCOES.includes(x)); // rascunho antigo
    Object.assign(a, extra || {});
    save();
    i = 0;
    render();
    dlg.showModal();
  };
  $$("[data-aplicar]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    const extra = {};
    if (b.hasAttribute("data-from-calc") && custoMensal) extra.custo_estimado = Math.round(custoMensal);
    open(extra);
  }));
  if (location.hash === "#aplicar") open();

  /* Pacotes prontos */
  $$("[data-comprar]").forEach((b) => {
    const key = b.dataset.comprar;
    const nomePacote = b.dataset.nome || key;
    const pay = C.pagamentos && C.pagamentos[key];
    const wa = waLink(`Olá! Quero contratar o pacote ${nomePacote} da Zunkuft.`);
    if (pay || wa) {
      b.href = pay || wa; b.target = "_blank"; b.rel = "noopener";
    } else {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        open({ necessidade: [key === "site" ? "Desenvolvimento de Sites Institucionais" : "Criação de Landing Pages"], investimento: "Até R$ 3 mil" });
      });
    }
  });
})();
