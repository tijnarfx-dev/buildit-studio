// src/App.tsx
import { DemProvider } from "./core/DemContext";
import { Community } from "./editions/community/Community";
import "./App.css";

function App() {
  return (
    <DemProvider>
      <Community />
    </DemProvider>
  );
}

export default App;