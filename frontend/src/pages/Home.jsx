import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppNavbar from '../components/AppNavbar';
import { 
  CommandLineIcon, 
  VideoCameraIcon, 
  CodeBracketIcon,
  CpuChipIcon,
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

export default function Home() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-indigo-200 overflow-hidden relative">
      <AppNavbar />

      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-indigo-200/40 to-purple-200/40 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-gradient-to-bl from-blue-200/40 to-teal-100/40 blur-[120px] pointer-events-none -z-10" />

      <main className="pt-32 md:pt-40 pb-20 px-6 max-w-[1400px] mx-auto">
        
        {/* HERO SECTION */}
        <section className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-600 tracking-wide uppercase">
            <SparklesIcon className="w-4 h-4 text-indigo-500" />
            Introducing RealtimeGroup 2.0
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.95] text-slate-900">
            The workspace for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
              modern engineering.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-500 max-w-3xl leading-relaxed font-medium mt-4">
            Combine synchronous video, real-time code collaboration, and instant terminal access in a single, beautiful interface. Stop context switching.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
            <Link 
              to={user ? '/groups' : '/signup'} 
              className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white font-bold rounded-full overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-slate-900/20 active:scale-95"
            >
              <span className="relative z-10">{user ? 'Go to Dashboard' : 'Start Building Free'}</span>
              <ArrowRightIcon className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
            
            <Link 
              to="/login" 
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-slate-700 font-bold rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all hover:shadow-sm"
            >
              Sign In
            </Link>
          </div>
        </section>

        {/* MOCKUP SHOWCASE */}
        <section className="mt-24 md:mt-32 relative perspective-[2000px]">
          <div className="absolute inset-0 bg-gradient-to-t from-[#fafafa] via-transparent to-transparent z-10 h-full w-full pointer-events-none translate-y-[20%]" />
          <div className="relative rounded-[2rem] md:rounded-[3rem] border border-slate-200/60 bg-white/50 backdrop-blur-2xl p-2 shadow-2xl shadow-slate-200/50 transform rotate-x-[5deg] translate-y-4 hover:rotate-x-0 hover:translate-y-0 transition-all duration-700 ease-out overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-12 bg-slate-100/80 backdrop-blur-md flex items-center px-6 gap-2 border-b border-slate-200/50">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="mx-auto px-4 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-400 font-mono font-medium shadow-sm">workspace / main.js</div>
            </div>
            
            <div className="pt-12 grid grid-cols-1 md:grid-cols-4 min-h-[400px] md:min-h-[600px] bg-[#0d1117] rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border border-slate-800">
               {/* Sidebar mock */}
               <div className="hidden md:flex flex-col border-r border-slate-800 bg-[#161b22] p-4 text-slate-400 font-mono text-sm space-y-2">
                 <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Explorer</div>
                 <div className="flex items-center gap-2 text-indigo-400"><CodeBracketIcon className="w-4 h-4" /> index.js</div>
                 <div className="flex items-center gap-2 hover:text-slate-200"><CommandLineIcon className="w-4 h-4" /> terminal.sh</div>
                 <div className="flex items-center gap-2 hover:text-slate-200"><VideoCameraIcon className="w-4 h-4" /> room.rtc</div>
               </div>
               {/* Editor mock */}
               <div className="md:col-span-3 p-6 md:p-8 font-mono text-sm md:text-base leading-relaxed text-slate-300 relative">
                  <div className="text-pink-400">import</div> <span className="text-purple-400">{`{ io }`}</span> <span className="text-pink-400">from</span> <span className="text-green-300">'socket.io-client'</span>;
                  <br /><br />
                  <div className="text-pink-400">const</div> <span className="text-blue-300">socket</span> = <span className="text-amber-200">io</span>(<span className="text-green-300">'wss://realtime.group'</span>);
                  <br /><br />
                  <span className="text-blue-300">socket</span>.<span className="text-amber-200">on</span>(<span className="text-green-300">'connect'</span>, () <span className="text-pink-400">{`=>`}</span> {`{`}
                  <br />
                  &nbsp;&nbsp;<span className="text-slate-500">// Ready to build together</span>
                  <br />
                  &nbsp;&nbsp;<span className="text-blue-300">console</span>.<span className="text-amber-200">log</span>(<span className="text-green-300">'Joined secure workspace.'</span>);
                  <br />
                  {`}`});
                  
                  {/* Fake cursors */}
                  <div className="absolute top-32 left-40 flex flex-col items-center animate-pulse">
                    <svg width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500 -ml-2 -mt-2">
                      <path d="M2.56942 22.3831L0.866025 1.50346C0.710777 -0.399581 3.0308 -1.13459 3.99264 0.512686L16.4805 21.8906C17.4423 23.5379 15.6568 25.2155 14.072 24.1506L8.50352 20.4093C8.04024 20.098 7.44186 20.0886 6.96347 20.3854L2.56942 22.3831Z" fill="currentColor"/>
                    </svg>
                    <div className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap mt-1">Sarah</div>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* BENTO BOX FEATURES */}
        <section className="mt-32 md:mt-48">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
              Everything you need.<br/>Nothing you don't.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            
            {/* Big Card 1 */}
            <div className="md:col-span-2 relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-shadow group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <VideoCameraIcon className="w-48 h-48 text-indigo-600" />
              </div>
              <div className="relative z-10 h-full flex flex-col justify-end">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                  <VideoCameraIcon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Immersive Meetings</h3>
                <p className="text-slate-500 font-medium max-w-md">High-definition WebRTC video calls built right into your coding environment. Talk face-to-face while you debug.</p>
              </div>
            </div>

            {/* Small Card 1 */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-sm hover:shadow-xl transition-shadow text-white group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <CommandLineIcon className="w-32 h-32 text-emerald-400" />
              </div>
              <div className="relative z-10 h-full flex flex-col justify-end">
                <div className="w-12 h-12 bg-slate-800 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 border border-slate-700">
                  <CommandLineIcon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Native Terminal</h3>
                <p className="text-slate-400 font-medium">Full bash access. Run npm, git, and python exactly like your local machine.</p>
              </div>
            </div>

            {/* Small Card 2 */}
            <div className="relative overflow-hidden rounded-3xl bg-indigo-50 border border-indigo-100 p-8 shadow-sm hover:shadow-xl transition-shadow group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <CpuChipIcon className="w-32 h-32 text-indigo-600" />
              </div>
              <div className="relative z-10 h-full flex flex-col justify-end">
                <div className="w-12 h-12 bg-white text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <CpuChipIcon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">VS Code Engine</h3>
                <p className="text-slate-600 font-medium">Powered by Monaco. Syntax highlighting, auto-complete, and multi-cursor sync.</p>
              </div>
            </div>

            {/* Big Card 2 */}
            <div className="md:col-span-2 relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-shadow group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <CodeBracketIcon className="w-48 h-48 text-pink-500" />
              </div>
              <div className="relative z-10 h-full flex flex-col justify-end">
                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mb-6 border border-pink-100">
                  <CodeBracketIcon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Git Integration</h3>
                <p className="text-slate-500 font-medium max-w-md">Import repositories directly from GitHub. Edit code collaboratively, test it in the terminal, and push changes back instantly.</p>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white mt-20">
        <div className="max-w-[1400px] mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
               <img src="/realtime-logo.svg" alt="Logo" className="w-4 h-4 invert" />
            </div>
            <span className="font-bold text-slate-900">RealtimeGroup</span>
          </div>
          <div className="text-sm font-medium text-slate-500">
            &copy; {new Date().getFullYear()} RealtimeGroup Platform. Designed for modern teams.
          </div>
          <div className="flex gap-6 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-slate-900 transition-colors">Twitter</a>
            <a href="#" className="hover:text-slate-900 transition-colors">GitHub</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
