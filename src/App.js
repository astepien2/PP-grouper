import logo from './logo.svg';
import './App.css';
import cleanup from './cleanup.svg'
import Upload from "./upload";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import Folders from "./folders";

function Tabs() {
  const location = useLocation();
  return (
    <nav style={{ width: '100%', background: '#fff', borderBottom: '1px solid #eee', marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
      <Link
        to="/"
        style={{
          padding: '14px 32px',
          textDecoration: 'none',
          color: location.pathname === '/' ? '#1976d2' : '#333',
          borderBottom: location.pathname === '/' ? '3px solid #1976d2' : '3px solid transparent',
          fontWeight: 600,
          fontSize: 18
        }}
      >Upload Photos</Link>
      <Link
        to="/folders"
        style={{
          padding: '14px 32px',
          textDecoration: 'none',
          color: location.pathname === '/folders' ? '#1976d2' : '#333',
          borderBottom: location.pathname === '/folders' ? '3px solid #1976d2' : '3px solid transparent',
          fontWeight: 600,
          fontSize: 18
        }}
      >Folders</Link>
    </nav>
  );
}

function App() {
  return (
    <div className="App">
      <Router>
        <Tabs />
        <header className="App-header">
          <Routes>
            <Route path="/" element={<><img src={cleanup} className="App-logo" alt="logo" /><Upload /></>} />
            <Route path="/folders" element={<Folders />} />
          </Routes>
        </header>
      </Router>
    </div>
  );
}

export default App;
