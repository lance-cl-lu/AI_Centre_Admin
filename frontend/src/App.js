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
import PrivateRoute from './context/PrivateRoute';
import AddExcel from './components/Add/Excel';
import Login from './components/Login';
import { AuthProvider } from './context/AuthContext';
import {Routes, Route, useLocation} from 'react-router-dom';
import Infolist from './components/Infolist';
import { CSSTransition, TransitionGroup } from 'react-transition-group'

function App() {
  const location = useLocation();
  return (
    <div className="App">
      
      <Navbar />
      <div className='Centre-Page'>
        <AuthProvider>

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
                <Route path="lab" element={<Lab />} />
                <Route path="user" element={<User />} />
                <Route path="*" element={<Home />} />
                </Routes>
                
            </CSSTransition>
          </TransitionGroup>
        </AuthProvider>
      </div>
      
    </div>
  );
}

export default App;
