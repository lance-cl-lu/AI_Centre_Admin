import React, {useState, useEffect} from "react"; 
import { useContext } from "react";
import AuthContext from "../context/AuthContext";

function Home() {
  let {user} = useContext(AuthContext);
  let [user_num, setUser_num] = useState(0);
  let [lab_num, setLab_num] = useState(0);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/home/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      setUser_num(data.user_num);
      setLab_num(data.lab_num);
    }) 
    .catch((error) => {
      console.error('Error:', error);
    }
    );
  }, [user]);
  return (
    <div className="Home">
      <div className="piechart">
        <h2>Number of Users</h2>
        <p>{user_num}</p>
      </div>
      <div className="piechart">
        <h2>Number of Labs</h2>
        <p>{lab_num}</p>
      </div>
    
      <h1>Home</h1>
      {user && <p>Hello {user.username}</p> }
    </div>
  );
}
export default Home;