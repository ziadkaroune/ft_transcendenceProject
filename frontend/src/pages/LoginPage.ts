import QRCode from 'qrcode';

const API_URL = 'http://localhost:3103';
const API_URL_2FA = 'http://localhost:3105';

export function renderLoginPage() {
  const app = document.getElementById('app');
  if (!app) return;

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
            Login
          </button>
          <button id="registerTab" 
                  class="flex-1 py-2 rounded-lg font-semibold transition-all duration-300 
                         text-gray-300 hover:text-white">
            Register
          </button>
        </div>

        <!-- Login Form -->
        <form id="loginForm" class="space-y-5">
          <h2 class="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text 
                     bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
            Welcome Back
          </h2>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">Email</label>
            <input type="email" id="loginEmail" required
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">Password</label>
            <input type="password" id="loginPassword" required
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <button type="submit" 
                  class="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl 
                         font-bold text-lg shadow-lg hover:scale-105 transition-all">
            Login
          </button>
        </form>

        <!-- Register Form (Hidden by default) -->
        <form id="registerForm" class="space-y-5 hidden">
          <h2 class="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text 
                     bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
            Create Account
          </h2>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">Username</label>
            <input type="text" id="regUsername" required
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">Email</label>
            <input type="email" id="regEmail" required
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <div>
            <label class="block text-sm font-medium text-cyan-300 mb-2">Password</label>
            <input type="password" id="regPassword" required minlength="6"
                   class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 
                          text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>

          <!-- 2FA selection -->
          <div class="text-sm text-cyan-300">
            <div class="mb-2 font-medium">Two-factor (2FA) method</div>
            <div class="flex gap-4 items-center">
              <label class="flex items-center gap-2">
                <input type="radio" name="authType" value="email" checked />
                <span>Email (receive code by email)</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="radio" name="authType" value="authApp" />
                <span>Authenticator app (TOTP)</span>
              </label>
            </div>
            <div class="mt-2 text-xs text-cyan-200">Choose whether you'd like codes by email or to use an authenticator app (Google Authenticator, Authy, etc.).</div>
          </div>

          <button type="submit" 
                  class="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl 
                         font-bold text-lg shadow-lg hover:scale-105 transition-all">
            Register
          </button>
        </form>

        <div id="errorMsg" class="mt-4 text-center text-red-400 text-sm hidden"></div>

        <!-- Back to Home -->
        <button id="backHomeBtn"
                class="w-full mt-6 py-2 bg-gray-800/50 rounded-xl text-gray-300 
                       hover:bg-gray-700/50 transition-all">
          ← Back to Home
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
        <h3 class="text-2xl font-semibold mb-2">Two-factor authentication</h3>
        <p id="twoFAMessage" class="text-sm text-cyan-200 mb-4">
          ${authType === 'email' ? 'A security code was sent to your email.' : 'Enter the 6-digit code from your authenticator app.'}
        </p>

        <div class="mb-4">
          <input id="twoFAInput" type="text" maxlength="10" placeholder="Enter security code"
                 class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none" />
        </div>

        <div class="flex gap-3">
          <button id="verify2FABtn" class="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold">Verify</button>
          <button id="cancel2FABtn" class="flex-1 py-2 bg-gray-800/40 rounded-xl">Cancel</button>
        </div>

        ${
          authType === 'email'
            ? `
          <div class="mt-3 flex items-center justify-between">
            <button id="resend2FABtn" class="text-sm text-cyan-200 underline">Resend code</button>
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
          resend2FABtn.textContent = 'Sending...';
          resend2FABtn.setAttribute('disabled', 'true');
        }
        const res = await fetch(`${API_URL_2FA}/auth/2fa/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, email: user.email })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to send code');
        }
        twoFAMessage.textContent = 'A security code has been sent to your email.';
        if (resend2FABtn) {
          // simple cooldown
          let cooldown = 30;
          const interval = setInterval(() => {
            cooldown -= 1;
            resend2FABtn.textContent = `Resend (${cooldown}s)`;
            if (cooldown <= 0) {
              clearInterval(interval);
              resend2FABtn.removeAttribute('disabled');
              resend2FABtn.textContent = 'Resend code';
            }
          }, 1000);
        }
      } catch (err) {
        if (resend2FABtn) {
          resend2FABtn.removeAttribute('disabled');
          resend2FABtn.textContent = 'Resend code';
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
        setTwoFAError('Please enter the code.');
        return;
      }
      try {
        verify2FABtn.textContent = 'Verifying...';
        verify2FABtn.setAttribute('disabled', 'true');
        const res = await fetch(`${API_URL_2FA}/auth/2fa/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, code })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Invalid code');
        }
        const verifiedUser = await res.json();
        // Save and navigate
        localStorage.setItem('user', JSON.stringify(verifiedUser));
        localStorage.setItem('userId', verifiedUser.id.toString());
        localStorage.setItem('username', verifiedUser.username);
        localStorage.setItem('mode' , "profile-singleplayer");
        localStorage.setItem('waazabi' , 'true');
        modal.remove();
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch (err) {
        setTwoFAError((err as Error).message);
        verify2FABtn.removeAttribute('disabled');
        verify2FABtn.textContent = 'Verify';
      }
    };
  }

  // Helper: show registration code / setup modal (for email code or authApp secret)
  function showRegistrationCodeModal(user: { id: any; email?: string }, code: string | null, authType: string, extra?: { otpauth_url?: string }) {
    // remove if exists
    const existing = document.getElementById('regCodeModal');
    if (existing) existing.remove();

    const isAuthApp = authType === 'authApp' && extra?.otpauth_url;

    const modal = document.createElement('div');
    modal.id = 'regCodeModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4';
    modal.innerHTML = `
      <div class="max-w-md w-full bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-white">
        <h3 id="regModalTitle" class="text-2xl font-semibold mb-2">
          ${isAuthApp ? 'Set up Authenticator App' : 'Verify Your Email'}
        </h3>
        <p id="regModalMessage" class="text-sm text-cyan-200 mb-4">
          ${isAuthApp ? 'Scan the image below with your authenticator app.' : 'To complete registration, please enter the code sent to your email.'}
        </p>

        ${isAuthApp ? `
          <!-- Auth App QR and Secret Display -->
          <div class="mb-4 bg-white p-4 rounded-lg flex justify-center">
            <canvas id="qrCanvas"></canvas>
          </div>
          <div class="mb-4">
            <label class="text-xs text-cyan-200 block mb-2">Or enter this secret key manually:</label>
            <div class="bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white break-words">
              ${code || 'Error: No secret key provided.'}
            </div>
          </div>
        ` : `
          <!-- Email Verification Input -->
          <div id="emailVerificationContent">
            <div class="mb-4">
              <input id="regCodeInput" type="text" maxlength="6" placeholder="Enter verification code"
                     class="w-full bg-black/50 border border-cyan-500/60 rounded-xl px-4 py-3 text-white focus:outline-none" />
            </div>
            <div class="flex items-center justify-between">
               <button id="resendRegCodeBtn" class="text-sm text-cyan-200 underline">Resend code</button>
               <div id="regCodeError" class="text-sm text-red-400"></div>
            </div>
          </div>
        `}

        <div id="regModalButtons" class="flex gap-3 mt-4">
          ${isAuthApp ? `
            <button id="proceedToLoginBtn" class="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold">Proceed to Login</button>
            <button id="dismissRegCodeBtn" class="flex-1 py-2 bg-gray-800/40 rounded-xl">Close</button>
          ` : `
            <button id="verifyRegCodeBtn" class="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold">Verify Email</button>
            <button id="dismissRegCodeBtn" class="flex-1 py-2 bg-gray-800/40 rounded-xl">Cancel</button>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const dismissBtn = document.getElementById('dismissRegCodeBtn') as HTMLButtonElement;
    dismissBtn.onclick = () => modal.remove();

    if (isAuthApp) {
      // --- Authenticator App Flow ---
      const canvas = document.getElementById('qrCanvas') as HTMLCanvasElement;
      if (canvas && extra.otpauth_url) {
        QRCode.toCanvas(canvas, extra.otpauth_url, { width: 256, margin: 1 }, (error) => {
          if (error) {
            console.error('QR Code generation failed:', error);
            canvas.parentElement!.innerHTML = `<p class="text-red-400">Could not generate QR code.</p>`;
          }
        });
      }
      const proceedBtn = document.getElementById('proceedToLoginBtn') as HTMLButtonElement;
      proceedBtn.onclick = () => {
        modal.remove();
        loginTab.click();
      };
    } else {
      // --- Email Verification Flow ---
      const regCodeInput = document.getElementById('regCodeInput') as HTMLInputElement;
      const verifyBtn = document.getElementById('verifyRegCodeBtn') as HTMLButtonElement;
      const resendBtn = document.getElementById('resendRegCodeBtn') as HTMLButtonElement;
      const errorDiv = document.getElementById('regCodeError') as HTMLDivElement;
      const messageP = document.getElementById('regModalMessage') as HTMLParagraphElement;
      const buttonsDiv = document.getElementById('regModalButtons') as HTMLDivElement;
      const contentDiv = document.getElementById('emailVerificationContent') as HTMLDivElement;
      const titleH3 = document.getElementById('regModalTitle') as HTMLHeadingElement;

      const setRegError = (msg: string) => {
        errorDiv.textContent = msg;
        setTimeout(() => { errorDiv.textContent = ''; }, 5000);
      };

      const handleSuccess = () => {
        titleH3.textContent = 'Email Verified!';
        messageP.textContent = 'Your registration is complete. You can now log in.';
        contentDiv.innerHTML = ''; // Remove input and buttons
        buttonsDiv.innerHTML = `
          <button id="proceedToLoginBtn" class="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold">Proceed to Login</button>
        `;
        const proceedBtn = document.getElementById('proceedToLoginBtn') as HTMLButtonElement;
        proceedBtn.onclick = () => {
          modal.remove();
          loginTab.click();
        };
      };

      const sendCode = async () => {
        try {
          resendBtn.textContent = 'Sending...';
          resendBtn.disabled = true;
          const res = await fetch(`${API_URL_2FA}/auth/2fa/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, email: user.email })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to send code');
          }
          messageP.textContent = 'A new code has been sent to your email.';
          // Cooldown timer
          let cooldown = 30;
          const interval = setInterval(() => {
            cooldown -= 1;
            resendBtn.textContent = `Resend (${cooldown}s)`;
            if (cooldown <= 0) {
              clearInterval(interval);
              resendBtn.disabled = false;
              resendBtn.textContent = 'Resend code';
            }
          }, 1000);
        } catch (err) {
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend code';
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
          setRegError('Please enter the code.');
          return;
        }
        try {
          verifyBtn.textContent = 'Verifying...';
          verifyBtn.disabled = true;
          const res = await fetch(`${API_URL_2FA}/auth/2fa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, code })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Verification failed');
          }
          handleSuccess();
        } catch (err) {
          setRegError((err as Error).message);
          verifyBtn.disabled = false;
          verifyBtn.textContent = 'Verify Email';
        }
      };
    }
  }

  // Login handler
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
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
        throw new Error(error.error || 'Login failed');
      }

      const user = await res.json();
      console.debug('Login response user:', user);

      // If backend explicitly tells us 2FA is required, just show the modal
      if (user && user.requires2FA) {
        const authType = user.authType || 'email';
        show2FAModal(user, authType);
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
          body: JSON.stringify({ userId })
        });

        if (statusRes.ok) {
          const statusData = await statusRes.json().catch(() => ({}));
          console.debug('/auth/2fa/status', statusData);
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
        console.debug('/auth/2fa/status returned non-ok:', statusRes.status);
      } catch (err) {
        console.debug('2FA status check failed or not implemented:', err);
        // proceed to fallback attempt below
      }

      // Fallback: attempt to send an email code (best-effort). If this succeeds, prompt for code.
      try {
        const sendRes = await fetch(`${API_URL_2FA}/auth/2fa/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });

        if (sendRes.ok) {
          const sendData = await sendRes.json().catch(() => ({}));
          console.debug('/auth/2fa/send', sendData);
          // If the 2FA service accepted the send request, show the modal for email 2FA
          show2FAModal({ ...user, id: userId }, 'email');
          return;
        }

        // If send failed, log and continue to normal login
        console.debug('/auth/2fa/send failed with status', sendRes.status);
      } catch (err) {
        console.debug('Fallback 2FA send failed:', err);
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

    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, authType })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // created user returned either as data.user or data
      const createdUser = (data && (data.user || data)) || null;

      // If backend created the user and we have an id, trigger 2FA send/setup
      if (createdUser && createdUser.id) {
        try {
          if (authType === 'email') {
            // Ask 2FA service to send code; it may return the code for dev/demo
            const sendRes = await fetch(`${API_URL_2FA}/auth/2fa/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: createdUser.id, email: createdUser.email || email })
            });
            const sendData = await sendRes.json().catch(() => ({}));
            if (!sendRes.ok) throw new Error(sendData.error || 'Failed to send verification code');

            const returnedCode = sendData.code || null;
            console.debug('2FA email code sent/returned:', returnedCode);
            showRegistrationCodeModal(createdUser, returnedCode, 'email');
            return;
          } else if (authType === 'authApp') {
            // Ask 2FA service to set up TOTP for the user and return secret/otpauth_url (for QR)
            const setupRes = await fetch(`${API_URL_2FA}/auth/2fa/setup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: createdUser.id })
            });
            const setupData = await setupRes.json().catch(() => ({}));
            if (!setupRes.ok) throw new Error(setupData.error || 'Failed to setup authenticator app');

            const secretOrCode = setupData.secret || setupData.code || null;
            showRegistrationCodeModal(createdUser, secretOrCode, 'authApp', { otpauth_url: setupData.otpauth_url });
            return;
          }
        } catch (err) {
          // If 2FA send/setup fails, still notify user and fall back to asking them to login
          showError((err as Error).message || '2FA setup failed. Please login and try again.');
          setTimeout(() => loginTab.click(), 1500);
          return;
        }
      }

      // If we don't have a created user id or no 2FA step, just show success and go to login
      showError('Registration successful! Please login.');
      setTimeout(() => loginTab.click(), 1500);
    } catch (err) {
      showError((err as Error).message);
    }
  };
}
