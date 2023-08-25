import React, {useState, useEffect} from "react"; 
import { useContext } from "react";
import AuthContext from "../context/AuthContext";
import { PieChart } from 'react-minimal-pie-chart';
import { Card } from 'react-bootstrap';
import './Home.css'
import { Link } from "react-router-dom";
import Toast from 'react-bootstrap/Toast';
import { motion } from "framer-motion";

function Home() {
  let {user} = useContext(AuthContext);
  let [user_num, setUser_num] = useState(0);
  let [lab_num, setLab_num] = useState(0);
  const [showToast, setshowToast] = useState(true);
  const toggleShowToast = () => setshowToast(!showToast);

  useEffect(() => {
    fetch('http://120.126.23.245:31190/api/home/', {
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
      <div className="jumbotron">
        {!<Toast onClose={toggleShowToast} show={showToast} delay={3000} className="toast-left">
          <Toast.Header>
          <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
          <strong className="me-auto">Bootstrap</strong>
          <small>11 mins ago</small>
          </Toast.Header>
          <Toast.Body>Welcome to CGU AI Centre LDAP System, {user.username}</Toast.Body>
        </Toast>}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.8,
            delay: 0.6,
            ease: [0, 0.71, 0.2, 1.01]
          }}
        >
        <div className="pie">

          <div className="piediv">
            <h2>Users</h2>
            <PieChart className="PieStyle" 
              data={[
                { title: 'Users', value: user_num, color: '#E38627' },
              ]}
              label={({ dataEntry }) => dataEntry.value}
              labelStyle={{
                textAlign: "center"
              }}

            />
          </div>
          <div className="piediv">
            <h2>Labs</h2>
            <PieChart className="PieStyle" textAnchor="middle" dominantBaseline="middle"
              data={[
                { title: 'Labs', value: lab_num, color: '#C13C37' },
              ]}
              label={({ dataEntry }) => dataEntry.value}
              labelStyle={(index) => ({
                fill: '#fff',
                fontSize: '15px',
                fontFamily: 'comic sans ms'
              })}
            />
          </div>
        </div>
        </motion.div>
        <br/><br/>
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
    </div>

  );
}
export default Home;