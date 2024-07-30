import React, {useState, useEffect, useContext} from "react";
import AuthContext from "../context/AuthContext";
import { PieChart } from 'react-minimal-pie-chart';
import { Card } from 'react-bootstrap';
import './Home.css'
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KUBEFLOW_HTTP } from './Urls';
import CountUp from 'react-countup';


function getRandomBlueShade() {
  const blueComponent = Math.floor(Math.random() * 256).toString(16).padStart(2, '0'); // Random blue component
  const color = `#0000${blueComponent}`; // Fixed red and green, random blue
  return color;
}

function getRandomOrangeShade() {
  const redComponent = Math.floor(Math.random() * 128 + 128).toString(16).padStart(2, '0'); // Random red component in the orange range
  const greenComponent = Math.floor(Math.random() * 128).toString(16).padStart(2, '0'); // Random green component
  const blueComponent = Math.floor(Math.random() * 128).toString(16).padStart(2, '0'); // Random blue component
  const color = `#${redComponent}${greenComponent}${blueComponent}`; // Random orange shade

  return color;
}


function Home() {
  let {user} = useContext(AuthContext);
  let [user_num, setUser_num] = useState(0);
  let [lab_num, setLab_num] = useState(0);
  const [PieData, setPieData] = useState([]);
  const [PieData2, setPieData2] = useState([]);
  useEffect(() => {
    fetch('/api/home/', { // 'http://localhost:31190/api/ldap/home/
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      setUser_num(data.user_num);
      setLab_num(data.lab_num);
      setPieData(data.lab_list.map((lab, index) => {
        return { title: lab, value: 1, color: getRandomBlueShade() }
      }))
      setPieData2(data.user_list.map((user, index) => {
        return { title: user, value: 1, color: getRandomOrangeShade() }
      }))
    }) 
    .catch((error) => {
      console.error('Error:', error);
    }
    );
  }, [user]);


  const [ unsych_list, setUnsych_list ] = useState([]);
  useEffect(() => {
    fetch('/api/check/syschronize/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      setUnsych_list(data);
    })
    .catch((error) => {
      console.error('Error: User Exist');
    }
    );
  }, []);


  return (
    <div className="Home">
      <div className="jumbotron">
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
            <h2 style={{marginTop: '5%', fontFamily: 'Bahnschrift light'}}># of users: <CountUp end={user_num} duration={5}/></h2>
            <PieChart className="PieStyle"
              data={PieData2}
              labelStyle={{
                textAlign: "center"
              }}

            />
          </div>
          <div className="piediv">
            <h2 style={{marginTop: '5%', fontFamily: 'Bahnschrift light'}}># of labs: <CountUp end={lab_num} duration={5}/></h2>
            <PieChart className="PieStyle" textAnchor="middle" dominantBaseline="middle"
              data={PieData}
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
          <Card.Header>Kubeflow</Card.Header>
          <Card.Body>
            <Card.Title>CGU AI Center Kubeflow System</Card.Title>
            <Card.Text>
            With Kubeflow you can build, deploy, and manage your machine learning workflows on Kubernetes.
            </Card.Text>
            <Link to={KUBEFLOW_HTTP} className="btn btn-primary">Kubernetes Dashboard</Link>
          </Card.Body>
        </Card>
      </div>
    </div>

  );
}
export default Home;
