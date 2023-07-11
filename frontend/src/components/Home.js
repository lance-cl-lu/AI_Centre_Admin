import React from "react"; 
import { useContext } from "react";
import AuthContext from "../context/AuthContext";

function Home() {
  let {user} = useContext(AuthContext);
  return (
    <div className="Home">
      <h1>Home</h1>
      
      {user && <p>Hello {user.username}</p> }
    </div>
  );
}
export default Home;