import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Rainbow Gradient Background */}
      <div className="absolute inset-0 rainbow-gradient"></div>
      
      {/* Geometric Overlay */}
      <div className="absolute inset-0 geometric-overlay"></div>
      
      {/* Sacred Geometry Elements */}
      <div className="sacred-pattern top-10 left-10 w-32 h-32 border-cyan-400 opacity-30"></div>
      <div className="sacred-pattern top-20 right-20 w-48 h-48 border-purple-400 opacity-20" style={{animationDelay: '2s'}}></div>
      <div className="sacred-pattern bottom-20 left-20 w-64 h-64 border-pink-400 opacity-25" style={{animationDelay: '4s'}}></div>
      <div className="sacred-pattern bottom-10 right-10 w-40 h-40 border-green-400 opacity-30" style={{animationDelay: '6s'}}></div>
      
      {/* Flowing Rainbow Watermarks */}
      <div className="watermark top-1/4 left-1/4 rainbow-gradient w-96 h-96 rounded-full opacity-10 blur-3xl"></div>
      <div className="watermark top-3/4 right-1/4 rainbow-gradient w-80 h-80 rounded-full opacity-10 blur-3xl" style={{animationDelay: '3s'}}></div>
      <div className="watermark top-1/2 left-1/2 rainbow-gradient w-64 h-64 rounded-full opacity-10 blur-3xl transform -translate-x-1/2 -translate-y-1/2" style={{animationDelay: '1.5s'}}></div>
      
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('/bg-pattern.png')] opacity-20"></div>
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <main className="max-w-6xl w-full">
          
          {/* Header Section */}
          <div className="text-center mb-12">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rainbow-gradient rounded-2xl flex items-center justify-center shadow-2xl glow-effect">
                <span className="text-4xl font-black text-white drop-shadow-lg">H</span>
              </div>
            </div>
            
            <h1 className="text-7xl font-black text-white mb-4 tracking-tight drop-shadow-2xl">
              HEADY
              <span className="block text-4xl font-bold rainbow-gradient bg-clip-text text-transparent mt-2">WEB PLATFORM</span>
            </h1>
            
            <p className="text-2xl text-gray-300 mb-4 font-semibold">
              Intelligent Web Platform with HeadySoul Integration
            </p>
            
            <p className="text-xl text-gray-400 font-medium">
              Powered by Comet & Chromium with Intelligent Squash Merge
            </p>
          </div>
          
          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {/* HeadyAI-IDE */}
            <div className="rainbow-gradient/20 backdrop-blur-lg border border-white/30 rounded-2xl p-8 hover:border-white/50 transition-all duration-300 hover:transform hover:scale-105 glow-effect">
              <div className="w-16 h-16 rainbow-gradient rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl font-black text-white drop-shadow-lg">AI</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-lg">HeadyAI-IDE</h3>
              <p className="text-gray-200 text-lg leading-relaxed">Advanced AI-powered development environment with intelligent code completion and refactoring</p>
            </div>
            
            {/* HeadyBuddy */}
            <div className="rainbow-gradient/20 backdrop-blur-lg border border-white/30 rounded-2xl p-8 hover:border-white/50 transition-all duration-300 hover:transform hover:scale-105 glow-effect" style={{animationDelay: '1s'}}>
              <div className="w-16 h-16 rainbow-gradient rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl font-black text-white drop-shadow-lg">BU</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-lg">HeadyBuddy</h3>
              <p className="text-gray-200 text-lg leading-relaxed">Intelligent AI assistant companion for enhanced productivity and workflow automation</p>
            </div>
            
            {/* HeadySoul */}
            <div className="rainbow-gradient/20 backdrop-blur-lg border border-white/30 rounded-2xl p-8 hover:border-white/50 transition-all duration-300 hover:transform hover:scale-105 glow-effect" style={{animationDelay: '2s'}}>
              <div className="w-16 h-16 rainbow-gradient rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl font-black text-white drop-shadow-lg">SO</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-lg">HeadySoul</h3>
              <p className="text-gray-200 text-lg leading-relaxed">Socratic reasoning engine for intelligent decision making and problem solving</p>
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <div className="rainbow-gradient px-8 py-4 rounded-full shadow-2xl glow-effect">
              <span className="text-white font-black text-lg drop-shadow-lg">✅ All Systems Operational</span>
            </div>
            <div className="rainbow-gradient px-8 py-4 rounded-full shadow-2xl glow-effect" style={{animationDelay: '0.5s'}}>
              <span className="text-white font-black text-lg drop-shadow-lg">🚀 HCFP Active</span>
            </div>
            <div className="rainbow-gradient px-8 py-4 rounded-full shadow-2xl glow-effect" style={{animationDelay: '1s'}}>
              <span className="text-white font-black text-lg drop-shadow-lg">🧠 HCAutoFlow Running</span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <a 
              href="/buddy" 
              className="rainbow-gradient text-white px-8 py-4 rounded-xl font-black text-lg hover:transform hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-3xl glow-effect"
            >
              🤖 HeadyBuddy
            </a>
            <a 
              href="/ide" 
              className="rainbow-gradient text-white px-8 py-4 rounded-xl font-black text-lg hover:transform hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-3xl glow-effect" style={{animationDelay: '0.3s'}}
            >
              🧠 HeadyAI-IDE
            </a>
            <a 
              href="/soul" 
              className="rainbow-gradient text-white px-8 py-4 rounded-xl font-black text-lg hover:transform hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-3xl glow-effect" style={{animationDelay: '0.6s'}}
            >
              🎯 HeadySoul
            </a>
          </div>
          
          {/* Footer */}
          <div className="text-center text-gray-400 text-lg">
            <p className="mb-2">🌐 Production: <a href="https://headyme.com" className="text-cyan-400 hover:text-cyan-300 font-semibold">headyme.com</a></p>
            <p>🎛️ Manager: <a href="http://manager.headyme.com" className="text-purple-400 hover:text-purple-300 font-semibold">manager.headyme.com</a></p>
          </div>
          
        </main>
      </div>
    </div>
  );
}
