/// 404 error page 
import ErrorPagetranslation from '../languages/ErrorPagetranslation'
export function NotFoundPage() {

const defaultLang = 'eng';
 const currentLang = localStorage.getItem('lang') || defaultLang;
   function t(key: keyof typeof ErrorPagetranslation['eng']): string {
    return ErrorPagetranslation[currentLang as keyof typeof ErrorPagetranslation][key] || '';
  }
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
  <div class="relative flex flex-col items-center justify-center h-screen w-full overflow-hidden bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white">
        <!-- Header -->
    <!-- Background Grid & Glow -->
    <div class="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')] opacity-10"></div>
    <div class="fixed top-0 left-0 w-full h-full bg-gradient-to-b from-purple-800/20 via-transparent to-blue-800/20 blur-3xl"></div>

    <!-- Big 404 Text -->
    <h1 class="text-[120px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.8)] animate-pulse z-10">
      404
    </h1>

    <!-- Subtext -->
    <p class="text-2xl text-gray-300 mt-4 z-10">
          ${t('nofound')}
    </p>

    <!-- Animated Divider -->
    <div class="mt-8 w-32 h-[2px] bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-pulse rounded-full z-10"></div>

    <!-- Back Home Button -->
    <button id="backHome"
      class="mt-10 px-8 py-4 text-xl font-bold rounded-2xl bg-black/40 backdrop-blur-lg border border-purple-500/40 
             shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(168,85,247,0.8)]
             hover:border-purple-400 transition-all duration-300 ease-out hover:scale-105 z-10">
      🔙  ${t('backhome')}
    </button>

    <!-- Footer Glow -->
    <div class="absolute bottom-0 w-full h-40 bg-gradient-to-t from-purple-900/60 via-transparent to-transparent blur-2xl"></div>
  </div>
  `;

  // Button behavior
  document.getElementById('backHome')?.addEventListener('click', () => {
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}
