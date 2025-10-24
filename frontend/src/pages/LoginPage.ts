const API_URL = 'http://localhost:3103';

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
        const error = await res.json();
        throw new Error(error.error || 'Login failed');
      }

      const user = await res.json();
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userId', user.id.toString());
      localStorage.setItem('username', user.username);

      history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      showError((err as Error).message);
    }
  };

  // Register handler
  registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = (document.getElementById('regUsername') as HTMLInputElement).value;
    const email = (document.getElementById('regEmail') as HTMLInputElement).value;
    const password = (document.getElementById('regPassword') as HTMLInputElement).value;

    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Registration failed');
      }

      showError('Registration successful! Please login.');
      setTimeout(() => loginTab.click(), 1500);
    } catch (err) {
      showError((err as Error).message);
    }
  };
}
