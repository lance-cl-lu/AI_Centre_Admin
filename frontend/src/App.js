import './App.css';
import Home from './components/Home';
import About from './components/About';
import Navbar from './components/Navbar';
import Add from './components/Add';
import AddLab from './components/Add/Lab';
import AddUser from './components/Add/User';
import AddAdmin from './components/Add/Admin';
import Lab from './components/Lab';
import User from './components/User';
import AddExcel from './components/Add/Excel';
import Login from './components/Login';
import { AuthProvider } from './context/AuthContext';
import {Routes, Route, useLocation} from 'react-router-dom';
import Infolist from './components/Infolist';
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import "../node_modules/bootstrap/dist/css/bootstrap.min.css";

function App() {
  const location = useLocation();
  
  return (
    <div className="App">
      <AuthProvider>
      <Navbar />

      <div className='Centre-Page'>
          <Infolist/>
          <TransitionGroup className='Centre-Page-Content'>
            <CSSTransition key={location.pathname} timeout={1000} classNames={'fade'}>

                <Routes>
                <Route exact path="/" element={<Home />} />
                <Route path="about/" element={<About />} />
                <Route path="add/" element={<Add />} />
                <Route path="add/lab" element={<AddLab />} />
                <Route path="add/user" element={<AddUser />} />
                <Route path="add/admin" element={<AddAdmin />} />
                <Route path="add/excel" element={<AddExcel />} />
                <Route path="login" element={<Login />} />
                <Route path="*" element={<Home />} />
                <Route path="lab" element={<Lab />} />
                <Route path="user" element={<User />} />
                </Routes>
                
            </CSSTransition>
          </TransitionGroup>
      </div>
      </AuthProvider>
    </div>
  );
}

export default App;
