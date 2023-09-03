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
import { useState } from "react"
import jwt_decode from "jwt-decode"
function App() {
  let user = useContext(AuthContext).user;
  const [ permission ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)
  console.log(permission)
  let resultMatch = /.*admin$/.test(permission);
  return (
    <div className="App">
      <head className="App-header">
        <title>CGU AI Center Ldap Management System</title>
        < link rel="icon" href="https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww2.cgu.edu.tw%2Fp%2F404-1000-2060.php%3FLang%3Dzh-tw&psig=AOvVaw3uBQ2YAwmw0WOJCXnj9IVr&ust=1693366686377000&source=images&cd=vfe&opi=89978449&ved=0CBAQjRxqFwoTCLj-rND4gIEDFQAAAAAdAAAAABAZ"type="image/x-icon" />
      </head>
	{ user ? 
      <>
        { resultMatch || permission==='root' ? (
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
        ) : (
        <>
        <Navbar />
          <div className='Centre-Page-user'>
              <div className='Centre-Page-Content-user'>
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
        )}
        </>
      :
        <Login/>
      }
    </div>
  );
}

export default App;
