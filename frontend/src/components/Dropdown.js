import React, { useState, useEffect, useContext } from "react";
import "./Dropdown.css";
import { Link } from "react-router-dom";
import AuthContext from '../context/AuthContext';

function Dropdown() {
  const { user, logoutUser } = useContext(AuthContext);
  const [menu, setMenu] = useState(false);

  const showMenu = () => {
    setMenu(!menu);
  };

  useEffect(() => {
    if (menu) {
      document.addEventListener("click", closeMenu);
    }
    return () => {
      document.removeEventListener("click", closeMenu);
    };
  }, [menu]);

  const closeMenu = (e) => {
    if (
      !e.target.classList.contains("dropdown-content") &&
      !e.target.classList.contains("dropdown")
    ) {
      setMenu(false);
    }
  };

  return (
    <div className="dropdown">
      {user ? (
        <div className="dropdown-content">
          <button onClick={showMenu}>≡</button>
        </div>
      ) : (
        <div className="dropdown-content">
          <Link to="/login">Login</Link>
        </div>
      )}
      {menu && (
        <div className="dropdown-content">
          <Link to="/user" state={{ user: user.username }}>{user.username}</Link>
          <Link to="/logout" onClick={logoutUser}>
            Logout
          </Link>
        </div>
      )}
    </div>
  );
}

export default Dropdown;
