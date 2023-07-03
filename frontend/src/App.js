import './App.css';
import Home from './components/Home';
import About from './components/About';
import Navbar from './components/Navbar';
import {Routes, Route} from 'react-router-dom';
import Infolist from './components/Infolist';
function App() {
  return (
    <div className="App">
      <Navbar />
      <div className='Centre-Page'>
        <Infolist/>
        <div className='Centre-Page-Content'>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </div>

    </div>
  );
}

export default App;
