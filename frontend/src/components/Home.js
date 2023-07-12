import React from "react"; 
import { useContext } from "react";
import AuthContext from "../context/AuthContext";

function Home() {
  let {user} = useContext(AuthContext);
  // after logout, user is null
  console.log(user);
  return (
    <div className="Home">
      <h1>Home</h1>
      {user && <p>Hello {user.username}</p> }
    </div>
  );
}
export default Home;