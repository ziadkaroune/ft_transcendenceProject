import ProfileTranslations from '../languages/ProfileLanguages';

const API_URL = 'http://localhost:3103';

export async function renderDashboardPage() {
  const app = document.getElementById('app');
  if (!app) return;

  const userStr = localStorage.getItem('user');
  if (!userStr) {
    history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }

  let user = JSON.parse(userStr);

  // Translation helper
  const currentLang = localStorage.getItem('lang') || 'eng';
  function t(key: keyof typeof ProfileTranslations['eng']): string {
    return ProfileTranslations[currentLang as keyof typeof ProfileTranslations]?.[key] || ProfileTranslations['eng'][key];
  }
  const languageOptions = [
    { value: 'eng', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'pl', label: 'Polski' },
    { value: 'es', label: 'Español' }
  ];

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white p-8">
      <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r 
                     from-purple-400 via-pink-400 to-cyan-400">
            ${t('dashboard')}
          </h1>
          <div class="flex gap-4">
            <select id="dashboardLangSelect"
                    class="px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white">
              ${languageOptions.map(({ value, label }) =>
                `<option value="${value}" ${value === currentLang ? 'selected' : ''}>${label}</option>`
              ).join('')}
            </select>
            <button onclick="location.href='/'" 
                    class="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
              🏠 ${t('home')}
            </button>
            <button id="logoutBtn" 
                    class="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition">
              🚪 ${t('logout')}
            </button>
          </div>
        </div>

        <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-6">
          <div class="flex items-center gap-6">
            <div class="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 
                        flex items-center justify-center text-4xl font-bold">
              <img id="avatarImg" src="" alt="" class="w-24 h-24 rounded-full object-cover" />
            </div>
            <div>
              <h2 id="profileDisplayName" class="text-3xl font-bold">${user.display_name || user.username}</h2>
              <p class="text-gray-400">@${user.username}</p>
              <p id="profileEmail" class="text-sm text-cyan-400">${user.email || ''}</p>
            </div>
          </div>

          <div class="flex gap-6 border-b border-white/10 pb-2">
            <button id="overviewTab"
                    class="px-4 py-2 text-sm sm:text-base font-semibold border-b-2 border-transparent text-white transition-colors">
              ${t('profileOverview')}
            </button>
            <button id="accountTab"
                    class="px-4 py-2 text-sm sm:text-base font-semibold border-b-2 border-transparent text-gray-300 hover:text-white transition-colors">
              ${t('accountSettings')}
            </button>
          </div>

          <div id="overviewPanel" class="space-y-6">
            <div id="statsSection" class="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center">
                <p class="text-gray-400 text-sm mb-2">${t('totalMatches')}</p>
                <p class="text-4xl font-bold text-cyan-400">--</p>
              </div>
              <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center">
                <p class="text-gray-400 text-sm mb-2">${t('wins')}</p>
                <p class="text-4xl font-bold text-green-400">--</p>
              </div>
              <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center">
                <p class="text-gray-400 text-sm mb-2">${t('losses')}</p>
                <p class="text-4xl font-bold text-red-400">--</p>
              </div>
              <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center">
                <p class="text-gray-400 text-sm mb-2">${t('winRate')}</p>
                <p class="text-4xl font-bold text-purple-400">--</p>
              </div>
            </div>

            <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
              <h3 class="text-2xl font-bold mb-4">${t('matchHistory')}</h3>
              <div id="matchHistory" class="space-y-3">
                <p class="text-gray-400 text-center py-8">${t('loading')}</p>
              </div>
            </div>
          </div>

          <div id="accountPanel" class="hidden">
            <form id="accountForm" class="space-y-4">
              <p class="text-gray-300">${t('accountInfoHeading')}</p>
              <div>
                <label for="displayNameField" class="block text-sm font-medium text-cyan-300 mb-2">${t('displayNameLabel')}</label>
                <input id="displayNameField" type="text"
                       class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
              <div>
                <label for="usernameField" class="block text-sm font-medium text-cyan-300 mb-2">${t('usernameLabel')}</label>
                <input id="usernameField" type="text"
                       class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
              <div>
                <label for="emailField" class="block text-sm font-medium text-cyan-300 mb-2">${t('emailLabel')}</label>
                <input id="emailField" type="email"
                       class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
              <p id="accountStatusMsg" class="hidden text-sm"></p>
              <div class="flex flex-col sm:flex-row gap-4 pt-2">
                <button type="submit" id="saveAccountBtn"
                        class="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition">
                  ${t('saveChanges')}
                </button>
                <button type="button" id="deleteAccountBtn"
                        class="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition">
                  ${t('deleteAccount')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  const avatarImg = document.getElementById('avatarImg') as HTMLImageElement | null;
  const profileDisplayName = document.getElementById('profileDisplayName') as HTMLHeadingElement | null;
  const profileEmail = document.getElementById('profileEmail') as HTMLParagraphElement | null;
  const overviewTab = document.getElementById('overviewTab') as HTMLButtonElement | null;
  const accountTab = document.getElementById('accountTab') as HTMLButtonElement | null;
  const overviewPanel = document.getElementById('overviewPanel') as HTMLDivElement | null;
  const accountPanel = document.getElementById('accountPanel') as HTMLDivElement | null;
  const accountForm = document.getElementById('accountForm') as HTMLFormElement | null;
  const displayNameInput = document.getElementById('displayNameField') as HTMLInputElement | null;
  const usernameInput = document.getElementById('usernameField') as HTMLInputElement | null;
  const emailInput = document.getElementById('emailField') as HTMLInputElement | null;
  const accountStatusMsg = document.getElementById('accountStatusMsg') as HTMLParagraphElement | null;
  const deleteAccountBtn = document.getElementById('deleteAccountBtn') as HTMLButtonElement | null;
  const saveAccountBtn = document.getElementById('saveAccountBtn') as HTMLButtonElement | null;

  const setActiveTab = (target: 'overview' | 'account') => {
    if (!overviewPanel || !accountPanel || !overviewTab || !accountTab) return;
    const isOverview = target === 'overview';
    overviewPanel.classList.toggle('hidden', !isOverview);
    accountPanel.classList.toggle('hidden', isOverview);
    overviewTab.classList.toggle('text-white', isOverview);
    overviewTab.classList.toggle('text-gray-300', !isOverview);
    overviewTab.classList.toggle('border-purple-400', isOverview);
    overviewTab.classList.toggle('bg-white/10', isOverview);
    accountTab.classList.toggle('text-white', !isOverview);
    accountTab.classList.toggle('text-gray-300', isOverview);
    accountTab.classList.toggle('border-purple-400', !isOverview);
    accountTab.classList.toggle('bg-white/10', !isOverview);
  };

  overviewTab?.addEventListener('click', () => setActiveTab('overview'));
  accountTab?.addEventListener('click', () => setActiveTab('account'));
  setActiveTab('overview');

  if (avatarImg) {
    avatarImg.src = user.avatar_url ? `${API_URL}${user.avatar_url}` : `${API_URL}/avatars/default.png`;
  }
  displayNameInput && (displayNameInput.value = user.display_name || user.username);
  usernameInput && (usernameInput.value = user.username);
  emailInput && (emailInput.value = user.email || '');

  const showAccountStatus = (type: 'success' | 'error' | 'info', message: string) => {
    if (!accountStatusMsg) return;
    accountStatusMsg.textContent = message;
    accountStatusMsg.classList.remove('hidden', 'text-green-400', 'text-red-400', 'text-cyan-300');
    accountStatusMsg.classList.add(
      type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-cyan-300'
    );
  };

  accountForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!displayNameInput || !usernameInput || !emailInput) return;

    const payload: Record<string, string> = {};
    const newDisplayName = displayNameInput.value.trim();
    const newUsername = usernameInput.value.trim();
    const newEmail = emailInput.value.trim().toLowerCase();

    if (newDisplayName && newDisplayName !== user.display_name) payload.display_name = newDisplayName;
    if (newUsername && newUsername !== user.username) payload.username = newUsername;
    if (newEmail && newEmail !== (user.email || '').toLowerCase()) payload.email = newEmail;

    if (!Object.keys(payload).length) {
      showAccountStatus('info', t('noChanges'));
      return;
    }

    try {
      saveAccountBtn?.setAttribute('disabled', 'true');
      saveAccountBtn?.classList.add('opacity-60', 'cursor-not-allowed');

      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || t('accountError'));
      }

      if (payload.display_name) user.display_name = newDisplayName;
      if (payload.username) user.username = newUsername;
      if (payload.email) user.email = newEmail;

      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('username', user.username);

      if (profileDisplayName) profileDisplayName.textContent = user.display_name || user.username;
      if (profileEmail) profileEmail.textContent = user.email || '';
      if (displayNameInput) displayNameInput.value = user.display_name || user.username;
      if (usernameInput) usernameInput.value = user.username;
      if (emailInput) emailInput.value = user.email || '';

      showAccountStatus('success', t('changesSaved'));
    } catch (error) {
      showAccountStatus('error', (error as Error).message);
    } finally {
      saveAccountBtn?.removeAttribute('disabled');
      saveAccountBtn?.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

  deleteAccountBtn?.addEventListener('click', async () => {
    if (!confirm(t('deleteWarning'))) return;

    try {
      deleteAccountBtn.setAttribute('disabled', 'true');
      deleteAccountBtn.classList.add('opacity-60', 'cursor-not-allowed');

      const res = await fetch(`${API_URL}/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || t('accountError'));
      }

      showAccountStatus('success', t('deleteSuccess'));
      setTimeout(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('authenticated_play');
        history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 1200);
    } catch (error) {
      showAccountStatus('error', (error as Error).message);
      deleteAccountBtn?.removeAttribute('disabled');
      deleteAccountBtn?.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

  // Load user stats
  try {
    const statsRes = await fetch(`${API_URL}/users/${user.id}`);
    if (statsRes.ok) {
      const userData = await statsRes.json();
      // update avatar and display name from API authoritative source
      if (userData.avatar_url) {
        user.avatar_url = userData.avatar_url;
        if (avatarImg) avatarImg.src = `${API_URL}${user.avatar_url}`;
        localStorage.setItem('user', JSON.stringify(user));
      }
      if (userData.display_name) {
        user.display_name = userData.display_name;
        if (profileDisplayName) profileDisplayName.textContent = userData.display_name;
        localStorage.setItem('user', JSON.stringify(user));
      }

      const stats = document.getElementById('statsSection');
      if (stats) {
        const winRate = userData.total_matches > 0 
          ? Math.round((userData.wins / userData.total_matches) * 100) 
          : 0;
        
        stats.innerHTML = `
          <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center">
            <p class="text-gray-400 text-sm mb-2">${t('totalMatches')}</p>
            <p class="text-4xl font-bold text-cyan-400">${userData.total_matches}</p>
          </div>
          <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center">
            <p class="text-gray-400 text-sm mb-2">${t('wins')}</p>
            <p class="text-4xl font-bold text-green-400">${userData.wins}</p>
          </div>
          <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center">
            <p class="text-gray-400 text-sm mb-2">${t('losses')}</p>
            <p class="text-4xl font-bold text-red-400">${userData.losses}</p>
          </div>
          <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center">
            <p class="text-gray-400 text-sm mb-2">${t('winRate')}</p>
            <p class="text-4xl font-bold text-purple-400">${winRate}%</p>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }

  // Load match history
  try {
    const matchesRes = await fetch(`http://localhost:3102/matches/user/${user.id}`);
    console.log('Match history response status:', matchesRes.status);
    
    if (matchesRes.ok) {
      const matches = await matchesRes.json();
      console.log('Fetched matches:', matches);
      
      const historyDiv = document.getElementById('matchHistory');
      if (historyDiv) {
        if (matches.length === 0) {
          historyDiv.innerHTML = `<p class="text-gray-400 text-center py-8">${t('noMatches')}</p>`;
        } else {
          historyDiv.innerHTML = matches.map((m: any) => {
            const isWinner = m.winner === user.username;
            const opponent = m.player1 === user.username ? m.player2 : m.player1;
            return `
              <div class="bg-black/30 rounded-lg p-4 flex justify-between items-center border ${isWinner ? 'border-green-500/50' : 'border-red-500/50'}">
                <div>
                  <p class="font-semibold">${user.username} ${t('vs')} ${opponent}</p>
                  <p class="text-sm text-gray-400">${new Date(m.played_at).toLocaleDateString()}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}">
                    ${isWinner ? t('victory') : t('defeat')}
                  </p>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    } else {
      throw new Error(`HTTP ${matchesRes.status}: ${await matchesRes.text()}`);
    }
  } catch (err) {
    console.error('Failed to load matches:', err);
    const historyDiv = document.getElementById('matchHistory');
    if (historyDiv) {
      historyDiv.innerHTML = `<p class="text-red-400 text-center py-8">Error loading match history: ${(err as Error).message}</p>`;
    }
  }

  // Logout handler
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await fetch(`${API_URL}/auth/logout/${user.id}`, { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  const langSelect = document.getElementById('dashboardLangSelect') as HTMLSelectElement | null;
  langSelect?.addEventListener('change', (event) => {
    const selectedLang = (event.target as HTMLSelectElement).value;
    localStorage.setItem('lang', selectedLang);
    renderDashboardPage();
  });
}
