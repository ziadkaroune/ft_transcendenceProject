import ProfileTranslations from '../languages/ProfileLanguages';

// Same AI alias pool as guest mode
const aiAliases = ['CyberBot', 'NeuroPaddle', 'ByteCrusher', 'CodeBreaker', 'PingLord', 'AlgoAce'];

export async function renderProfileGamePage() {
  const app = document.getElementById('app');
  if (!app) return;

  const userStr = localStorage.getItem('user');
  if (!userStr) {
    history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }

  const user = JSON.parse(userStr);
  
  // Translation helper
  const currentLang = localStorage.getItem('lang') || 'eng';
  function t(key: keyof typeof ProfileTranslations['eng']): string {
    return ProfileTranslations[currentLang as keyof typeof ProfileTranslations]?.[key] || ProfileTranslations['eng'][key];
  }

  app.innerHTML = `
    <div class="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden 
                bg-gradient-to-br from-black via-[#090024] to-[#0a0040] text-white px-4 sm:px-8">
      
      <!-- Animated Background Glows -->
      <div class="absolute inset-0">
        <div class="absolute w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-3xl top-[-100px] left-[-100px] animate-pulse"></div>
        <div class="absolute w-[500px] h-[500px] bg-cyan-600/30 rounded-full blur-3xl bottom-[-120px] right-[-120px] animate-pulse"></div>
      </div>

      <!-- Main Card -->
      <div class="relative z-10 max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 
                  rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.3)] p-8 sm:p-10 text-center">

        <!-- Title -->
        <h1 class="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r 
                   from-purple-400 via-pink-400 to-cyan-400 mb-3">
          ${t('playAs')} ${user.display_name || user.username}
        </h1>
        <p class="text-gray-300 text-sm sm:text-base mb-8">
          ${t('matchesRecorded')}
        </p>

        <!-- Difficulty Selection -->
        <div class="mb-8">
          <label for="difficulty" class="block text-lg font-medium text-cyan-300 mb-2">
            ${t('chooseOpponent')}
          </label>
          <select id="difficulty" 
                  class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-5 py-3 text-white text-lg
                         focus:outline-none focus:ring-2 focus:ring-cyan-400 transition">
            <option value="easy">${t('easyAI')}</option>
            <option value="medium" selected>${t('mediumAI')}</option>
            <option value="hard">${t('hardAI')}</option>
          </select>
        </div>

        <!-- Settings Button -->
        <button id="settingsbtn"
                class="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold 
                       text-lg shadow-lg hover:scale-105 hover:shadow-purple-400/50 transition-all mb-4">
          ⚙️ ${t('settings')}
        </button>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row justify-center gap-4">
          <button id="startMatchBtn"
                  class="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-lg 
                         shadow-md hover:scale-105 hover:shadow-cyan-400/60 transition-all">
            ▶ ${t('startMatch')}
          </button>

          <button id="cancelBtn"
                  class="flex-1 py-3 bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl font-semibold text-lg 
                         shadow-md hover:scale-105 hover:shadow-red-400/40 transition-all">
            ✖ ${t('cancel')}
          </button>
        </div>
      </div>

      <!-- Top Home Button -->
      <button id="homeBtn"
              class="absolute top-5 left-5 px-5 py-2 bg-black/40 backdrop-blur-md rounded-xl border border-pink-500/40
                     hover:border-pink-400 hover:shadow-[0_0_20px_rgba(236,72,153,0.6)] transition-all duration-300
                     text-white font-medium text-base sm:text-lg z-20">
        🏠 ${t('home')}
      </button>
    </div>
  `;

  const startBtn = document.getElementById('startMatchBtn') as HTMLButtonElement;
  const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
  const homeBtn = document.getElementById('homeBtn') as HTMLButtonElement;
  const settingsBtn = document.getElementById('settingsbtn') as HTMLButtonElement;
  const difficultySelect = document.getElementById('difficulty') as HTMLSelectElement;
  
  const mode = "profile-singleplayer";
     localStorage.setItem('mode', mode);
  startBtn.onclick = async () => {
    const difficulty = difficultySelect.value;
    const opponentSettings = { aiLevel: difficulty, aiName: aiAliases };
  

    localStorage.setItem('opponent_settings', JSON.stringify(opponentSettings));
 
    localStorage.setItem('authenticated_play', 'true');
    
    console.log('Starting authenticated game for user:', user.username);

    const { renderGamePage } = await import('../game/GamePage');
    const queue = [user.username, ...aiAliases];
    renderGamePage(mode, queue);
  };

  settingsBtn.onclick = async () => {
    const { openGameSettingsModal } = await import('../game/Gmaesettings');
    openGameSettingsModal(mode);
  };

  cancelBtn.onclick = () => {
    history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  homeBtn.onclick = () => {
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
}
