import React, { useState, useEffect, useContext } from "react";
import "./Dropdown.css";
import { Link } from "react-router-dom";
import AuthContext from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

function Dropdown() {
  let { user, logoutUser } = useContext(AuthContext);
  const [click, setClick] = useState(false);
  const location = useLocation();
  const handleClick = () => setClick(!click);
  const closeMobileMenu = () => setClick(false);
  useEffect(() => {
    closeMobileMenu();
  }, [location]);


  return (
    <div className="dropdown">
      {user ? <button onClick={handleClick} className="dropbtn">●</button> :　<Link to="/login" className="dropdown-link">Login</Link>}
      {click ? (
      <ul>  
        <li>
          <Link to="/profile" className="dropdown-link">
            Profile
          </Link>
        </li>
        <li>
          <Link to="/settings" className="dropdown-link">
            Settings
          </Link>
        </li>
        <li>
          <Link to="/help" className="dropdown-link">
            Help
          </Link>
        </li>
        <li>
          <Link to="/" className="dropdown-link" onClick={logoutUser}>
            Logout
          </Link>
        </li>
      </ul>
      ) : (
        null
      )}
    </div>

  );
}

export default Dropdown;
