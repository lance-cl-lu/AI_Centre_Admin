import './App.css';
import Home from './components/Home';
import About from './components/About';
import Navbar from './components/Navbar';
import Add from './components/Add';
import AddLab from './components/Add/Lab';
import AddUser from './components/Add/User';
import AddAdmin from './components/Add/Admin';
import Lab from './components/Lab';
import Password from './components/password';
import User from './components/User';
import AddExcel from './components/Add/Excel';
import Login from './components/Login';
import AuthContext from './context/AuthContext';
import {Routes, Route } from 'react-router-dom';
import Infolist from './components/Infolist';
import "../node_modules/bootstrap/dist/css/bootstrap.min.css";
import { useContext } from 'react';
import Help from './components/Help';

function App() {
  let user = useContext(AuthContext).user;
  return (
    <div className="App">
      { user ? 
      <>
        <Navbar />
          <div className='Centre-Page'>
              <Infolist/>
              <div className='Centre-Page-Content'>
                  <Routes>
                    <Route exact path="/" element={<Home />} />
                    <Route path='password' element={<Password></Password>}/>
                    <Route path="about/" element={<About />} />
                    <Route path="add/" element={<Add />} />
                    <Route path="add/lab" element={<AddLab />} />
                    <Route path="add/user" element={<AddUser />} />
                    <Route path="add/admin" element={<AddAdmin />} />
                    <Route path="add/excel" element={<AddExcel />} />
                    <Route path="login" element={<Login />} />
                    <Route path="lab" element={<Lab />} />
                    <Route path="user" element={<User />} />
                    <Route path="help" element={<Help />} />
                    <Route path="*" element={<Home />} />
                  </Routes>
              </div>
          </div>
        </>
      :
        <Login/>
      }
    </div>
  );
}

export default App;
