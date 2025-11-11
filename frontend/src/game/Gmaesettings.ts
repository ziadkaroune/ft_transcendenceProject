/** 🔧 Create and manage in-page Game Settings modal */
export function openGameSettingsModal(mode: string) {
  // Prevent duplicate modals
  if (document.getElementById('game-settings-modal')) return;

  /** Load existing settings (if any) */
  const saved = localStorage.getItem(`settings_${mode}`);
  const currentSettings = saved
    ? JSON.parse(saved)
    : {
        mode: 'custom',
        winScore: 2,
        ballSpeed: 0.8,
        paddleSpeed: 5,
      };

  /** Modal markup */
  const modal = document.createElement('div');
  modal.id = 'game-settings-modal';
  modal.className =
    'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';

  modal.innerHTML = `
    <div class="bg-gradient-to-br from-purple-800 via-black to-blue-900 text-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-fadeIn">
      <h2 class="text-3xl font-bold mb-6 text-center">⚙️ Game Settings</h2>

      <form id="settingsForm" class="space-y-5">

        <div>
          <label class="block text-lg mb-2"> Win Score</label>
          <input type="number" id="winScore" value="${currentSettings.winScore}" min="1"
            class="w-full p-2 rounded-lg text-black" />
        </div>

        <div>
          <label class="block text-lg mb-2"> Ball Speed</label>
          <input type="range" id="ballSpeed" min="0.5" max="2.0" step="0.1"
            value="${currentSettings.ballSpeed}" class="w-full accent-cyan-400" />
          <p id="ballSpeedValue" class="text-center text-sm mt-1 text-gray-300">${currentSettings.ballSpeed}</p>
        </div>

        <div>
          <label class="block text-lg mb-2"> Paddle Speed</label>
          <input type="range" id="paddleSpeed" min="3" max="10" step="0.5"
            value="${currentSettings.paddleSpeed}" class="w-full accent-cyan-400" />
          <p id="paddleSpeedValue" class="text-center text-sm mt-1 text-gray-300">${currentSettings.paddleSpeed}</p>
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button type="button" id="cancelSettings" class="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition">
            Cancel
          </button>
          <button type="submit" class="px-5 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 transition">
            OK
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  /** Dynamic display for sliders */
  const ballSpeedInput = modal.querySelector('#ballSpeed') as HTMLInputElement;
  const paddleSpeedInput = modal.querySelector('#paddleSpeed') as HTMLInputElement;
  const ballSpeedValue = modal.querySelector('#ballSpeedValue')!;
  const paddleSpeedValue = modal.querySelector('#paddleSpeedValue')!;

  ballSpeedInput.addEventListener('input', () => {
    ballSpeedValue.textContent = ballSpeedInput.value;
  });
  paddleSpeedInput.addEventListener('input', () => {
    paddleSpeedValue.textContent = paddleSpeedInput.value;
  });

  /** Cancel button */
  modal.querySelector('#cancelSettings')?.addEventListener('click', () => {
    closeModal();
  });

  /** Submit / OK button */
  modal.querySelector('#settingsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const settings = {
      mode: 'custom',
      winScore: parseInt((modal.querySelector('#winScore') as HTMLInputElement).value),
      ballSpeed: parseFloat((modal.querySelector('#ballSpeed') as HTMLInputElement).value),
      paddleSpeed: parseFloat((modal.querySelector('#paddleSpeed') as HTMLInputElement).value),
    };

    localStorage.setItem(`settings_${mode}`, JSON.stringify(settings));
    closeModal();
  });

  /** Close and cleanup */
  function closeModal() {
    modal.classList.add('animate-fadeOut');
    setTimeout(() => modal.remove(), 300);
  }
}

/** Add Tailwind animations if not already included */
const style = document.createElement('style');
style.innerHTML = `
@keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes fadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.9); } }
.animate-fadeIn { animation: fadeIn 0.25s ease-out; }
.animate-fadeOut { animation: fadeOut 0.25s ease-in; }
`;
document.head.appendChild(style);
