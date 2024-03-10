import React, { useState, useEffect, useContext } from "react";
import "./Dropdown.css";
import { Link } from "react-router-dom";
import AuthContext from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import TableRowsIcon from '@mui/icons-material/TableRows';
import jwt_decode from "jwt-decode";
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
    <div className="dropdown" style={{fontFamily: "Segoe UI"}}>
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
          <Link to="https://shorturl.at/jrLU7" className="dropdown-item">User usage</Link>
        </li>
        {/* <li>
          { permission === 'admin' || permission === 'root' ? <Link to="https://changgunguniversity-my.sharepoint.com/:p:/g/personal/d000017445_cgu_edu_tw/EdyWh_bI4NpNhyUV5Qx0Ik4Be9H0rpI-WunMMy4mkhnv0g?e=fsASwD" className="dropdown-item">Help</Link> :
          null
          }
        </li> */}
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
