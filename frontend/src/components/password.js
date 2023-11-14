import { useLocation, Link } from 'react-router-dom'
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { Container, Row } from 'react-bootstrap';
import { useState } from 'react';
import jwt_decode from "jwt-decode";
import Card from 'react-bootstrap/Card';

function Password() {
    const [ permission ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)
    const state = useLocation().state;
    const [ user ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['username'] : null)
    let send_user = permission==='user' ? user : state['user']
    const handleSubmit = async () => {
        let password = document.getElementById("inputPassword")
        let comfirm = document.getElementById("inputComfirmPassword")
        if (password.value && comfirm.value ) {
            if(password.value !== comfirm.value) {
                alert("Password do not match!!")
                password.value = ""
                comfirm.value = ""
            } else {
                let response = await fetch("/api/password/change/", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        "username": send_user,
                        "password": password.value
                    }),
                })
                if(response.status===200) {
                    alert('Password change successfully');
                } else {
                    alert("Password is Invalid!!")
                }
            }
        } else {
            alert("Please enter the password.")
            password.value = ""
            comfirm.value = ""
        }
    }
    return (
        <div style={{fontFamily: "Segoe UI", display: "flex", flexDirection: "column", alignItems: "center"}}>
            <h1>Please enter  new password for {send_user}</h1><br/>
            <Form className='form-css' style={{boxShadow: "0px 0px 10px 0px #888888", padding: "20px", borderRadius: "12px", width: "75%"}}>
                <div style={{display: "inline-flex", width: "100%"}}>
                <div style={{width: "60%", textAlign: "center", justifyContent: "center", flexWrap: "nowrap", display: "inline-flex", flexDirection: "column"}}>
                    <Form.Group as={Row} className="mb-3" controlId="formnewpassword" style={{flexWrap: 'nowrap', paddingTop: '20px'}}>
                        <Form.Label column sm="2">
                            New Password
                        </Form.Label>
                        <Col sm="10">
                            <Form.Control plaintext id="inputPassword" style={{border: '1px solid #ced4da', borderRadius: '12px', width: '70%', height: '38px'}} />
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3" controlId="formnewcomfirmpassword" style={{flexWrap: 'nowrap', paddingTop: '20px'}}>
                        <Form.Label column sm="2">
                            Comfirm Password
                        </Form.Label>
                        <Col sm="10">
                            <Form.Control plaintext id="inputComfirmPassword" style={{border: '1px solid #ced4da', borderRadius: '12px', width: '70%', height: '38px'}} />
                        </Col>
                    </Form.Group>
                    <div style={{display: "inline-flex", width: "100%", justifyContent: "center"}}>
                    <Button variant="primary" type="button" onClick={handleSubmit} style={{margin: "1rem", width: "30%"}}> Submit </Button>
                    <Button variant='warning' type='button' onClick={() => window.history.back()} style={{margin: "1rem", width: "30%"}}>Cancel and Back</Button>
                    </div>
                </div>
                            {/* List the password rule*/}
                <div style={{ textAlign: "left", width: "40%"}}>
                    <h3>Password must contain the following:</h3>
                    <ul style={{ listStyleType: "none"}}>   
                        <li>A lowercase letter</li>
                        <li>A capital (uppercase) letter</li>
                        <li>A number</li>
                        <li>Minimum 8 characters</li>
                        <li>Cannot be all numbers</li>
                    </ul>
                </div>
            </div>
            </Form>
            { permission === "user" ? <Container style={{paddingTop: "20px"}}>
            <Card className="text-center" style={{boxShadow: "0px 0px 10px 0px #888888", borderRadius: "12px"}}>
                <Card.Header>Kubeflow</Card.Header>
                <Card.Body>
                    <Card.Title>CGU AI Center Kubeflow System</Card.Title>
                    <Card.Text>
                    With Kubeflow you can build, deploy, and manage your machine learning workflows on Kubernetes.
                    </Card.Text>
                    <Link to="http://120.126.23.245/" className="btn btn-primary">Kubernetes Dashboard</Link>
                </Card.Body>
            </Card>
            </Container> : null

            }


        </div>
    )
}

export default Password