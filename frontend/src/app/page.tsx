import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 sm:p-24 relative overflow-hidden bg-[#0a0a0a] text-white">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[0%] left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[150px]" />
        <div className="absolute bottom-[0%] right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[150px]" />
      </div>

      <main className="relative z-10 w-full max-w-6xl flex flex-col items-center text-center mt-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium text-blue-300 rounded-full glass animate-fade-in-up">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Sistema Em Construção 1.0
        </div>

        <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          O Controle Total do Seu <span className="text-gradient">Progresso</span>
        </h1>

        <p className="max-w-2xl text-lg sm:text-xl text-zinc-400 mb-16 leading-relaxed">
          O seu centro de controle para medir métricas, estabelecer desafios e registrar suas vitórias. Acesse as áreas abaixo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl text-left">
          <Link href="/dashboard" className="group flex flex-col p-8 glass rounded-3xl border border-white/5 hover:border-blue-500/50 hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">1. Dashboard</h2>
            <p className="text-zinc-400">Acompanhe as estatísticas completas, veja os gráficos de evolução da semana e a taxa de sucesso das metas.</p>
          </Link>

          <Link href="/logs" className="group flex flex-col p-8 glass rounded-3xl border border-white/5 hover:border-green-500/50 hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center mb-6 text-green-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">2. Check-in Diário (Logs)</h2>
            <p className="text-zinc-400">Acabou de realizar algo? Lance aqui esse valor selecionando a meta e o dia para computar.</p>
          </Link>

          <Link href="/goals" className="group flex flex-col p-8 glass rounded-3xl border border-white/5 hover:border-purple-500/50 hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">3. Criar Desafio (Goals)</h2>
            <p className="text-zinc-400">Associe uma de suas métricas padrão a um período fixo e determine qual é o seu Alvo.</p>
          </Link>

          <Link href="/metrics" className="group flex flex-col p-8 glass rounded-3xl border border-white/5 hover:border-orange-500/50 hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center mb-6 text-orange-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">4. Métrica Raiz (Metrics)</h2>
            <p className="text-zinc-400">O que você quer medir? Adicione a unidade antes de estipularmos um desafio em cima.</p>
          </Link>
        </div>
      </main>

      <footer className="absolute bottom-8 text-sm text-zinc-500 whitespace-nowrap z-10 text-center">
        Desenvolvido para <span className="text-zinc-300">Alta Performance</span>.
      </footer>
    </div>
  );
}
