import React, { useState, useEffect, useContext } from "react";
import "./Dropdown.css";
import { Link } from "react-router-dom";
import AuthContext from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import TableRowsIcon from '@mui/icons-material/TableRows';
import jwtDecode from "jwt-decode";
function Dropdown() {
  let { logoutUser, user } = useContext(AuthContext);
  const [click, setClick] = useState(false);
  const location = useLocation();
  
  const handleClick = () => setClick(!click);
  const closeMobileMenu = () => setClick(false);

  useEffect(() => {
      closeMobileMenu();
  }, [location]);
  const permission = jwt_decode(localStorage.getItem('authToken'))['permission']

  return (
    <div className="dropdown">
      <button onClick={handleClick} className="btn btn-secondary dropdown-toggle dropbtn"><TableRowsIcon/></button>
      {click ? (
      <ul className="dropdown-menu" aria-labelledby="dropdownMenuLink">  
      { permission !== 'root' ? 
        <li>
          <Link to="/user" className="dropdown-item" state={{"user": user.username}}>
            Profile
          </Link>
        </li>
        : null
      }
        <li>
          <Link to="https://hackmd.io/@lms025187/H1SCqhIR3" className="dropdown-item">
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
