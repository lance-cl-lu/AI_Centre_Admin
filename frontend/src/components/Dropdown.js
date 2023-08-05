import React, { useState, useEffect, useContext } from "react";
import "./Dropdown.css";
import { Link } from "react-router-dom";
import AuthContext from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

function Dropdown() {
  let { logoutUser } = useContext(AuthContext);
  const [click, setClick] = useState(false);
  const location = useLocation();
  
  const handleClick = () => setClick(!click);
  const closeMobileMenu = () => setClick(false);

  useEffect(() => {
    closeMobileMenu();
  }, [location]);


  return (
    <div className="dropdown">
      <button onClick={handleClick} className="btn btn-secondary dropdown-toggle dropbtn"></button>
      {click ? (
      <ul className="dropdown-menu" aria-labelledby="dropdownMenuLink">  
        <li>
          <Link to="/profile" className="dropdown-item">
            Profile
          </Link>
        </li>
        <li>
          <Link to="/settings" className="dropdown-item">
            Settings
          </Link>
        </li>
        <li>
          <Link to="/help" className="dropdown-item">
            Help
          </Link>
        </li>
        <li>
          <Link to="/" className="dropdown-item" onClick={logoutUser}>
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
