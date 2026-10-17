import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let time = 0;
    let animationFrameId;

    const animateBg = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      
      for(let i=0; i<3; i++) {
        const radius = 200 + Math.sin(time + i) * 100;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
        gradient.addColorStop(0, `rgba(99, 102, 241, ${0.1 - i*0.02})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      animationFrameId = requestAnimationFrame(animateBg);
    };
    animateBg();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Username and password are required');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok) {
        login(data.token, username);
        navigate('/chat');
      } else {
        setErrorMsg(data.error || 'Authentication failed');
      }
    } catch {
      setErrorMsg('Network error. Is the server running?');
    }
    setLoading(false);
  };

  return (
    <div className="bg-surface text-on-surface selection:bg-primary/30 h-screen w-screen flex items-center justify-center overflow-hidden">
      {/* Background Shader */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <canvas ref={canvasRef} className="w-full h-full"></canvas>
      </div>

      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-lg py-sm bg-surface/40 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-md cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined text-primary text-3xl">memory</span>
          <span className="font-headline-lg text-headline-lg-mobile font-bold text-primary tracking-tighter glowing-text">Hindsight</span>
        </div>
      </nav>

      {/* Auth Container */}
      <main className="relative z-10 w-full max-w-sm px-md animate__animated animate__fadeInUp">
        <div className="glass-card p-xl rounded-2xl flex flex-col items-center">
          
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-md border border-primary/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <span className="material-symbols-outlined text-primary text-4xl">{isLogin ? 'lock' : 'person_add'}</span>
          </div>

          <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold mb-lg text-center">
            {isLogin ? 'Secure Authentication' : 'Create Identity'}
          </h2>
          
          <div className="w-full text-error font-body-sm text-center mb-md min-h-[20px]">{errorMsg}</div>
          
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-md">
            <div className="flex flex-col gap-xs">
              <label className="font-label-mono text-label-mono text-outline">USERNAME</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-sm text-outline">person</span>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required 
                  autoComplete="username" 
                  className="w-full bg-surface-container/50 border border-white/10 rounded-lg py-sm pl-xl pr-md text-on-surface font-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/50" 
                  placeholder="Enter your username" 
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-xs">
              <label className="font-label-mono text-label-mono text-outline">PASSWORD</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-sm text-outline">key</span>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  autoComplete={isLogin ? 'current-password' : 'new-password'} 
                  className="w-full bg-surface-container/50 border border-white/10 rounded-lg py-sm pl-xl pr-md text-on-surface font-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/50" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button disabled={loading} type="submit" className="btn-3d w-full py-sm mt-sm rounded-lg font-bold text-on-primary font-body-md flex items-center justify-center gap-sm disabled:opacity-50">
              {isLogin ? 'Authenticate' : 'Register'}
              <span className="material-symbols-outlined text-sm">{isLogin ? 'login' : 'how_to_reg'}</span>
            </button>
          </form>

          <div className="w-full mt-lg pt-md border-t border-white/10 text-center">
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
              className="font-body-sm text-outline hover:text-primary transition-colors focus:outline-none"
            >
              {isLogin ? 'Create new identity →' : '← Return to Authentication'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
