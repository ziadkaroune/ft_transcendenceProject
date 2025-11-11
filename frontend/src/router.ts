import { renderLandingPage } from './HomePage';
import { renderRegistrationPage } from './Modes/GuestMode/multiMode.ts/multiPlayer';
import { renderGamePage } from './game/GamePage';
import { GuestPage } from './Modes/GuestMode/GuestPage';
import { NotFoundPage } from './pages/Error404';
import { renderOpponentSettingsPage } from './Modes/GuestMode/singleMode/singlePlayer';
import { renderLoginPage } from './pages/LoginPage';
import { renderDashboardPage } from './pages/DashboardPage';
import { renderProfileGamePage } from './pages/ProfileGamePage';

export function initRouter() {
  const app = document.getElementById('app');
  if (!app) return;

  const path = window.location.pathname;
  render(path);

  window.onpopstate = () => render(window.location.pathname);
}

function render(path: string) {
  const app = document.getElementById('app');
  if (!app) return;

  const isloggedin = localStorage.getItem('user');
  if (path === '/login') {
    if(isloggedin){
       history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
       renderDashboardPage(); 
    }
       
    else  // return user to dashbord if he's already logged in
      renderLoginPage();
  } else if (path === '/dashboard') {
     if(!isloggedin){
        history.pushState({}, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
        renderLoginPage();
    }
    else
       renderDashboardPage();
  } else if (path === '/profile-game') {
    renderProfileGamePage();
  } else if (path === '/guestmode') {
    GuestPage();
  } else if (path === '/game') {
    renderGamePage("guest");
  } else if (path === '/multimode') {
    renderRegistrationPage();
  } else if (path === '/singlemode') {
      if(isloggedin){
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
        renderDashboardPage();
    }
    else 
       renderOpponentSettingsPage();
  } else if (path === '/') {
    renderLandingPage();
  } else {
    NotFoundPage();
  }
}
