import HmTranslation from './languages/homeLanguages';

const defaultLang = 'eng';
const currentLang = localStorage.getItem('lang') || defaultLang;

export function renderLandingPage() {
  function t(key: keyof typeof HmTranslation['eng']): string {
    return HmTranslation[currentLang as keyof typeof HmTranslation][key] || '';
  }

  const app = document.getElementById('app');
  if (!app) return;

  const isLoggedIn = localStorage.getItem('user') !== null;
  const username = localStorage.getItem('username') || '';

  app.innerHTML = `
  <div class="relative min-h-screen w-screen bg-black overflow-hidden flex flex-col">
    
    <!-- Background Gradient & Texture -->
    <div class="absolute inset-0 bg-gradient-to-br from-purple-900 via-black to-blue-900 opacity-80 z-0"></div>
    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')] opacity-10 z-0"></div>

    <!-- Futuristic Light Beam -->
    <div class="absolute inset-0 flex items-center justify-center z-0">
      <div class="h-[200%] w-[2px] bg-cyan-400 blur-2xl animate-pulse"></div>
    </div>

    <!-- Header -->
    <header class="relative z-20 flex items-center justify-between h-[12vh] px-[5%] text-white">
      <span class="font-black text-xl sm:text-2xl">
        PONGFR<span class="text-cyan-400">EE</span>
      </span>

      <div class="flex gap-4 items-center">
        <select id="languageSelect" class="text-sm bg-purple-900 text-white px-3 py-2 rounded-md border border-purple-600 focus:outline-none">
          <option value="eng" ${currentLang === 'eng' ? 'selected' : ''}>English</option>
          <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>Français</option>
          <option value="pl" ${currentLang === 'pl' ? 'selected' : ''}>Polski</option>
          <option value="es" ${currentLang === 'es' ? 'selected' : ''}>Español</option>
        </select>
        ${isLoggedIn ? `
          <button onclick="location.href='/dashboard'" 
                  class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
            👤 ${username}
          </button>
        ` : `
          <button onclick="location.href='/login'" 
                  class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
            🔐   ${t('login')}
          </button>
        `}
      </div>
    </header>

    <!-- Main Section -->
    <main class="relative z-10 flex-grow flex flex-col justify-center items-center text-center px-4">
      <div class="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl rounded-2xl p-10 max-w-xl w-full mx-auto">
        <h1 class="text-5xl sm:text-4xl font-bold text-cyan-400 drop-shadow-xl tracking-wide mb-6 neon-text">
          ${t('title')}
        </h1>
        <p class="text-lg text-gray-300 mb-8">
          ${t('subtitle')}
        </p>
        <div class="flex flex-col space-y-4">
          <button id="guestmode" 
            class="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-lg font-semibold rounded-lg 
                   hover:from-purple-500 hover:to-cyan-500 shadow-lg transition-all duration-300">
            ▶ ${t('startgameGuest')}
          </button>
          <button id="start" 
            class="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-lg font-semibold rounded-lg 
                   hover:from-blue-500 hover:to-purple-500 shadow-lg transition-all duration-300">
            ▶ ${t('startGameProfile')}
          </button>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="relative z-10 flex justify-center items-center h-[10vh] text-sm text-white opacity-80">
      2025 © All rights reserved — Transcendence
    </footer>

    <!-- Floating Decorations -->
    <div class="absolute top-1/3 left-10 h-28 w-4 bg-cyan-500 rounded-lg shadow-lg shadow-cyan-500/50 z-0 animate-pulse"></div>
    <div class="absolute top-2/3 right-10 h-28 w-4 bg-pink-500 rounded-lg shadow-lg shadow-pink-500/50 z-0 animate-pulse"></div>
    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 bg-white rounded-full shadow-lg animate-bounce z-0"></div>
  </div>
  `;

  /** 🌐 Language Selector **/
  document.getElementById('languageSelect')?.addEventListener('change', (e) => {
    const selectedLang = (e.target as HTMLSelectElement).value;
    localStorage.setItem('lang', selectedLang);
    location.reload();
  });

  /** 🚀 Navigation Buttons **/
  document.getElementById('guestmode')?.addEventListener('click', () => {
    history.pushState({}, '', '/guestmode');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  document.getElementById('start')?.addEventListener('click', () => {
    const isLoggedIn = localStorage.getItem('user') !== null;
    if (isLoggedIn) {
      history.pushState({}, '', '/profile-game');
    } else {
      history.pushState({}, '', '/login');
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}
