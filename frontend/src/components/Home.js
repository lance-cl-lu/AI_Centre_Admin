import React, {useState, useEffect} from "react"; 
import { useContext } from "react";
import AuthContext from "../context/AuthContext";
import { PieChart, PieChartProps  } from 'react-minimal-pie-chart';
import { Card } from 'react-bootstrap';
import './Home.css'
import { Link } from "react-router-dom";

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
          
      <h1>Home</h1>
      {user && <p>Hello {user.username}</p> }
      <div className="piediv">
        <h2>Users</h2>
        <PieChart 
          data={[
            { title: 'Users', value: user_num, color: '#E38627' },
          ]}
          label={({ dataEntry }) => dataEntry.value}

        />
      </div>
      <div className="piediv">
        <h2>Labs</h2>
        <PieChart 
          data={[
            { title: 'Labs', value: lab_num, color: '#C13C37' },
          ]}
          label={({ dataEntry }) => dataEntry.value}
          labelStyle={(index) => ({
            fill: '#fff',
            fontSize: '15px',
            fontFamily: 'comic sans ms',

          })}
        />
      </div>

      <Card className="text-center">
        <Card.Header>Featured</Card.Header>
        <Card.Body>
          <Card.Title>Special title treatment</Card.Title>
          <Card.Text>
          With supporting text below as a natural lead-in to additional content.
          </Card.Text>
          <Link to="http://120.126.23.245/" className="btn btn-primary">Kubernetes Dashboard</Link>
        </Card.Body>
        <Card.Footer className="text-muted">2 days ago</Card.Footer>
      </Card>

    </div>

  );
}
export default Home;