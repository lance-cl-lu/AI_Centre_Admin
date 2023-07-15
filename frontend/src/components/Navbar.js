import "./Navbar.css"
import { Link, useLocation } from "react-router-dom";
import Dropdonw from "./Dropdown";
import { AuthProvider } from '../context/AuthContext';
import { useContext } from "react";
import AuthContext from '../context/AuthContext';

function Navbar() {
  let {user} = useContext(AuthContext);
  console.log(user);

  return (
    <nav className="navigation">
        <ul className="navigation-ul">
          <li><img src="https://aic.cgu.edu.tw/var/file/44/1044/msys_1044_4886051_59674.png" alt="CUG AI Centre"/></li>
          <div className="navigation-ul-div">
            {user && <li className="navigation-ul-li"><Link to="/">Home</Link></li> }
            {user && <li className="navigation-ul-li"><Link to="/about">About</Link></li> }
            {user && <li className="navigation-ul-li"><Link to="/add">Add</Link></li> }
          <AuthProvider>
            <li className="navigation-ul-li"><Dropdonw></Dropdonw></li>
          </AuthProvider>

          </div>
      </ul>
    </nav>
  );
}
export default Navbar;