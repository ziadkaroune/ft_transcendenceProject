import QRCode from 'qrcode';
import LoginTranslations from '../languages/LoginLanguages';

const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const DEFAULT_USERS_API_URL = isLocalhost
  ? 'http://localhost:3103'
  : window.location.origin.replace(/\/$/, '');
const DEFAULT_2FA_API_URL = isLocalhost
  ? 'http://localhost:3105'
  : window.location.origin.replace(/\/$/, '');

const API_URL =
  (import.meta.env.VITE_USERS_API_URL as string | undefined) ??
  DEFAULT_USERS_API_URL;
const API_URL_2FA =
  (import.meta.env.VITE_AUTH_API_URL as string | undefined) ??
  DEFAULT_2FA_API_URL;
const LOGIN_DEFAULT_LANG = 'eng';

export function renderLoginPage() {
  const app = document.getElementById('app');
  if (!app) return;

  const currentLang = (localStorage.getItem('lang') || LOGIN_DEFAULT_LANG) as keyof typeof LoginTranslations;
  const fallbackPack = LoginTranslations[LOGIN_DEFAULT_LANG];
  const t = (key: keyof typeof LoginTranslations['eng']) => {
    const langPack = LoginTranslations[currentLang] || fallbackPack;
    return langPack[key] || fallbackPack[key];
  };

  app.innerHTML = `
    <div class="relative flex items-center justify-center min-h-screen w-full overflow-hidden 
                bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white px-4">
      
      <!-- Background Effects -->
      <div class="absolute inset-0">
        <div class="absolute w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-3xl top-[-100px] left-[-100px] animate-pulse"></div>
        <div class="absolute w-[500px] h-[500px] bg-cyan-600/30 rounded-full blur-3xl bottom-[-120px] right-[-120px] animate-pulse"></div>
      </div>

      <!-- Login Card -->
      <div class="relative z-10 max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 
                  rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.3)] p-8 sm:p-10">

        <!-- Tabs -->
        <div class="flex mb-6 bg-black/30 rounded-xl p-1">
          <button id="loginTab" 
                  class="flex-1 py-2 rounded-lg font-semibold transition-all duration-300 
                         bg-gradient-to-r from-purple-500 to-pink-600 text-white">
            ${t('tabLogin')}
          </button>
          <button id="registerTab" 
                  class="flex-1 py-2 rounded-lg font-semibold transition-all duration-300 
                         text-gray-300 hover:text-white">
            ${t('tabRegister')}
          </button>
        </div>

        <!-- Login Form -->
        <form id="loginForm" class="space-y-5">
          <h2 class="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text 
                     bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
            ${t('loginHeading')}
          </h2>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">${t('emailLabel')}</label>
            <input type="email" id="loginEmail" required
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">${t('passwordLabel')}</label>
            <input type="password" id="loginPassword" required
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <button type="submit" 
                  class="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl 
                         font-bold text-lg shadow-lg hover:scale-105 transition-all">
            ${t('loginButton')}
          </button>
        </form>

        <!-- Register Form (Hidden by default) -->
        <form id="registerForm" class="space-y-5 hidden">
          <h2 class="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text 
                     bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
            ${t('registerHeading')}
          </h2>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">${t('usernameLabel')}</label>
            <input type="text" id="regUsername" required
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">${t('emailLabel')}</label>
            <input type="email" id="regEmail" required
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">${t('passwordLabel')}</label>
            <input type="password" id="regPassword" required minlength="6"
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <!-- 2FA selection -->
          <div class="text-sm text-cyan-300">
            <div class="mb-2 font-medium">${t('twoFactorMethodLabel')}</div>
            <div class="flex gap-4 items-center">
              <label class="flex items-center gap-2">
                <input type="radio" name="authType" value="email" checked />
                <span>${t('twoFactorEmailOption')}</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="radio" name="authType" value="authApp" />
                <span>${t('twoFactorAppOption')}</span>
              </label>
            </div>
            <div class="mt-2 text-xs text-cyan-200">${t('twoFactorHelper')}</div>
          </div>

          <button type="submit" 
                  class="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl 
                         font-bold text-lg shadow-lg hover:scale-105 transition-all">
            ${t('registerButton')}
          </button>
        </form>

        <div id="errorMsg" class="mt-4 text-center text-red-400 text-sm hidden"></div>

        <!-- Back to Home -->
        <button id="backHomeBtn"
                class="w-full mt-6 py-2 bg-gray-800/50 rounded-xl text-gray-300 
                       hover:bg-gray-700/50 transition-all">
          ← ${t('backHome')}
        </button>
      </div>
    </div>
  `;

  const loginTab = document.getElementById('loginTab') as HTMLButtonElement;
  const registerTab = document.getElementById('registerTab') as HTMLButtonElement;
  const loginForm = document.getElementById('loginForm') as HTMLFormElement;
  const registerForm = document.getElementById('registerForm') as HTMLFormElement;
  const errorMsg = document.getElementById('errorMsg') as HTMLDivElement;
  const backHomeBtn = document.getElementById('backHomeBtn') as HTMLButtonElement;

  function showError(msg: string) {
    if (!errorMsg) return;
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
    setTimeout(() => errorMsg.classList.add('hidden'), 5000);
  }

  // Tab switching
  loginTab.onclick = () => {
    loginTab.classList.add('bg-gradient-to-r', 'from-purple-500', 'to-pink-600', 'text-white');
    loginTab.classList.remove('text-gray-300');
    registerTab.classList.remove('bg-gradient-to-r', 'from-purple-500', 'to-pink-600', 'text-white');
    registerTab.classList.add('text-gray-300');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  };

  registerTab.onclick = () => {
    registerTab.classList.add('bg-gradient-to-r', 'from-purple-500', 'to-pink-600', 'text-white');
    registerTab.classList.remove('text-gray-300');
    loginTab.classList.remove('bg-gradient-to-r', 'from-purple-500', 'to-pink-600', 'text-white');
    loginTab.classList.add('text-gray-300');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  };

  // Back to home
  backHomeBtn.onclick = () => {
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Helper: create a simple modal for 2FA input
  function show2FAModal(user: any, authType: string) {
    // avoid duplicate modal
    const existing = document.getElementById('twoFAModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'twoFAModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4';
    modal.innerHTML = `
      <div class="max-w-md w-full bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-white">
        <h3 class="text-2xl font-semibold mb-2">${t('twoFATitle')}</h3>
        <p id="twoFAMessage" class="text-sm text-cyan-200 mb-4">
          ${authType === 'email' ? t('twoFAMessageEmail') : t('twoFAMessageApp')}
        </p>

        <div class="mb-4">
          <input id="twoFAInput" type="text" maxlength="10" placeholder="${t('twoFACodePlaceholder')}"
                 class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none" />
        </div>

        <div class="flex gap-3">
          <button id="verify2FABtn" class="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold">${t('verifyButton')}</button>
          <button id="cancel2FABtn" class="flex-1 py-2 bg-gray-800/40 rounded-xl">${t('cancelButton')}</button>
        </div>

        ${
          authType === 'email'
            ? `
          <div class="mt-3 flex items-center justify-between">
            <button id="resend2FABtn" class="text-sm text-cyan-200 underline">${t('resendCode')}</button>
            <div id="twoFAError" class="text-sm text-red-400"></div>
          </div>
          `
            : `
          <div class="mt-3 flex items-center justify-end">
            <div id="twoFAError" class="text-sm text-red-400"></div>
          </div>
          `
        }
      </div>
    `;

    document.body.appendChild(modal);

    const twoFAInput = document.getElementById('twoFAInput') as HTMLInputElement;
    const verify2FABtn = document.getElementById('verify2FABtn') as HTMLButtonElement;
    const cancel2FABtn = document.getElementById('cancel2FABtn') as HTMLButtonElement;
    const resend2FABtn = document.getElementById('resend2FABtn') as HTMLButtonElement | null;
    const twoFAMessage = document.getElementById('twoFAMessage') as HTMLParagraphElement;
    const twoFAError = document.getElementById('twoFAError') as HTMLDivElement;

    function setTwoFAError(msg: string) {
      if (!twoFAError) return;
      twoFAError.textContent = msg;
      setTimeout(() => { if (twoFAError) twoFAError.textContent = ''; }, 5000);
    }

    // If email 2FA, request server to send code
    async function sendCode() {
      try {
        if (resend2FABtn) {
          resend2FABtn.textContent = t('sendingText');
          resend2FABtn.setAttribute('disabled', 'true');
        }
        const res = await fetch(`${API_URL_2FA}/auth/2fa/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: user.id, email: user.email })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t('sendCodeError'));
        }
        twoFAMessage.textContent = t('codeSentEmail');
        if (resend2FABtn) {
          // simple cooldown
          let cooldown = 30;
          const interval = setInterval(() => {
            cooldown -= 1;
            resend2FABtn.textContent = `${t('codeResendCooldown')} (${cooldown}s)`;
            if (cooldown <= 0) {
              clearInterval(interval);
              resend2FABtn.removeAttribute('disabled');
              resend2FABtn.textContent = t('resendCode');
            }
          }, 1000);
        }
      } catch (err) {
        if (resend2FABtn) {
          resend2FABtn.removeAttribute('disabled');
          resend2FABtn.textContent = t('resendCode');
        }
        setTwoFAError((err as Error).message);
      }
    }

    if (authType === 'email') {
      // trigger initial send
      sendCode();
    }

    if (resend2FABtn) {
      resend2FABtn.onclick = (e) => {
        e.preventDefault();
        sendCode();
      };
    }

    cancel2FABtn.onclick = () => {
      modal.remove();
    };

    verify2FABtn.onclick = async () => {
      const code = twoFAInput.value.trim();
      if (!code) {
        setTwoFAError(t('codeInputRequired'));
        return;
      }
      try {
        verify2FABtn.textContent = t('verifyingText');
        verify2FABtn.setAttribute('disabled', 'true');
        const res = await fetch(`${API_URL_2FA}/auth/2fa/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: user.id, code })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t('invalidCode'));
        }
        const data = await res.json();
        if (!(data && (data.success || data.sessionIssued || data.user))) {
          throw new Error(t('sessionError'));
        }
        const verifiedUser = data.user || user;
        if (verifiedUser) {
          localStorage.setItem('user', JSON.stringify(verifiedUser));
          localStorage.setItem('userId', String(verifiedUser.id || user.id));
          localStorage.setItem('username', verifiedUser.username || user.username || '');
        }
        localStorage.setItem('mode' , "profile-singleplayer");
        localStorage.setItem('waazabi' , 'true');
        modal.remove();
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch (err) {
        setTwoFAError((err as Error).message);
        verify2FABtn.removeAttribute('disabled');
        verify2FABtn.textContent = t('verifyButton');
      }
    };
  }

  // Helper: show registration code / setup modal (for email code or authApp secret)
  function showRegistrationCodeModal(
    userData: { username: string, email: string, password?: string, authType: string },
    verificationData: { verificationToken: string, secret?: string, otpauth_url?: string },
  ) {
    // remove if exists
    const existing = document.getElementById('regCodeModal');
    if (existing) existing.remove();

    const isAuthApp = userData.authType === 'authApp' && verificationData.otpauth_url;

    const modal = document.createElement('div');
    modal.id = 'regCodeModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4';
    modal.innerHTML = `
      <div class="max-w-md w-full bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-white">
        <h3 id="regModalTitle" class="text-2xl font-semibold mb-2">
          ${isAuthApp ? t('totpSetupTitle') : t('emailVerifyTitle')}
        </h3>
        <p id="regModalMessage" class="text-sm text-cyan-200 mb-4">
          ${isAuthApp ? t('totpSetupDescription') : t('emailVerifyDescription')}
        </p>

        ${isAuthApp ? `
          <!-- Auth App QR and Secret Display -->
          <div id="qrCanvasWrapper" class="mb-4 bg-white p-4 rounded-lg flex justify-center">
            <canvas id="qrCanvas"></canvas>
          </div>
          <div id="totpSecretWrapper" class="mb-4">
            <label class="text-xs text-cyan-200 block mb-2">${t('secretLabel')}</label>
            <div class="bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white break-words">
              ${verificationData.secret || t('missingSecretKey')}
            </div>
          </div>
          <div class="mb-4">
            <label class="text-xs text-cyan-200 block mb-2">${t('totpCodeLabel')}</label>
            <input id="totpCodeInput" type="text" inputmode="numeric" maxlength="6" pattern="[0-9]*" placeholder="${t('twoFACodePlaceholder')}"
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none" />
            <p class="text-xs text-cyan-200 mt-2">${t('totpVerifyHelper')}</p>
          </div>
          <div id="regCodeError" class="text-sm text-red-400 mb-2 min-h-[1.25rem]"></div>
        ` : `
          <!-- Email Verification Input -->
          <div id="emailVerificationContent">
            <div class="mb-4">
              <input id="regCodeInput" type="text" maxlength="6" placeholder="${t('regCodePlaceholder')}"
                     class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none" />
            </div>
            <div class="flex items-center justify-between">
               <button id="resendRegCodeBtn" class="text-sm text-cyan-200 underline">${t('resendCode')}</button>
               <div id="regCodeError" class="text-sm text-red-400"></div>
            </div>
          </div>
        `}

        <div id="regModalButtons" class="flex gap-3 mt-4">
          ${isAuthApp ? `
            <button id="completeRegBtn" class="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold">${t('completeRegistration')}</button>
            <button id="dismissRegCodeBtn" class="flex-1 py-2 bg-gray-800/40 rounded-xl">${t('cancelButton')}</button>
          ` : `
            <button id="verifyRegCodeBtn" class="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold">${t('verifyRegisterButton')}</button>
            <button id="dismissRegCodeBtn" class="flex-1 py-2 bg-gray-800/40 rounded-xl">${t('cancelButton')}</button>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const dismissBtn = document.getElementById('dismissRegCodeBtn') as HTMLButtonElement;
    dismissBtn.onclick = () => modal.remove();

    const titleH3 = document.getElementById('regModalTitle') as HTMLHeadingElement;
    const messageP = document.getElementById('regModalMessage') as HTMLParagraphElement;
    const buttonsDiv = document.getElementById('regModalButtons') as HTMLDivElement;
    const errorDivContainer = document.getElementById('regCodeError');
    let errorDiv = errorDivContainer as HTMLDivElement | null;
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'regCodeError';
      errorDiv.className = 'text-sm text-red-400 mb-2';
      buttonsDiv.parentElement?.insertBefore(errorDiv, buttonsDiv);
    }
    const setRegError = (msg: string) => {
      errorDiv!.textContent = msg;
      setTimeout(() => { if (errorDiv) errorDiv.textContent = ''; }, 5000);
    };

    const handleFinalRegistration = async (finalVerificationData: any) => {
      try {
        const res = await fetch(`${API_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Registration runs before a session exists, so we skip credentials to avoid CORS failures
          body: JSON.stringify({
            ...userData,
            ...finalVerificationData
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || t('finalRegistrationError'));
        }

        // Success
        titleH3.textContent = t('registrationCompleteTitle');
        messageP.textContent = t('registrationCompleteMessage');
        if (document.getElementById('emailVerificationContent')) {
          document.getElementById('emailVerificationContent')!.innerHTML = '';
        }
        const qrWrapper = document.getElementById('qrCanvasWrapper');
        if (qrWrapper) qrWrapper.remove();
        const secretWrapper = document.getElementById('totpSecretWrapper');
        if (secretWrapper) secretWrapper.remove();
        buttonsDiv.innerHTML = `
          <button id="proceedToLoginBtn" class="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold">${t('proceedToLogin')}</button>
        `;
        const proceedBtn = document.getElementById('proceedToLoginBtn') as HTMLButtonElement;
        proceedBtn.onclick = () => {
          modal.remove();
          loginTab.click();
        };

        return data;
      } catch (err) {
        setRegError((err as Error).message);
        throw err;
      }
    };

    const attemptAutoLoginAfterRegistration = async (totpCode: string) => {
      if (!totpCode || !userData.email || !userData.password) {
        return false;
      }
      try {
        const loginRes = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userData.email, password: userData.password })
        });
        const loginPayload = await loginRes.json().catch(() => ({}));
        if (!loginRes.ok) {
          return false;
        }
        const loginUser = loginPayload.user || loginPayload;
        const issuedSession = loginPayload.sessionIssued || loginPayload.success || loginPayload.token;
        const resolvedUserId = (loginUser && (loginUser.id || loginUser.userId || loginUser.ID)) || userData.email;

        if (issuedSession && loginUser) {
          localStorage.setItem('user', JSON.stringify(loginUser));
          localStorage.setItem('userId', String(resolvedUserId));
          localStorage.setItem('username', loginUser.username || loginUser.display_name || userData.username || '');
          history.pushState({}, '', '/dashboard');
          window.dispatchEvent(new PopStateEvent('popstate'));
          return true;
        }

        const verifyRes = await fetch(`${API_URL_2FA}/auth/2fa/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: resolvedUserId, code: totpCode })
        });
        if (!verifyRes.ok) {
          return false;
        }
        const verifyPayload = await verifyRes.json().catch(() => ({}));
        const verifiedUser = verifyPayload.user || loginUser;
        if (verifiedUser) {
          localStorage.setItem('user', JSON.stringify(verifiedUser));
          localStorage.setItem('userId', String(verifiedUser.id || resolvedUserId));
          localStorage.setItem('username', verifiedUser.username || verifiedUser.display_name || userData.username || '');
        }
        localStorage.setItem('mode', 'profile-singleplayer');
        localStorage.setItem('waazabi', 'true');
        modal.remove();
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
        return true;
      } catch (err) {
        console.warn('Auto login after registration failed', err);
        return false;
      }
    };

    if (isAuthApp) {
      // --- Authenticator App Flow ---
      const canvas = document.getElementById('qrCanvas') as HTMLCanvasElement;
      if (canvas && verificationData.otpauth_url) {
        QRCode.toCanvas(canvas, verificationData.otpauth_url, { width: 256, margin: 1 }, (error) => {
          if (error) {
            console.error('QR Code generation failed:', error);
            canvas.parentElement!.innerHTML = `<p class="text-red-400">${t('qrGenerationFailed')}</p>`;
          }
        });
      }
      const totpInput = document.getElementById('totpCodeInput') as HTMLInputElement;
      const completeBtn = document.getElementById('completeRegBtn') as HTMLButtonElement;
      completeBtn.onclick = async () => {
        const code = (totpInput?.value || '').trim();
        if (!code) {
          setRegError(t('codeInputRequired'));
          return;
        }
        completeBtn.textContent = t('verifyingText');
        completeBtn.disabled = true;
        try {
          const res = await fetch(`${API_URL_2FA}/auth/2fa/register/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ verificationToken: verificationData.verificationToken, code })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || t('verificationFailed'));
          }
          const finalVerificationData = await res.json();
          completeBtn.textContent = t('completingText');
          await handleFinalRegistration(finalVerificationData);
          await attemptAutoLoginAfterRegistration(code);
        } catch (err) {
          completeBtn.textContent = t('completeRegistration');
          completeBtn.disabled = false;
          setRegError((err as Error).message);
        }
      };
    } else {
      // --- Email Verification Flow ---
      const regCodeInput = document.getElementById('regCodeInput') as HTMLInputElement;
      const verifyBtn = document.getElementById('verifyRegCodeBtn') as HTMLButtonElement;
      const resendBtn = document.getElementById('resendRegCodeBtn') as HTMLButtonElement;

      const sendCode = async () => {
        try {
          resendBtn.textContent = t('sendingText');
          resendBtn.disabled = true;
          const res = await fetch(`${API_URL_2FA}/auth/2fa/register/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: userData.email, authType: 'email' })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || t('resendCodeError'));
          
          verificationData.verificationToken = data.verificationToken; // Update token on resend
          messageP.textContent = t('resendSuccessMessage');
          
          let cooldown = 30;
          const interval = setInterval(() => {
            cooldown -= 1;
            resendBtn.textContent = `${t('codeResendCooldown')} (${cooldown}s)`;
            if (cooldown <= 0) {
              clearInterval(interval);
              resendBtn.disabled = false;
              resendBtn.textContent = t('resendCode');
            }
          }, 1000);
        } catch (err) {
          resendBtn.disabled = false;
          resendBtn.textContent = t('resendCode');
          setRegError((err as Error).message);
        }
      };

      resendBtn.onclick = (e) => {
        e.preventDefault();
        sendCode();
      };

      verifyBtn.onclick = async () => {
        const code = regCodeInput.value.trim();
        if (!code) {
          setRegError(t('codeInputRequired'));
          return;
        }
        try {
          verifyBtn.textContent = t('verifyingText');
          verifyBtn.disabled = true;
          const res = await fetch(`${API_URL_2FA}/auth/2fa/register/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ verificationToken: verificationData.verificationToken, code })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || t('verificationFailed'));
          }
          const finalVerificationData = await res.json();

          // Now that email is verified, complete the registration
          await handleFinalRegistration(finalVerificationData);
        } catch (err) {
          setRegError((err as Error).message);
          verifyBtn.disabled = false;
          verifyBtn.textContent = t('verifyRegisterButton');
        }
      };
    }
  }

  // Login handler
  loginForm.onsubmit = async (e) => {
    e.preventDefault();

    const isSecureContext = window.location.protocol === 'https:';
    const isLocalEnv = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (!isSecureContext && !isLocalEnv) {
      showError(t('loginInsecureProtocolError'));
      return;
    }

    const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
    const password = (document.getElementById('loginPassword') as HTMLInputElement).value;

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || t('loginFailed'));
      }

      const data = await res.json();

      const user = data.user || data;

      // If backend explicitly tells us 2FA is required, just show the modal
      if (user && user.requires2FA) {
        const authType = user.authType || 'email';
        show2FAModal(user, authType);
        return;
      }

      // If login already established a session (no 2FA required)
      if (data.sessionIssued || data.success || data.token) {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('userId', String(user.id));
        localStorage.setItem('username', user.username || '');
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }

      // No explicit 2FA flag — ask the 2FA service whether this user has 2FA configured.
      // Try status endpoint first (recommended). If not present/it fails, fallback to sending an email code.
      const userId = user && (user.id || user.userId || user.ID) ? (user.id || user.userId || user.ID) : email;

      try {
        // If your 2FA service supports a status endpoint, it should return something like:
        // { requires2FA: true, type: 'email'|'authApp' }
        const statusRes = await fetch(`${API_URL_2FA}/auth/2fa/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId })
        });

        if (statusRes.ok) {
          const statusData = await statusRes.json().catch(() => ({}));
          if (statusData && statusData.requires2FA) {
            const authType = statusData.type || 'email';
            show2FAModal({ ...user, id: userId }, authType);
            return;
          }
          // status says no 2FA -> proceed normally
          localStorage.setItem('user', JSON.stringify(user));
          localStorage.setItem('userId', String(userId));
          localStorage.setItem('username', user.username || user.display_name || '');
              localStorage.setItem('lhawa' , 'true');
          history.pushState({}, '', '/dashboard');
          window.dispatchEvent(new PopStateEvent('popstate'));
          return;
        }

        // If status endpoint 404s or returns error, fall through to fallback attempt below
      } catch (err) {
        // proceed to fallback attempt below
      }

      // Fallback: attempt to send an email code (best-effort). If this succeeds, prompt for code.
      try {
        const sendRes = await fetch(`${API_URL_2FA}/auth/2fa/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId })
        });

        if (sendRes.ok) {
          // If the 2FA service accepted the send request, show the modal for email 2FA
          show2FAModal({ ...user, id: userId }, 'email');
          return;
        }

        // If send failed, log and continue to normal login
      } catch (err) {
        // Fallback 2FA send failed
      }

      // No 2FA required or couldn't determine it — proceed to normal login
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userId', String(userId));
      localStorage.setItem('username', user.username || user.display_name || '');
          localStorage.setItem('l9lawi' , 'true');
      history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      showError((err as Error).message);
    }
  };

  // Register handler (updated to request 2FA code/setup and show it)
  registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = (document.getElementById('regUsername') as HTMLInputElement).value;
    const email = (document.getElementById('regEmail') as HTMLInputElement).value;
    const password = (document.getElementById('regPassword') as HTMLInputElement).value;
    const authTypeInput = (document.querySelector('input[name="authType"]:checked') as HTMLInputElement);
    const authType = authTypeInput ? authTypeInput.value : 'email';

    const userData = { username, email, password, authType };

    try {
      // Step 1: Initiate registration with the 2FA service.
      // This service should not create a user but generate a temporary token and send code/return secret.
      const initiateRes = await fetch(`${API_URL_2FA}/auth/2fa/register/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          email,
          authType
        })
      });

      const verificationData = await initiateRes.json().catch(() => ({}));
      if (!initiateRes.ok) {
        throw new Error(verificationData.error || t('registrationStartError'));
      }

      if (!verificationData.verificationToken) {
        throw new Error(t('missingVerificationToken'));
      }

      // Step 2: Show the appropriate modal for code entry or QR scan.
      // The password is included in userData to be used in the final registration step.
      showRegistrationCodeModal(userData, verificationData);

    } catch (err) {
      showError((err as Error).message);
    }
  };
}
