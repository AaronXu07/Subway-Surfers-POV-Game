import { useEffect, useState } from 'react';
import { LandingPage } from './landing/LandingPage';
import { Game } from './game/Game';

// Minimal hash-based routing (no router dependency):
//   default / "#"  -> landing page (waitlist)
//   "#play"        -> live game demo (mounts the webcam pipeline)
function getRoute() {
  return window.location.hash === '#play' ? 'game' : 'landing';
}

function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Game is only mounted on the #play route, so the webcam/pose pipeline
  // never starts while a visitor is on the landing page.
  return route === 'game' ? <Game /> : <LandingPage />;
}

export default App;
