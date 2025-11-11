// src/game/OpponentSettingsPage.ts
import { renderGamePage } from '../../../game/GamePage';
import { openGameSettingsModal } from '../../../game/Gmaesettings';
import Rgtranslations from '../../../languages/RegistrationLanguages';

const currentLang: string | null = localStorage.getItem('lang');

export function renderOpponentSettingsPage() {
  const app = document.getElementById('app');
  if (!app) return;

  // ----------------- Helpers -----------------
  function t(key: keyof typeof Rgtranslations["eng"]): string {
    const lang = (currentLang as keyof typeof Rgtranslations) || 'eng';
    return Rgtranslations[lang]?.[key] || Rgtranslations['eng'][key];
  }

  // ----------------- AI Alias (same as profile mode) -----------------
  const aiAlias = ['CyberBot', 'NeuroPaddle', 'ByteCrusher', 'CodeBreaker', 'PingLord', 'AlgoAce'];
  localStorage.setItem('mode', "singleplayer");
  // ----------------- Render HTML -----------------
  const mode = localStorage.getItem("mode") ;
  if(mode != "profile-singleplayer"){
  app.innerHTML = `
    <div class="relative flex items-center justify-center min-h-screen w-full overflow-hidden 
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
          1 VS 1 Mode
        </h1>
        <p class="text-gray-300 text-sm sm:text-base mb-8">
          Prepare to face
        </p>

        <!-- Difficulty Selection -->
        <div class="mb-8">
          <label for="difficulty" class="block text-lg font-medium text-cyan-300 mb-2">
            Choose Difficulty
          </label>
          <select id="difficulty" 
                  class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-5 py-3 text-white text-lg
                         focus:outline-none focus:ring-2 focus:ring-cyan-400 transition">
            <option value="easy">🟢 Easy</option>
            <option value="medium" selected>🟡 Medium</option>
            <option value="hard">🔴 Hard</option>
          </select>
        </div>

        <!-- Settings Button -->
        <button id="settingsbtn"
                class="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold 
                       text-lg shadow-lg hover:scale-105 hover:shadow-purple-400/50 transition-all mb-8">
          ⚙️ ${t('settings')}
        </button>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row justify-center gap-4">
          <button id="startMatchBtn"
                  class="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-lg 
                         shadow-md hover:scale-105 hover:shadow-cyan-400/60 transition-all">
            ▶ Start Match
          </button>

          <button id="cancelBtn"
                  class="flex-1 py-3 bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl font-semibold text-lg 
                         shadow-md hover:scale-105 hover:shadow-red-400/40 transition-all">
            ✖ Cancel
          </button>
        </div>
      </div>

      <!-- Top Home Button -->
      <button id="homeBtn"
              class="absolute top-5 left-5 px-5 py-2 bg-black/40 backdrop-blur-md rounded-xl border border-pink-500/40
                     hover:border-pink-400 hover:shadow-[0_0_20px_rgba(236,72,153,0.6)] transition-all duration-300
                     text-white font-medium text-base sm:text-lg z-20">
        🏠 Home
      </button>
    </div>
  `;
  }
  else{
    app.innerHTML="waaaaaaa zabi";
  }
  // ----------------- Event Listeners -----------------
  const startBtn = document.getElementById('startMatchBtn') as HTMLButtonElement;
  const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
  const settingsBtn = document.getElementById('settingsbtn') as HTMLButtonElement;
  const homeBtn = document.getElementById('homeBtn') as HTMLButtonElement;
  const difficultySelect = document.getElementById('difficulty') as HTMLSelectElement;

  //  Start Game
  startBtn.onclick = () => {
    const difficulty = difficultySelect.value;
    const opponentSettings = { aiLevel: difficulty, aiName: aiAlias };
    const mode  = "singleplayer";

    localStorage.setItem('opponent_settings', JSON.stringify(opponentSettings));
    localStorage.setItem('mode', mode);

    // Human player is always 'player' in guest mode, followed by all AI opponents
    const queue = ['player', ...aiAlias];

    renderGamePage(mode, queue);
  };

  // ⚙️ Settings
  settingsBtn.onclick = () => {
    openGameSettingsModal("singleplayer");
  };

  // ✖ Cancel
  cancelBtn.onclick = () => {
    history.pushState({}, '', '/guestmode');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // 🏠 Home
  homeBtn.onclick = () => {
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
}
