import "./Navbar.css"
import { Link } from "react-router-dom";
import Dropdonw from "./Dropdown";
import { AuthProvider } from '../context/AuthContext';
import { useState } from "react";
import jwt_decode from "jwt-decode";
function Navbar() {
  const [ permission ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)
  console.log(permission)
  return (
    <nav className="navigation">
        <ul className="navigation-ul">
          <li><img src="https://aic.cgu.edu.tw/var/file/44/1044/msys_1044_4886051_59674.png" alt="CUG AI Centre"/></li>
          <div className="navigation-ul-div">
            <li className="navigation-ul-li"><Link to="/">Home</Link></li>
            <li className="navigation-ul-li"><Link to="/about">About</Link></li>
            <li className="navigation-ul-li"><Link to="/add">Add</Link></li>
          <AuthProvider>
            <li className="navigation-ul-li"><Dropdonw></Dropdonw></li>
          </AuthProvider>

          </div>
      </ul>
    </nav>
  );
}
export default Navbar;