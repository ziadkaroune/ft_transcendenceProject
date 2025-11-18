import ProfileTranslations from '../languages/ProfileLanguages';

const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const DEFAULT_USERS_API_URL = isLocalhost
  ? 'http://localhost:3103'
  : window.location.origin.replace(/\/$/, '');
const DEFAULT_MATCHES_API_URL = isLocalhost
  ? 'http://localhost:3102'
  : window.location.origin.replace(/\/$/, '');

const API_URL =
  (import.meta.env.VITE_USERS_API_URL as string | undefined) ??
  DEFAULT_USERS_API_URL;
const MATCHES_API_URL =
  (import.meta.env.VITE_MATCHES_API_URL as string | undefined) ??
  DEFAULT_MATCHES_API_URL;

const DEFAULT_AVATAR_PATH = '/avatars/user.png';

const escapeHtml = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
};

export async function renderDashboardPage() {
  const app = document.getElementById('app');
  if (!app) return;
  let isLogIn : boolean = true;
  localStorage.setItem('isLogIn' , 'true');
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }

  let user = JSON.parse(userStr);

  const cleanupRegistryKey = '__dashboardCleanup';
  const globalWindow = window as unknown as Record<string, unknown>;
  const existingCleanups = Array.isArray(globalWindow[cleanupRegistryKey])
    ? (globalWindow[cleanupRegistryKey] as Array<() => void>)
    : [];
  existingCleanups.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.error('Dashboard cleanup error:', error);
    }
  });
  existingCleanups.length = 0;
  const cleanupCallbacks: Array<() => void> = [];
  globalWindow[cleanupRegistryKey] = cleanupCallbacks;
  const registerCleanup = (fn: () => void) => {
    cleanupCallbacks.push(fn);
  };

  const updateLocalUser = () => {
    if(isLogIn){
       localStorage.setItem('user', JSON.stringify(user));
    }
   
  };

  if (!user.avatar_url) {
    user.avatar_url = DEFAULT_AVATAR_PATH;
    updateLocalUser();
  }

  if (!user.status) {
    user.status = 'offline';
  }

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

  const localeMap: Record<string, string> = {
    eng: 'en',
    fr: 'fr',
    pl: 'pl',
    es: 'es'
  };
  const relativeLocale = localeMap[currentLang] || 'en';
  const relativeTimeFormatter = new Intl.RelativeTimeFormat(relativeLocale, { numeric: 'auto' });

  type FriendRecord = {
    id: number;
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
    status?: string | null;
    friendship_status: string;
    created_at?: string | null;
    last_seen?: string | null;
  };

  const buildAvatarSrc = (avatarPath?: string | null): string => {
    const candidate = avatarPath && avatarPath.trim() ? avatarPath.trim() : DEFAULT_AVATAR_PATH;
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
      return candidate;
    }
    const normalized = candidate.startsWith('/') ? candidate : `/${candidate}`;
    return `${API_URL}${normalized}`;
  };

  const formatRelativeTime = (dateString?: string | null): string => {
    if (!dateString) return '';
    const parsed = Date.parse(dateString);
    if (Number.isNaN(parsed)) return '';
    const diffSeconds = Math.round((parsed - Date.now()) / 1000);
    const absSeconds = Math.abs(diffSeconds);
    if (absSeconds < 30) {
      return t('statusJustNow');
    }
    if (absSeconds < 60) {
      return relativeTimeFormatter.format(diffSeconds, 'second');
    }
    if (absSeconds < 3600) {
      return relativeTimeFormatter.format(Math.round(diffSeconds / 60), 'minute');
    }
    if (absSeconds < 86400) {
      return relativeTimeFormatter.format(Math.round(diffSeconds / 3600), 'hour');
    }
    if (absSeconds < 604800) {
      return relativeTimeFormatter.format(Math.round(diffSeconds / 86400), 'day');
    }
    return relativeTimeFormatter.format(Math.round(diffSeconds / 604800), 'week');
  };

  const getPresenceMeta = (status?: string | null, lastSeen?: string | null) => {
    const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
    let label = t('statusUnknown');
    let colorClass = 'text-gray-300';
    let dotClass = 'bg-gray-400';
    let detail = '';

    if (normalized === 'online') {
      label = t('statusOnline');
      colorClass = 'text-green-300';
      dotClass = 'bg-green-400';
      detail = t('statusJustNow');
    } else if (normalized === 'away') {
      label = t('statusAway');
      colorClass = 'text-yellow-300';
      dotClass = 'bg-yellow-400';
      const relative = formatRelativeTime(lastSeen);
      detail = relative ? `${t('statusLastSeen')}: ${relative}` : t('statusJustNow');
    } else if (normalized === 'offline') {
      label = t('statusOffline');
      const relative = formatRelativeTime(lastSeen);
      detail = relative ? `${t('statusLastSeen')}: ${relative}` : '';
    } else {
      const relative = formatRelativeTime(lastSeen);
      detail = relative ? `${t('statusLastSeen')}: ${relative}` : '';
    }

    return { label, colorClass, dotClass, detail };
  };

  const buildPresenceMarkup = (status?: string | null, lastSeen?: string | null): string => {
    const meta = getPresenceMeta(status, lastSeen);
    const detailHtml = meta.detail
      ? `<p class="text-xs text-gray-400">${escapeHtml(meta.detail)}</p>`
      : '';
    return `
      <div class="space-y-1">
        <div class="inline-flex items-center gap-2 text-xs font-semibold ${meta.colorClass}">
          <span class="w-2.5 h-2.5 rounded-full ${meta.dotClass}"></span>
          <span>${escapeHtml(meta.label)}</span>
        </div>
        ${detailHtml}
      </div>
    `;
  };

  const renderAcceptedFriend = (friend: FriendRecord): string => {
    const friendId = Number(friend.id);
    const displayName = escapeHtml(friend.display_name || friend.username);
    const username = escapeHtml(friend.username);
    const avatarSrc = escapeHtml(buildAvatarSrc(friend.avatar_url));
    return `
      <div class="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
        <div class="flex items-center gap-3">
          <img src="${avatarSrc}" alt="${displayName}" class="w-12 h-12 rounded-full object-cover border border-white/20" />
          <div class="min-w-0">
            <p class="font-semibold truncate">${displayName}</p>
            <p class="text-sm text-gray-400 truncate">@${username}</p>
          </div>
        </div>
        ${buildPresenceMarkup(friend.status, friend.last_seen)}
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            class="w-full px-3 py-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-sm font-semibold transition"
            data-action="remove"
            data-friend-id="${friendId}"
          >
            ${t('removeFriend')}
          </button>
        </div>
      </div>
    `;
  };

  const renderIncomingFriend = (friend: FriendRecord): string => {
    const friendId = Number(friend.id);
    const displayName = escapeHtml(friend.display_name || friend.username);
    const username = escapeHtml(friend.username);
    const avatarSrc = escapeHtml(buildAvatarSrc(friend.avatar_url));
    return `
      <div class="bg-black/30 border border-purple-400/30 rounded-xl p-4 flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <img src="${avatarSrc}" alt="${displayName}" class="w-12 h-12 rounded-full object-cover border border-purple-400/40" />
          <div>
            <p class="font-semibold">${displayName}</p>
            <p class="text-sm text-gray-400">@${username}</p>
            <p class="text-xs text-purple-200">${t('incomingRequestsHint')}</p>
          </div>
        </div>
        ${buildPresenceMarkup(friend.status, friend.last_seen)}
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            class="w-full sm:flex-1 px-3 py-2 bg-green-600/80 hover:bg-green-600 rounded-lg text-sm font-semibold transition"
            data-action="accept"
            data-friend-id="${friendId}"
          >
            ${t('accept')}
          </button>
          <button
            class="w-full sm:flex-1 px-3 py-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-sm font-semibold transition"
            data-action="reject"
            data-friend-id="${friendId}"
          >
            ${t('decline')}
          </button>
        </div>
      </div>
    `;
  };

  const renderOutgoingFriend = (friend: FriendRecord): string => {
    const friendId = Number(friend.id);
    const displayName = escapeHtml(friend.display_name || friend.username);
    const username = escapeHtml(friend.username);
    const avatarSrc = escapeHtml(buildAvatarSrc(friend.avatar_url));
    return `
      <div class="bg-black/30 border border-cyan-400/30 rounded-xl p-4 flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <img src="${avatarSrc}" alt="${displayName}" class="w-12 h-12 rounded-full object-cover border border-cyan-400/40" />
          <div>
            <p class="font-semibold">${displayName}</p>
            <p class="text-sm text-gray-400">@${username}</p>
            <p class="text-xs text-cyan-200">${t('outgoingRequestsHint')}</p>
          </div>
        </div>
        ${buildPresenceMarkup(friend.status, friend.last_seen)}
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            class="w-full sm:flex-1 px-3 py-2 bg-yellow-500/80 hover:bg-yellow-500 rounded-lg text-sm font-semibold transition"
            data-action="cancel"
            data-friend-id="${friendId}"
          >
            ${t('cancelRequest')}
          </button>
        </div>
      </div>
    `;
  };

  const initialAvatarSrc = escapeHtml(buildAvatarSrc(user.avatar_url));
  const profileAltText = escapeHtml(user.display_name || user.username || '');

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
                        flex items-center justify-center text-4xl font-bold overflow-hidden">
              <img id="avatarImg" src="${initialAvatarSrc}" alt="${profileAltText}" class="w-24 h-24 rounded-full object-cover" />
            </div>
            <div>
              <h2 id="profileDisplayName" class="text-3xl font-bold">${user.display_name || user.username}</h2>
              <p id="profileUsername" class="text-gray-400">@${user.username}</p>
              <p id="profileEmail" class="text-sm text-cyan-400">${user.email || ''}</p>
              <div id="profilePresence" class="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span id="profileStatusWrapper" class="inline-flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <span id="profileStatusDot" class="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                  <span id="profileStatusText">${t('statusUnknown')}</span>
                </span>
                <span id="profileLastSeen" class="text-xs text-gray-400 hidden"></span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-3 sm:gap-6 border-b border-white/10 pb-2">
            <button id="overviewTab"
                    class="px-4 py-2 text-sm sm:text-base font-semibold border-b-2 border-transparent text-white transition-colors">
              ${t('profileOverview')}
            </button>
            <button id="friendsTab"
                    class="px-4 py-2 text-sm sm:text-base font-semibold border-b-2 border-transparent text-gray-300 hover:text-white transition-colors">
              ${t('friendsTitle')}
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

          <div id="friendsPanel" class="hidden space-y-6">
            <div id="friendsSection" class="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
                <div class="flex items-center justify-between gap-3 mb-4">
                  <h3 class="text-2xl font-bold truncate">${t('friendsTitle')}</h3>
                  <span id="friendsCountBadge"
                        class="flex-shrink-0 px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-200">
                    --
                  </span>
                </div>
                <div id="friendsList" class="space-y-3">
                  <p class="text-gray-400 text-sm">${t('loading')}</p>
                </div>
              </div>
              <div class="flex flex-col gap-6">
                <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
                  <h3 class="text-xl font-semibold mb-4">${t('incomingRequests')}</h3>
                  <div id="incomingRequestsList" class="space-y-3">
                    <p class="text-gray-400 text-sm">${t('loading')}</p>
                  </div>
                </div>
                <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
                  <h3 class="text-xl font-semibold mb-4">${t('outgoingRequests')}</h3>
                  <div id="outgoingRequestsList" class="space-y-3">
                    <p class="text-gray-400 text-sm">${t('loading')}</p>
                  </div>
                </div>
              </div>
              <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
                <h3 class="text-2xl font-bold mb-4">${t('addFriendTitle')}</h3>
                <form id="friendSearchForm" class="space-y-4">
                  <div>
                    <label for="friendSearchInput"
                           class="block text-sm font-medium text-cyan-300 mb-2">${t('addFriendLabel')}</label>
                    <div class="flex flex-col sm:flex-row gap-3">
                      <input id="friendSearchInput" type="text"
                             class="flex-1 min-w-0 bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                             placeholder="${t('addFriendPlaceholder')}" />
                      <button type="submit"
                              class="w-full sm:flex-shrink-0 sm:w-auto px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition">
                        ${t('addFriendButton')}
                      </button>
                    </div>
                  </div>
                  <p id="friendsStatusMsg" class="hidden text-sm"></p>
                  <p class="text-xs text-gray-400">${t('addFriendHint')}</p>
                </form>
              </div>
            </div>
          </div>

          <div id="accountPanel" class="hidden">
            <form id="accountForm" class="space-y-6">
              <p class="text-gray-300">${t('accountInfoHeading')}</p>

              <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 space-y-4">
                <h3 class="text-xl font-semibold">${t('avatarSectionTitle')}</h3>
                <div class="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <img id="accountAvatarPreview" src="${initialAvatarSrc}" alt="${profileAltText}"
                       class="w-20 h-20 rounded-full object-cover border border-white/20" />
                  <div class="flex-1 w-full space-y-3">
                    <label for="avatarFileInput" class="block text-sm font-medium text-cyan-300">${t('avatarUploadLabel')}</label>
                    <input id="avatarFileInput" type="file" accept="image/*"
                           class="w-full text-sm text-gray-200 bg-black/50 border border-cyan-500/60 rounded-xl px-3 py-2 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                    <p class="text-xs text-gray-400">${t('avatarUploadHint')}</p>
                    <p id="avatarStatusMsg" class="hidden text-sm"></p>
                  </div>
                  <button type="button" id="uploadAvatarBtn"
                          class="w-full md:w-auto px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition">
                    ${t('avatarUploadButton')}
                  </button>
                </div>
              </div>

              <div class="space-y-6">
                <label for="displayNameField" class="block text-sm font-medium text-cyan-300 mb-2">${t('displayNameLabel')}</label>
                <input id="displayNameField" type="text"
                       class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                <label for="usernameField" class="block text-sm font-medium text-cyan-300 mb-2 mt-4">${t('usernameLabel')}</label>
                <input id="usernameField" type="text"
                       class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                <label for="emailField" class="block text-sm font-medium text-cyan-300 mb-2 mt-4">${t('emailLabel')}</label>
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

            <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 space-y-4 mt-4">
              <h3 class="text-xl font-semibold">${t('passwordSectionTitle')}</h3>
              <form id="passwordForm" class="space-y-4">
                <div>
                  <label for="currentPasswordField" class="block text-sm font-medium text-cyan-300 mb-2">${t('passwordCurrentLabel')}</label>
                  <input id="currentPasswordField" type="password"
                         class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                         autocomplete="current-password" />
                </div>
                <div>
                  <label for="newPasswordField" class="block text-sm font-medium text-cyan-300 mb-2">${t('passwordNewLabel')}</label>
                  <input id="newPasswordField" type="password"
                         class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                         autocomplete="new-password" />
                </div>
                <div>
                  <label for="confirmPasswordField" class="block text-sm font-medium text-cyan-300 mb-2">${t('passwordConfirmLabel')}</label>
                  <input id="confirmPasswordField" type="password"
                         class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                         autocomplete="new-password" />
                </div>
                <p id="passwordStatusMsg" class="hidden text-sm"></p>
                <button type="submit"
                        class="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition">
                  ${t('passwordSaveButton')}
                </button>
                <p class="text-xs text-gray-400">${t('passwordRequirements')}</p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const avatarImg = document.getElementById('avatarImg') as HTMLImageElement | null;
  const profileDisplayName = document.getElementById('profileDisplayName') as HTMLHeadingElement | null;
  const profileUsername = document.getElementById('profileUsername') as HTMLParagraphElement | null;
  const profileEmail = document.getElementById('profileEmail') as HTMLParagraphElement | null;
  const profileStatusWrapper = document.getElementById('profileStatusWrapper') as HTMLSpanElement | null;
  const profileStatusDot = document.getElementById('profileStatusDot') as HTMLSpanElement | null;
  const profileStatusText = document.getElementById('profileStatusText') as HTMLSpanElement | null;
  const profileLastSeen = document.getElementById('profileLastSeen') as HTMLSpanElement | null;
  const overviewTab = document.getElementById('overviewTab') as HTMLButtonElement | null;
  const friendsTab = document.getElementById('friendsTab') as HTMLButtonElement | null;
  const accountTab = document.getElementById('accountTab') as HTMLButtonElement | null;
  const overviewPanel = document.getElementById('overviewPanel') as HTMLDivElement | null;
  const friendsPanel = document.getElementById('friendsPanel') as HTMLDivElement | null;
  const accountPanel = document.getElementById('accountPanel') as HTMLDivElement | null;
  const accountForm = document.getElementById('accountForm') as HTMLFormElement | null;
  const displayNameInput = document.getElementById('displayNameField') as HTMLInputElement | null;
  const usernameInput = document.getElementById('usernameField') as HTMLInputElement | null;
  const emailInput = document.getElementById('emailField') as HTMLInputElement | null;
  const accountStatusMsg = document.getElementById('accountStatusMsg') as HTMLParagraphElement | null;
  const deleteAccountBtn = document.getElementById('deleteAccountBtn') as HTMLButtonElement | null;
  const saveAccountBtn = document.getElementById('saveAccountBtn') as HTMLButtonElement | null;
  const accountAvatarPreview = document.getElementById('accountAvatarPreview') as HTMLImageElement | null;
  const avatarFileInput = document.getElementById('avatarFileInput') as HTMLInputElement | null;
  const uploadAvatarBtn = document.getElementById('uploadAvatarBtn') as HTMLButtonElement | null;
  const avatarStatusMsg = document.getElementById('avatarStatusMsg') as HTMLParagraphElement | null;
  const passwordForm = document.getElementById('passwordForm') as HTMLFormElement | null;
  const currentPasswordInput = document.getElementById('currentPasswordField') as HTMLInputElement | null;
  const newPasswordInput = document.getElementById('newPasswordField') as HTMLInputElement | null;
  const confirmPasswordInput = document.getElementById('confirmPasswordField') as HTMLInputElement | null;
  const passwordStatusMsg = document.getElementById('passwordStatusMsg') as HTMLParagraphElement | null;
  const friendSearchForm = document.getElementById('friendSearchForm') as HTMLFormElement | null;
  const friendSearchInput = document.getElementById('friendSearchInput') as HTMLInputElement | null;
  const friendsStatusMsg = document.getElementById('friendsStatusMsg') as HTMLParagraphElement | null;
  const friendsList = document.getElementById('friendsList') as HTMLDivElement | null;
  const incomingRequestsList = document.getElementById('incomingRequestsList') as HTMLDivElement | null;
  const outgoingRequestsList = document.getElementById('outgoingRequestsList') as HTMLDivElement | null;
  const friendsSection = document.getElementById('friendsSection') as HTMLDivElement | null;
  const friendsCountBadge = document.getElementById('friendsCountBadge') as HTMLSpanElement | null;

  const updateProfilePresence = (status?: string | null, lastSeen?: string | null) => {
    const meta = getPresenceMeta(status, lastSeen);
    if (profileStatusWrapper) {
      profileStatusWrapper.className = `inline-flex items-center gap-2 text-sm font-semibold ${meta.colorClass}`;
    }
    if (profileStatusDot) {
      profileStatusDot.className = `w-2.5 h-2.5 rounded-full ${meta.dotClass}`;
    }
    if (profileStatusText) {
      profileStatusText.textContent = meta.label;
    }
    if (profileLastSeen) {
      if (meta.detail) {
        profileLastSeen.textContent = meta.detail;
        profileLastSeen.classList.remove('hidden');
      } else {
        profileLastSeen.textContent = '';
        profileLastSeen.classList.add('hidden');
      }
    }
  };

  const setUserPresenceLocal = (status: string, lastSeen?: string) => {
    const normalized = status?.toLowerCase?.() || 'offline';
    user.status = normalized;
    if (lastSeen) {
      user.last_seen = lastSeen;
    }
    updateLocalUser();
    updateProfilePresence(user.status, user.last_seen);
  };

  updateProfilePresence(user.status, user.last_seen);

  const tabConfigs: Array<{
    key: 'overview' | 'friends' | 'account';
    button: HTMLButtonElement | null;
    panel: HTMLDivElement | null;
  }> = [
    { key: 'overview', button: overviewTab, panel: overviewPanel },
    { key: 'friends', button: friendsTab, panel: friendsPanel },
    { key: 'account', button: accountTab, panel: accountPanel }
  ];

  const setActiveTab = (target: 'overview' | 'friends' | 'account') => {
    tabConfigs.forEach(({ key, button, panel }) => {
      if (!button || !panel) return;
      const isActive = key === target;
      panel.classList.toggle('hidden', !isActive);
      button.classList.toggle('text-white', isActive);
      button.classList.toggle('text-gray-300', !isActive);
      button.classList.toggle('border-purple-400', isActive);
      button.classList.toggle('bg-white/10', isActive);
    });
  };

  overviewTab?.addEventListener('click', () => setActiveTab('overview'));
  friendsTab?.addEventListener('click', () => setActiveTab('friends'));
  accountTab?.addEventListener('click', () => setActiveTab('account'));
  setActiveTab('overview');

  const applyAvatarToUI = () => {
    const src = buildAvatarSrc(user.avatar_url);
    const altText = user.display_name || user.username || '';
    if (avatarImg) {
      avatarImg.src = src;
      avatarImg.alt = altText;
    }
    if (accountAvatarPreview) {
      accountAvatarPreview.src = src;
      accountAvatarPreview.alt = altText;
    }
  };

  applyAvatarToUI();
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

  let avatarPreviewUrl: string | null = null;

  const clearAvatarStatus = () => {
    if (!avatarStatusMsg) return;
    avatarStatusMsg.textContent = '';
    avatarStatusMsg.classList.add('hidden');
    avatarStatusMsg.classList.remove('text-green-400', 'text-red-400', 'text-cyan-300');
  };

  const showAvatarStatus = (type: 'success' | 'error' | 'info', message: string) => {
    if (!avatarStatusMsg) return;
    avatarStatusMsg.textContent = message;
    avatarStatusMsg.classList.remove('hidden', 'text-green-400', 'text-red-400', 'text-cyan-300');
    avatarStatusMsg.classList.add(
      type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-cyan-300'
    );
  };

  const clearPasswordStatus = () => {
    if (!passwordStatusMsg) return;
    passwordStatusMsg.textContent = '';
    passwordStatusMsg.classList.add('hidden');
    passwordStatusMsg.classList.remove('text-green-400', 'text-red-400', 'text-cyan-300');
  };

  const showPasswordStatus = (type: 'success' | 'error' | 'info', message: string) => {
    if (!passwordStatusMsg) return;
    passwordStatusMsg.textContent = message;
    passwordStatusMsg.classList.remove('hidden', 'text-green-400', 'text-red-400', 'text-cyan-300');
    passwordStatusMsg.classList.add(
      type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-cyan-300'
    );
  };

  const clearFriendsStatus = () => {
    if (!friendsStatusMsg) return;
    friendsStatusMsg.textContent = '';
    friendsStatusMsg.classList.add('hidden');
    friendsStatusMsg.classList.remove('text-green-400', 'text-red-400', 'text-cyan-300');
  };

  const showFriendsStatus = (type: 'success' | 'error' | 'info', message: string) => {
    if (!friendsStatusMsg) return;
    friendsStatusMsg.textContent = message;
    friendsStatusMsg.classList.remove('hidden', 'text-green-400', 'text-red-400', 'text-cyan-300');
    friendsStatusMsg.classList.add(
      type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-cyan-300'
    );
  };

  const heartbeat = async (status: 'online' | 'offline' | 'away', options?: { sync?: boolean }) => {
    const payload = JSON.stringify({ status });
    if (!options?.sync) {
      setUserPresenceLocal(status, new Date().toISOString());
    }

    if (options?.sync && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(`${API_URL}/users/${user.id}/status`, blob);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/users/${user.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: payload
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.last_seen === 'string' && typeof data.status === 'string') {
          setUserPresenceLocal(data.status, data.last_seen);
        }
      }
    } catch (error) {
      console.error('Presence update failed:', error);
    }
  };

  const refreshFriends = async () => {
    if (!friendsList || !incomingRequestsList || !outgoingRequestsList) return;

    friendsList.innerHTML = `<p class="text-gray-400 text-sm">${t('loading')}</p>`;
    incomingRequestsList.innerHTML = `<p class="text-gray-400 text-sm">${t('loading')}</p>`;
    outgoingRequestsList.innerHTML = `<p class="text-gray-400 text-sm">${t('loading')}</p>`;
    if (friendsCountBadge) friendsCountBadge.textContent = '--';

    try {
      const res = await fetch(`${API_URL}/users/${user.id}/friends`, {
        credentials: 'include'
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !Array.isArray(payload)) {
        const message = payload && !Array.isArray(payload) && typeof payload?.error === 'string'
          ? payload.error
          : t('friendListError');
        throw new Error(message);
      }

      const friendsData = payload as FriendRecord[];
      const accepted = friendsData.filter((f) => f.friendship_status === 'accepted');
      const incoming = friendsData.filter((f) => f.friendship_status === 'pending');
      const outgoing = friendsData.filter((f) => f.friendship_status === 'requested');

      friendsList.innerHTML = accepted.length
        ? accepted.map(renderAcceptedFriend).join('')
        : `<p class="text-gray-400 text-sm">${t('friendsEmpty')}</p>`;

      incomingRequestsList.innerHTML = incoming.length
        ? incoming.map(renderIncomingFriend).join('')
        : `<p class="text-gray-400 text-sm">${t('incomingEmpty')}</p>`;

      outgoingRequestsList.innerHTML = outgoing.length
        ? outgoing.map(renderOutgoingFriend).join('')
        : `<p class="text-gray-400 text-sm">${t('outgoingEmpty')}</p>`;

      if (friendsCountBadge) friendsCountBadge.textContent = String(accepted.length);
    } catch (error) {
      const message = (error as Error).message || t('friendListError');
      showFriendsStatus('error', message);
      friendsList.innerHTML = `<p class="text-red-400 text-sm">${escapeHtml(message)}</p>`;
      incomingRequestsList.innerHTML = `<p class="text-red-400 text-sm">${escapeHtml(message)}</p>`;
      outgoingRequestsList.innerHTML = `<p class="text-red-400 text-sm">${escapeHtml(message)}</p>`;
      if (friendsCountBadge) friendsCountBadge.textContent = '--';
    }
  };

  accountForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!displayNameInput || !usernameInput || !emailInput) return;

    const payload: Record<string, string> = {};
    const newDisplayName = displayNameInput.value.trim();
    const newUsername = usernameInput.value.trim();
    const newEmail = emailInput.value.trim().toLowerCase();

    // Compare against current values, treating undefined/null as empty string
    const currentDisplayName = user.display_name || user.username || '';
    const currentUsername = user.username || '';
    const currentEmail = (user.email || '').toLowerCase();

    if (newDisplayName && newDisplayName !== currentDisplayName) payload.display_name = newDisplayName;
    if (newUsername && newUsername !== currentUsername) payload.username = newUsername;
    if (newEmail && newEmail !== currentEmail) payload.email = newEmail;

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
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || t('accountError'));
      }

      if (payload.display_name) user.display_name = newDisplayName;
      if (payload.username) user.username = newUsername;
      if (payload.email) user.email = newEmail;

      updateLocalUser();
      localStorage.setItem('username', user.username);

      if (profileDisplayName) profileDisplayName.textContent = user.display_name || user.username;
      if (profileUsername) profileUsername.textContent = `@${user.username}`;
      if (profileEmail) profileEmail.textContent = user.email || '';
      if (displayNameInput) displayNameInput.value = user.display_name || user.username;
      if (usernameInput) usernameInput.value = user.username;
      if (emailInput) emailInput.value = user.email || '';
      applyAvatarToUI();

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

      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || t('accountError'));
      }

      showAccountStatus('success', t('deleteSuccess'));
     
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('authenticated_play');
        localStorage.setItem('mode' , 'default' );
        isLogIn = false; /// to check if use loggout
       localStorage.setItem('isLogIn' , 'false'); // for global use
        history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
    
    } catch (error) {
      showAccountStatus('error', (error as Error).message);
      deleteAccountBtn?.removeAttribute('disabled');
      deleteAccountBtn?.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

  avatarFileInput?.addEventListener('change', () => {
    clearAvatarStatus();
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      avatarPreviewUrl = null;
    }
    const file = avatarFileInput.files?.[0];
    if (!file) {
      applyAvatarToUI();
      return;
    }
    avatarPreviewUrl = URL.createObjectURL(file);
    if (accountAvatarPreview) accountAvatarPreview.src = avatarPreviewUrl;
  });

  uploadAvatarBtn?.addEventListener('click', async (event) => {
    event.preventDefault();

    if (!avatarFileInput || !avatarFileInput.files || avatarFileInput.files.length === 0) {
      showAvatarStatus('error', t('avatarUploadNoFile'));
      return;
    }

    clearAvatarStatus();

    const file = avatarFileInput.files[0];
    const formData = new FormData();
    formData.append('avatar', file);

    uploadAvatarBtn.setAttribute('disabled', 'true');
    uploadAvatarBtn.classList.add('opacity-60', 'cursor-not-allowed');

    try {
      const res = await fetch(`${API_URL}/users/${user.id}/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || t('avatarUploadError'));
      }

      user.avatar_url = payload.avatar_url || DEFAULT_AVATAR_PATH;
      updateLocalUser();

      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
        avatarPreviewUrl = null;
      }
      avatarFileInput.value = '';
      applyAvatarToUI();
      showAvatarStatus('success', payload.message || t('avatarUploadSuccess'));
    } catch (error) {
      showAvatarStatus('error', (error as Error).message || t('avatarUploadError'));
    } finally {
      uploadAvatarBtn.removeAttribute('disabled');
      uploadAvatarBtn.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

  passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) return;

    const current = currentPasswordInput.value;
    const next = newPasswordInput.value;
    const confirm = confirmPasswordInput.value;

    clearPasswordStatus();

    if (!current.trim()) {
      showPasswordStatus('error', t('passwordCurrentRequired'));
      return;
    }

    if (next.length < 8) {
      showPasswordStatus('error', t('passwordTooShort'));
      return;
    }

    if (next !== confirm) {
      showPasswordStatus('error', t('passwordMismatch'));
      return;
    }

    const submitBtn = passwordForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    submitBtn?.setAttribute('disabled', 'true');
    submitBtn?.classList.add('opacity-60', 'cursor-not-allowed');

    try {
      const res = await fetch(`${API_URL}/users/${user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: current,
          new_password: next
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || t('passwordChangeError'));
      }

      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';

      showPasswordStatus('success', payload.message || t('passwordChangeSuccess'));
    } catch (error) {
      showPasswordStatus('error', (error as Error).message || t('passwordChangeError'));
    } finally {
      submitBtn?.removeAttribute('disabled');
      submitBtn?.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

  friendSearchForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!friendSearchInput) return;

    const query = friendSearchInput.value.trim();
    if (!query) {
      showFriendsStatus('error', t('friendSearchEmpty'));
      return;
    }

    clearFriendsStatus();
    const submitBtn = friendSearchForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    submitBtn?.setAttribute('disabled', 'true');
    submitBtn?.classList.add('opacity-60', 'cursor-not-allowed');

    try {
      const res = await fetch(`${API_URL}/users/${user.id}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friend_username: query })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || t('friendActionError'));
      }
      friendSearchInput.value = '';
      await refreshFriends();
      showFriendsStatus('success', payload.message || t('friendActionSent'));
    } catch (error) {
      showFriendsStatus('error', (error as Error).message || t('friendActionError'));
    } finally {
      submitBtn?.removeAttribute('disabled');
      submitBtn?.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

  friendsSection?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-action]') as HTMLButtonElement | null;
    if (!button) return;

    const action = button.dataset.action as 'accept' | 'reject' | 'cancel' | 'remove' | undefined;
    const friendId = Number(button.dataset.friendId);

    if (!action || Number.isNaN(friendId)) return;

    clearFriendsStatus();
    button.setAttribute('disabled', 'true');
    button.classList.add('opacity-60', 'cursor-not-allowed');

    let message = '';

    try {
      if (action === 'accept' || action === 'reject') {
        const res = await fetch(`${API_URL}/users/${user.id}/friends/${friendId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || t('friendActionError'));
        }
        message = payload.message || (action === 'accept' ? t('friendActionAccept') : t('friendActionDecline'));
      } else {
        const res = await fetch(`${API_URL}/users/${user.id}/friends/${friendId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || t('friendActionError'));
        }
        message = payload.message || (action === 'remove' ? t('friendActionRemove') : t('friendActionCancel'));
      }

      await refreshFriends();
      showFriendsStatus('success', message);
    } catch (error) {
      showFriendsStatus('error', (error as Error).message || t('friendActionError'));
    } finally {
      button.removeAttribute('disabled');
      button.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

  clearFriendsStatus();
  await refreshFriends();

  const friendsInterval = window.setInterval(() => {
    refreshFriends();
  }, 30000);
  registerCleanup(() => window.clearInterval(friendsInterval));

  const loadUserOverview = async () => {
    try {
      const statsRes = await fetch(`${API_URL}/users/${user.id}`, {
        credentials: 'include'
      });
      if (!statsRes.ok) {
        return;
      }

      const userData = await statsRes.json();
      let userModified = false;

      if (userData.avatar_url) {
        user.avatar_url = userData.avatar_url;
        userModified = true;
      } else if (!user.avatar_url) {
        user.avatar_url = DEFAULT_AVATAR_PATH;
        userModified = true;
      }

      if (userData.display_name) {
        user.display_name = userData.display_name;
        if (profileDisplayName) {
          profileDisplayName.textContent = userData.display_name;
        }
        userModified = true;
      }

      if (userData.email && userData.email !== user.email) {
        user.email = userData.email;
        if (profileEmail) {
          profileEmail.textContent = user.email;
        }
        userModified = true;
      }

      if (userData.username && userData.username !== user.username) {
        user.username = userData.username;
        localStorage.setItem('username', user.username);
        userModified = true;
      }

      if (userData.status) {
        user.status = userData.status;
        userModified = true;
      }

      if (userData.last_seen) {
        user.last_seen = userData.last_seen;
        userModified = true;
      }

      if (profileDisplayName && !userData.display_name) {
        profileDisplayName.textContent = user.display_name || user.username;
      }

      if (profileUsername) {
        profileUsername.textContent = `@${user.username}`;
      }

      if (profileEmail && !userData.email) {
        profileEmail.textContent = user.email || '';
      }

      if (userModified) {
        updateLocalUser();
        applyAvatarToUI();
      }

      updateProfilePresence(user.status, user.last_seen);

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
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  await loadUserOverview();

  const overviewInterval = window.setInterval(() => {
    loadUserOverview();
  }, 30000);
  registerCleanup(() => window.clearInterval(overviewInterval));

  heartbeat('online');

  const presenceInterval = window.setInterval(() => {
    const nextStatus = document.visibilityState === 'hidden' ? 'away' : 'online';
    heartbeat(nextStatus);
  }, 30000);
  registerCleanup(() => window.clearInterval(presenceInterval));

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      heartbeat('away');
    } else {
      heartbeat('online');
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  registerCleanup(() => document.removeEventListener('visibilitychange', handleVisibilityChange));

  const handleBeforeUnload = () => {
    heartbeat('offline', { sync: true });
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  registerCleanup(() => window.removeEventListener('beforeunload', handleBeforeUnload));

  const handlePageHide = () => {
    heartbeat('offline', { sync: true });
  };
  window.addEventListener('pagehide', handlePageHide);
  registerCleanup(() => window.removeEventListener('pagehide', handlePageHide));

  const handlePageShow = () => {
    heartbeat('online');
  };
  window.addEventListener('pageshow', handlePageShow);
  registerCleanup(() => window.removeEventListener('pageshow', handlePageShow));

  // Load match history
  try {
    const matchesRes = await fetch(`${MATCHES_API_URL}/matches/user/${user.id}`);
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
            const safeUser = escapeHtml(user.username);
            const safeOpponent = escapeHtml(opponent);
            return `
              <div class="bg-black/30 rounded-lg p-4 flex justify-between items-center border ${isWinner ? 'border-green-500/50' : 'border-red-500/50'}">
                <div>
                  <p class="font-semibold">${safeUser} ${t('vs')} ${safeOpponent}</p>
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
      await heartbeat('offline');
      await fetch(`${API_URL}/auth/logout/${user.id}`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.setItem('mode' , 'default' );
    isLogIn = false; /// to check if use loggout
    localStorage.setItem('isLogIn' , 'false'); // for global use
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
