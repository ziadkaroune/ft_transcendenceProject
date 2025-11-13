export function GuestPage() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
  <div class="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white px-4 sm:px-6 lg:px-8">
    
    <!-- Background Glow & Grid -->
    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')] opacity-10"></div>
    <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-purple-800/20 via-transparent to-blue-800/20 blur-3xl"></div>

    <!-- Home Button -->
    <button id="homeButton"
      class="absolute top-4 left-4 sm:top-6 sm:left-6 px-4 sm:px-6 py-2 sm:py-3 text-base sm:text-lg md:text-xl font-semibold rounded-xl bg-black/40 backdrop-blur-lg border border-pink-500/40
             hover:border-pink-400 transition-all duration-300 ease-out hover:scale-105 z-30">
      <span class="text-white group-hover:text-pink-300 transition">🏠 Home</span>
    </button>

    <!-- Title -->
    <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 drop-shadow-lg mb-12 sm:mb-16 md:mb-20 z-10 animate-pulse text-center px-2">
      Choose Game Mode
    </h1>

    <!-- Buttons -->
    <div class="flex flex-col md:flex-row gap-6 sm:gap-10 z-20 w-full justify-center items-center">
      <button id="singleMode"
        class="relative group w-4/5 sm:w-auto px-8 sm:px-12 md:px-16 py-6 sm:py-8 md:py-10 text-2xl sm:text-3xl md:text-4xl font-bold rounded-2xl bg-black/40 backdrop-blur-lg border border-purple-500/40 
               shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(168,85,247,0.8)]
               hover:border-purple-400 transition-all duration-300 ease-out hover:scale-105">
        <span class="text-white group-hover:text-purple-300 transition">Single Player</span>
      </button>

      <button id="multiMode"
        class="relative group w-4/5 sm:w-auto px-8 sm:px-12 md:px-16 py-6 sm:py-8 md:py-10 text-2xl sm:text-3xl md:text-4xl font-bold rounded-2xl bg-black/40 backdrop-blur-lg border border-blue-500/40 
               shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-[0_0_40px_rgba(59,130,246,0.8)]
               hover:border-blue-400 transition-all duration-300 ease-out hover:scale-105">
        <span class="text-white group-hover:text-blue-300 transition">Multiplayer</span>
      </button>
    </div>

    <!-- Footer Glow -->
    <div class="absolute bottom-0 w-full h-40 bg-gradient-to-t from-purple-900/60 via-transparent to-transparent blur-2xl"></div>
  </div>
  `;

  //  Route logic
  const isLogIn = localStorage.getItem('isLogIn');
   if(isLogIn === "true"){
        document.getElementById('singleMode')?.classList.add('select-none');
         document.getElementById('singleMode')?.classList.add('hidden');
   }
   else{
      document.getElementById('singleMode')?.classList.add('opacity-1');
       document.getElementById('singleMode')?.classList.add('block');
   }

 
  document.getElementById('singleMode')?.addEventListener('click', () => {
    if(isLogIn === "false" || !isLogIn){
      sessionStorage.setItem('canAccessGame', 'true');
      history.pushState({}, '', '/singlemode');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    
  });

  document.getElementById('multiMode')?.addEventListener('click', () => {
    sessionStorage.setItem('canAccessGame', 'true');
    history.pushState({}, '', '/multimode');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  //  Home button logic
  document.getElementById('homeButton')?.addEventListener('click', () => {
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}
