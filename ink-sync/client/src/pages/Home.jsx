import { Link } from 'react-router-dom';
import { PenTool, Video, MessageSquare, Users, ArrowRight, Sparkles } from 'lucide-react';
import Button from '../components/common/Button';
import Navbar from '../components/common/Navbar';

const Home = () => {
  const features = [
    { icon: PenTool, title: 'Infinite Canvas', desc: 'Draw, sketch, and design on a smooth, real-time collaborative whiteboard.' },
    { icon: Video, title: 'Built-in Meetings', desc: 'Jump into HD video and audio calls without leaving your workspace.' },
    { icon: MessageSquare, title: 'Instant Chat', desc: 'Share links, files, and ideas via chat while you work on the board.' },
    { icon: Users, title: 'Live Presence', desc: 'See exactly where your teammates are working with live cursors.' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 pt-20 pb-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium mb-6 border border-primary-100">
            <Sparkles className="w-4 h-4" />
            Real-Time Collaboration Reimagined
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6">
            Draw. Discuss. <br/>
            <span className="text-primary-600">Collaborate.</span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            A real-time workspace where teams can sketch ideas, meet face-to-face, and build together from anywhere.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button className="text-lg px-8 py-3">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="text-lg px-8 py-3">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Mockup Placeholder */}
        <div className="relative z-10 mt-20 w-full max-w-5xl mx-auto">
          <div className="aspect-video bg-slate-900 rounded-xl shadow-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
             <div className="text-center text-slate-400 p-8">
               <PenTool className="w-16 h-16 mx-auto mb-4 text-primary-500" />
               <p className="text-lg font-medium">InkSync Workspace Preview</p>
               <p className="text-sm text-slate-500">Canvas + Video + Chat</p>
             </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16">Everything you need in one tab</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <feature.icon className="w-10 h-10 text-primary-600 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;