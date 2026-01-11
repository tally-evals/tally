import "./index.css";
import { useState, useEffect } from "react";
import { ConversationList } from "./pages/ConversationList";
import { ConversationView } from "./pages/ConversationView";
import { TrajectoryView } from "./pages/TrajectoryView";
import { Header } from "./components/Header";

type Route =
  | { type: "home" }
  | { type: "conversation"; id: string }
  | { type: "trajectory"; id: string };

function parseRoute(hash: string): Route {
  if (hash.startsWith("#/conversations/") && hash.endsWith("/trajectory")) {
    const id = hash.slice("#/conversations/".length, -"/trajectory".length);
    return { type: "trajectory", id };
  }
  if (hash.startsWith("#/conversations/")) {
    const id = hash.slice("#/conversations/".length);
    return { type: "conversation", id };
  }
  return { type: "home" };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseRoute(window.location.hash));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {route.type === "home" && <ConversationList />}
        {route.type === "conversation" && <ConversationView id={route.id} />}
        {route.type === "trajectory" && <TrajectoryView id={route.id} />}
      </main>
    </div>
  );
}

export default App;
