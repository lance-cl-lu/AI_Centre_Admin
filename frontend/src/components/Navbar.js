import "./Navbar.css"
import { Link } from "react-router-dom";
import Dropdonw from "./Dropdown";
import { AuthProvider } from '../context/AuthContext';
import { useState } from "react";
import jwt_decode from "jwt-decode";
function Navbar() {
  const [ permission ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)
  console.log(permission)
  let resultMatch = /.*admin$/.test(permission);
  return (
    <nav className="navigation">
        <ul className="navigation-ul">
          <li>
            <a href="/" style={{textDecoration: "none", color: "white"}}>
              <img src="https://www.cgu.edu.tw/Uploads/Logo/226cbf55-707f-4b74-88eb-61a390e760e2.png" alt="CUG AI Centre" style={{marginLeft: "15px"}}>
              </img>
            </a>
          </li>
          <div className="navigation-ul-div">
            <li className="navigation-ul-li"><Link to="/">Home</Link></li>
            <li className="navigation-ul-li"><Link to="/about">About</Link></li>
            { resultMatch || permission==='root' ? (
            <li className="navigation-ul-li"><Link to="/add">Add</Link></li>
            ) : (
              null
            )}
            <li classname="navigation-ul-li"><Link to="/move" >Move</Link></li>
          <AuthProvider>
            <li className="navigation-ul-li"><Dropdonw></Dropdonw></li>
          </AuthProvider>

          </div>
      </ul>
    </nav>
  );
}
export default Navbar;