import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as THREE from 'three';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const shaderCanvasRef = useRef(null);
  const threejsContainerRef = useRef(null);

  useEffect(() => {
    // Intersection Observer for fade-in animations
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.classList.add('animate__animated', 'animate__fadeInUp');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // WebGL Shader Background
    const canvas = shaderCanvasRef.current;
    if (!canvas) return;

    function syncSize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(canvas);
    }
    syncSize();

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
    const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = v_texCoord;
    vec3 color1 = vec3(0.07, 0.07, 0.1); 
    vec3 color2 = vec3(0.1, 0.1, 0.2); 
    vec3 accent = vec3(0.39, 0.4, 0.95); 

    float n = noise(uv + u_time * 0.05);
    float glow = sin(uv.x * 10.0 + u_time) * cos(uv.y * 10.0 + u_time) * 0.5 + 0.5;
    
    vec3 finalColor = mix(color1, color2, uv.y);
    finalColor += accent * glow * 0.1;
    
    float drift = sin(u_time * 0.2 + uv.x * 3.0) * 0.5 + 0.5;
    finalColor = mix(finalColor, finalColor * 1.2, drift * 0.2);

    gl_FragColor = vec4(finalColor, 1.0);
}`;
    function cs(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    
    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    
    const uTime = gl.getUniformLocation(prog, 'u_time');
    
    let animationFrameId;
    function render(t) {
      if (typeof ResizeObserver === 'undefined') syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    }
    render(0);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    // Three.js Neural Network Animation
    const container = threejsContainerRef.current;
    if (!container) return;
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 800;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const particlesCount = 40;
    const spheres = [];
    const geometry = new THREE.SphereGeometry(0.05, 16, 16);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0x6366f1, 
        emissive: 0x6366f1, 
        emissiveIntensity: 0.5,
        shininess: 100 
    });

    for (let i = 0; i < particlesCount; i++) {
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.x = (Math.random() - 0.5) * 10;
        sphere.position.y = (Math.random() - 0.5) * 10;
        sphere.position.z = (Math.random() - 0.5) * 10;
        group.add(sphere);
        spheres.push(sphere);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x6366f1, 1, 100);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    camera.position.z = 8;

    let animationFrameId;
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        group.rotation.y += 0.002;
        group.rotation.x += 0.001;
        
        spheres.forEach((s, i) => {
            s.position.y += Math.sin(Date.now() * 0.001 + i) * 0.002;
        });

        renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="bg-background text-on-surface font-body-md overflow-x-hidden selection:bg-primary/30">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-lg py-sm bg-surface/70 backdrop-blur-xl border-b border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
        <div className="flex items-center gap-md cursor-pointer" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined text-primary text-3xl">memory</span>
          <span className="font-headline-lg text-headline-lg font-bold text-primary tracking-tighter glowing-text">Hindsight</span>
        </div>
        <div className="flex items-center gap-lg">
          <div className="hidden md:flex items-center gap-lg font-body-md text-body-md mr-md">
            <button 
              onClick={() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth' })} 
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
            >
              Scale
            </button>
            <button 
              onClick={() => (document.getElementById('capabilities') || document.getElementById('features'))?.scrollIntoView({ behavior: 'smooth' })} 
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
            >
              Capabilities
            </button>
            <button 
              onClick={() => document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' })} 
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
            >
              Dashboard
            </button>
          </div>
          <div className="flex items-center gap-md">
            <button 
              onClick={() => navigate(user ? '/chat' : '/login')}
              className="flex items-center gap-sm bg-primary/10 pl-sm pr-md py-xs rounded-full border border-primary/20 cursor-pointer hover:bg-primary/20 active:scale-95 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-primary overflow-hidden flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary text-sm">person</span>
              </div>
              <span className="font-label-mono text-label-mono text-primary font-bold">
                {user ? user.username : 'Login'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative w-full h-screen min-h-[800px] flex items-center justify-center overflow-hidden pt-xl">
        <div className="absolute inset-0 w-full h-full block">
          <canvas ref={shaderCanvasRef} className="block w-full h-full" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 mix-blend-screen scale-125">
          <div className="w-[800px] h-[800px] block">
             <div ref={threejsContainerRef} className="w-full h-full"></div>
          </div>
        </div>

        <div className="relative z-10 max-w-4xl px-lg text-center">
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-md fade-in-up">
            The <span className="text-primary italic">Intelligence</span> layer for your Operations.
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-xl max-w-2xl mx-auto fade-in-up delay-1">
            Hindsight indexes your incidents, memory fragments, and operational logs into a searchable, neural context for your team. Empower your architects with pre-cog infrastructure awareness.
          </p>
          <div className="flex flex-col sm:flex-row gap-md justify-center fade-in-up delay-2">
            <button onClick={() => navigate('/chat')} className="btn-3d px-xl py-md rounded-xl font-bold text-on-primary flex items-center justify-center gap-sm mx-auto shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer">
              Launch Console
              <span className="material-symbols-outlined">bolt</span>
            </button>
            <button onClick={() => navigate('/vault')} className="px-xl py-md rounded-xl font-bold text-on-surface glass-card flex items-center justify-center gap-sm mx-auto hover:bg-white/10 active:scale-95 transition-all cursor-pointer border border-white/10">
              Explore Vault
              <span className="material-symbols-outlined">database</span>
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section id="stats" className="py-xl bg-surface-container-lowest relative z-10">
        <div className="max-w-container-max mx-auto px-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
            <div className="text-center p-lg fade-in-up cursor-pointer hover:bg-white/5 rounded-xl transition-all" onClick={() => navigate('/vault')}>
              <div className="font-headline-xl text-headline-xl text-primary glowing-text mb-sm">12k+</div>
              <div className="font-label-mono text-label-mono uppercase tracking-[0.2em] text-outline">Incidents Indexed</div>
            </div>
            <div className="text-center p-lg fade-in-up delay-1 cursor-pointer hover:bg-white/5 rounded-xl transition-all" onClick={() => navigate('/vault')}>
              <div className="font-headline-xl text-headline-xl text-secondary glowing-text mb-sm">45m</div>
              <div className="font-label-mono text-label-mono uppercase tracking-[0.2em] text-outline">Memory Fragments</div>
            </div>
            <div className="text-center p-lg fade-in-up delay-2 cursor-pointer hover:bg-white/5 rounded-xl transition-all" onClick={() => navigate('/analytics')}>
              <div className="font-headline-xl text-headline-xl text-tertiary glowing-text mb-sm">&lt;1ms</div>
              <div className="font-label-mono text-label-mono uppercase tracking-[0.2em] text-outline">Sub-millisecond Latency</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features / Capabilities */}
      <section id="capabilities" className="py-xl relative overflow-hidden">
        <div id="features" className="max-w-container-max mx-auto px-xl">
          <div className="mb-xl text-center fade-in-up">
            <span className="font-label-mono text-label-mono text-primary bg-primary/10 px-md py-xs rounded-full border border-primary/20">OPERATIONAL CAPABILITIES</span>
            <h2 className="font-headline-lg text-headline-lg mt-md">Engineered for Hyper-scale</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <div 
              onClick={() => navigate('/chat')}
              className="glass-card p-xl rounded-xl flex flex-col items-start gap-md group fade-in-up cursor-pointer hover:border-secondary/50 hover:bg-white/5 transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
              </div>
              <h3 className="font-headline-lg-mobile text-headline-lg-mobile">CascadeFlow Routing</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Intelligently distribute incident context to the most qualified nodes. Reduced cognitive load through deterministic data flow.
              </p>
              <div className="mt-auto pt-md flex items-center gap-xs font-label-mono text-label-mono text-secondary group-hover:translate-x-1 transition-transform">
                  Launch Chat <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </div>
            </div>

            <div 
              onClick={() => navigate('/vault')}
              className="glass-card p-xl rounded-xl flex flex-col items-start gap-md group fade-in-up delay-1 cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <h3 className="font-headline-lg-mobile text-headline-lg-mobile">Neural Persistence</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Historical data isn't just stored; it's learned. Every micro-outage strengthens the predictive model of your architecture.
              </p>
              <div className="mt-auto pt-md flex items-center gap-xs font-label-mono text-label-mono text-primary group-hover:translate-x-1 transition-transform">
                  Open Vault <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </div>
            </div>

            <div 
              onClick={() => navigate('/analytics')}
              className="glass-card p-xl rounded-xl flex flex-col items-start gap-md group fade-in-up delay-2 cursor-pointer hover:border-tertiary/50 hover:bg-white/5 transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-tertiary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              </div>
              <h3 className="font-headline-lg-mobile text-headline-lg-mobile">Budget Guardrails</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Dynamic cost-capping for AI inference. Ensure your Ops budget remains stable even during massive system scale events.
              </p>
              <div className="mt-auto pt-md flex items-center gap-xs font-label-mono text-label-mono text-tertiary group-hover:translate-x-1 transition-transform">
                  View Analytics <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section id="dashboard" className="py-xl bg-surface-container-low">
        <div className="max-w-container-max mx-auto px-xl">
          <div className="grid grid-cols-12 gap-lg h-auto min-h-[500px]">
            <div 
              onClick={() => navigate('/analytics')}
              className="col-span-12 lg:col-span-8 glass-card rounded-2xl overflow-hidden relative group p-lg cursor-pointer hover:border-primary/40 transition-all min-h-[300px]"
            >
              <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity">
                <img className="w-full h-full object-cover" alt="System Dashboard" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJU1mxKGVI8Dv1zbe0eSBcWtoh1aaR1dFQ3ZuqdIQcALc4NJEQ9o3kGQnWJnqmlb5KNoOsk_O0ePbpt9BZGUlaHdqf3GgDzs4K4-L8HUQHR1dvwUnKkftxMJroLFG_hJLprXLxOTxhVgY1mZ28ipqlCUusSszNBviVTra2L1KlnRjP-TKFN3EIFiDM1NfOcaHsB_DB5sMx7YH5Cnon9_CkFyxXiQSLJVxi84txPU2Oy6WkZeuhuGW479ZaJKlOgwtWqBXUvslPjA"/>
              </div>
              <div className="relative z-10 flex flex-col justify-end h-full pt-20">
                <span className="bg-secondary/20 text-secondary border border-secondary/30 self-start px-md py-xs rounded-full text-label-mono mb-sm">CORE DASHBOARD</span>
                <h4 className="font-headline-lg text-headline-lg max-w-md">Omniscient View of your Neural Stack</h4>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-lg">
              <div 
                onClick={() => navigate('/analytics')}
                className="flex-1 glass-card rounded-2xl p-lg flex flex-col justify-center items-center text-center cursor-pointer hover:bg-white/5 transition-all"
              >
                <span className="material-symbols-outlined text-primary text-[48px] mb-md">cloud_done</span>
                <div className="font-label-mono text-label-mono text-outline">UPTIME COMMITMENT</div>
                <div className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">99.999%</div>
              </div>
              <div 
                onClick={() => navigate('/settings')}
                className="flex-1 glass-card rounded-2xl overflow-hidden relative cursor-pointer hover:bg-white/5 transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
                <div className="p-lg relative z-10">
                  <h5 className="font-body-md text-body-md font-bold mb-xs">Budget Guardrail Active</h5>
                  <div className="w-full h-2 bg-white/10 rounded-full mt-md overflow-hidden">
                    <div className="h-full bg-primary w-2/3 shadow-[0_0_10px_rgba(192,193,255,0.8)]"></div>
                  </div>
                  <div className="flex justify-between mt-sm text-body-sm text-outline">
                    <span>67% Consumed</span>
                    <span>$420 left</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-xl border-t border-white/5 bg-surface-container-lowest">
        <div className="max-w-container-max mx-auto px-xl">
          <div className="flex flex-col md:flex-row justify-between items-start gap-xl">
            <div className="max-w-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-primary">Hindsight</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-md">
                Deep Space clarity for high-stakes operational intelligence. Managed AI infrastructure for the hyper-vigilant team.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-xl">
              <div className="flex flex-col gap-sm">
                <span className="font-label-mono text-label-mono text-outline uppercase">Resources</span>
                <button onClick={() => navigate('/analytics')} className="font-body-sm text-body-sm text-left hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer text-on-surface-variant">Documentation</button>
                <button onClick={() => navigate('/vault')} className="font-body-sm text-body-sm text-left hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer text-on-surface-variant">Incident Logs</button>
                <button onClick={() => navigate('/settings')} className="font-body-sm text-body-sm text-left hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer text-on-surface-variant">API Reference</button>
              </div>
              <div className="flex flex-col gap-sm">
                <span className="font-label-mono text-label-mono text-outline uppercase">Platform</span>
                <button onClick={() => navigate('/chat')} className="font-body-sm text-body-sm text-left hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer text-on-surface-variant">Console</button>
                <button onClick={() => navigate('/vault')} className="font-body-sm text-body-sm text-left hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer text-on-surface-variant">Neural Hub</button>
                <button onClick={() => navigate('/analytics')} className="font-body-sm text-body-sm text-left hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer text-on-surface-variant">Analytics</button>
                <button onClick={() => navigate('/settings')} className="font-body-sm text-body-sm text-left hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer text-on-surface-variant">Settings</button>
              </div>
              <div className="flex flex-col gap-sm">
                <span className="font-label-mono text-label-mono text-outline uppercase">Legal</span>
                <span className="font-body-sm text-body-sm text-outline">Privacy Policy</span>
                <span className="font-body-sm text-body-sm text-outline">Terms of Service</span>
                <span className="font-body-sm text-body-sm text-outline">99.99% SLA</span>
              </div>
            </div>
          </div>
          <div className="mt-xl pt-lg border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-md">
            <p className="font-label-mono text-label-mono text-outline">© 2026 HINDSIGHT OPS INC. ALL RIGHTS RESERVED.</p>
            <div className="flex items-center gap-lg">
              <span className="font-label-mono text-label-mono text-primary flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> SYSTEMS NOMINAL
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
